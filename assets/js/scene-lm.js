/* LockMachine · cena do topo: a prensa hidráulica P-01 e o posto de comando bimanual dela.
   O cartão RFID encosta na leitora do posto; a torre de sinalização responde. Com a capacitação
   válida, os botões bimanuais acendem e a prensa faz o ciclo; bloqueado, a torre pisca em vermelho
   e a prensa não se move. Ilustração: máquina, nomes e UIDs são fictícios (os mesmos do simulador).
   O LockMachine se soma às proteções da máquina (cortina de luz, emergência), não as substitui. */
import {
  THREE, DETAIL, webglOk, createStage, addFloor, contactShadow, highBays, glowSprite, pointerTracker,
  leaveTracker, whenOpen, canvasTexture, roundRect, yieldToBrowser, loadEnvironment, fallBack,
} from './scene-kit.js';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';

const CARDS = [
  { name: 'Ana Ribeiro', id: 'OP-1042', uid: '04A1B2C3D4', initials: 'AR', tone: '#22D07B', ok: true, code: 'AUTORIZADO' },
  { name: 'Bruno Teixeira', id: 'OP-1077', uid: '04B7E1A290', initials: 'BT', tone: '#FFD23F', ok: false, code: 'TREINAMENTO_VENCIDO' },
];

/* ---------- printed and lit surfaces (2D canvas) ---------- */

function cardFace(card) {
  return canvasTexture(1024, 656, (ctx, w, h) => {
    roundRect(ctx, 0, 0, w, h, 52);
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#E1E4EC');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FF3D2E';
    ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = '#1C0503';
    ctx.font = '800 54px Archivo';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOCKMACHINE', 52, 78);
    ctx.strokeStyle = '#1C0503';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    [26, 46, 66].forEach((r) => { ctx.beginPath(); ctx.arc(w - 120, 78, r, -0.7, 0.7); ctx.stroke(); });
    roundRect(ctx, 52, 210, 230, 230, 40);
    ctx.fillStyle = card.tone;
    ctx.fill();
    ctx.fillStyle = '#0B0C10';
    ctx.font = '800 92px Archivo';
    ctx.textAlign = 'center';
    ctx.fillText(card.initials, 167, 330);
    ctx.textAlign = 'left';
    ctx.font = '800 64px Archivo';
    ctx.fillText(card.name, 320, 262);
    ctx.font = '650 44px Archivo';
    ctx.fillStyle = '#3B4152';
    ctx.fillText(card.id, 320, 334);
    ctx.font = '600 36px "Martian Mono"';
    ctx.fillStyle = '#5A6074';
    ctx.fillText('UID ' + card.uid, 320, 400);
    ctx.font = '700 30px Archivo';
    ctx.fillStyle = '#8A90A2';
    ctx.textAlign = 'right';
    ctx.fillText('DADO FICTÍCIO', w - 52, h - 52);
    ctx.restore();
  });
}

const SCREEN = {
  idle: { color: '#ECEEF4', title: 'APROXIME', title2: 'O CARTÃO' },
  read: { color: '#FFD23F', title: 'LENDO…' },
  ok: { color: '#3BE08F', title: 'LIBERADO' },
  no: { color: '#FF5A4D', title: 'BLOQUEADO' },
};

function drawScreen(ctx, w, h, state, card) {
  const s = SCREEN[state];
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0B1019');
  bg.addColorStop(1, '#04060B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // header: machine and a thin status bar
  ctx.fillStyle = '#7C8298';
  ctx.font = '600 30px "Martian Mono"';
  ctx.textBaseline = 'middle';
  ctx.fillText('P-01 · PRENSA', 34, 42);
  ctx.fillStyle = s.color;
  ctx.globalAlpha = state === 'idle' ? 0.35 : 1;
  ctx.fillRect(0, h - 10, w, 10);
  ctx.globalAlpha = 1;

  // icon
  const cx = 104;
  const cy = h * 0.56;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  if (state === 'idle') {
    [22, 44, 66].forEach((r) => { ctx.beginPath(); ctx.arc(cx - 34, cy, r, -0.75, 0.75); ctx.stroke(); });
  } else if (state === 'read') {
    ctx.beginPath(); ctx.arc(cx, cy, 52, -Math.PI / 2, Math.PI); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    if (state === 'ok') { ctx.moveTo(cx - 26, cy + 2); ctx.lineTo(cx - 6, cy + 22); ctx.lineTo(cx + 28, cy - 18); } else {
      ctx.moveTo(cx - 22, cy - 22); ctx.lineTo(cx + 22, cy + 22); ctx.moveTo(cx + 22, cy - 22); ctx.lineTo(cx - 22, cy + 22);
    }
    ctx.stroke();
  }

  // words
  const x = 200;
  ctx.fillStyle = s.color;
  ctx.font = '800 64px Archivo';
  if (s.title2) {
    ctx.fillText(s.title, x, cy - 34);
    ctx.fillText(s.title2, x, cy + 34);
    return;
  }
  ctx.fillText(s.title, x, cy - 30);
  ctx.fillStyle = '#AEB4C6';
  ctx.font = state === 'no' ? '600 27px "Martian Mono"' : '600 30px "Martian Mono"';
  const sub = state === 'read' ? 'UID ' + card.uid : state === 'ok' ? card.name : card.code;
  ctx.fillText(sub, x, cy + 34);
}

function stripesTexture() {
  const tex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#FFC21F';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#121419';
    for (let x = -h; x < w + h; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 16 - h, h); ctx.lineTo(x - h, h);
      ctx.closePath();
      ctx.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function plateTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#C9CED9');
    g.addColorStop(1, '#9EA4B3');
    roundRect(ctx, 0, 0, w, h, 22);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
    [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fillStyle = '#6C7283'; ctx.fill();
    });
    ctx.fillStyle = '#12151D';
    ctx.textBaseline = 'middle';
    ctx.font = '800 112px Archivo';
    ctx.fillText('P-01', 60, h / 2 + 4);
    ctx.fillStyle = '#2C3140';
    ctx.font = '750 50px Archivo';
    ctx.fillText('PRENSA HIDRÁULICA', 350, h / 2 - 26);
    ctx.font = '600 30px "Martian Mono"';
    ctx.fillStyle = '#454B5C';
    ctx.fillText('ACESSO POR CARTÃO RFID', 352, h / 2 + 40);
  });
}

function hazardTexture() {
  // crush hazard: a block coming down on a hand
  return canvasTexture(256, 232, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, 10); ctx.lineTo(w - 10, h - 10); ctx.lineTo(10, h - 10); ctx.closePath();
    ctx.fillStyle = '#FFD23F'; ctx.fill();
    ctx.lineWidth = 14; ctx.strokeStyle = '#0B0C10'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#0B0C10';
    ctx.fillRect(w / 2 - 34, 92, 68, 30);
    ctx.fillRect(w / 2 - 5, 70, 10, 24);
    roundRect(ctx, w / 2 - 42, 150, 84, 30, 12); ctx.fill();
    [-30, -12, 6, 24].forEach((dx) => { roundRect(ctx, w / 2 + dx - 2, 134, 14, 26, 6); ctx.fill(); });
  });
}

function gaugeTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = '#F2F3F6';
    ctx.beginPath(); ctx.arc(c, c, 124, 0, Math.PI * 2); ctx.fill();
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    ctx.strokeStyle = '#E2382B';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(c, c, 100, a0 + (a1 - a0) * 0.8, a1); ctx.stroke();
    ctx.strokeStyle = '#1A1D26';
    for (let i = 0; i <= 25; i++) {
      const a = a0 + ((a1 - a0) * i) / 25;
      const r0 = i % 5 === 0 ? 84 : 94;
      ctx.lineWidth = i % 5 === 0 ? 6 : 3;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); ctx.lineTo(c + Math.cos(a) * 108, c + Math.sin(a) * 108); ctx.stroke();
    }
    ctx.fillStyle = '#1A1D26';
    ctx.font = '700 22px Archivo';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const a = a0 + ((a1 - a0) * i) / 5;
      ctx.fillText(String(i * 50), c + Math.cos(a) * 64, c + Math.sin(a) * 64);
    }
    ctx.font = '600 20px "Martian Mono"';
    ctx.fillText('bar', c, c + 60);
  });
}

function padTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(200,206,222,.5)';
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 10]);
    roundRect(ctx, 10, 10, w - 20, h - 20, 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    [28, 52, 76].forEach((r) => {
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, -0.75, 0.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
    });
  });
}

function emitterTexture() {
  // light-curtain strip: a column of red emitters
  return canvasTexture(32, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0D0F14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FF4A3D';
    for (let y = 14; y < h; y += 26) { ctx.beginPath(); ctx.arc(w / 2, y, 5, 0, Math.PI * 2); ctx.fill(); }
  });
}

function meshGuardTexture() {
  // expanded metal guard: diamonds (white = solid)
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.closePath();
    ctx.stroke();
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function ribTexture() {
  // normal map with vertical ribs: stack-light lenses are fluted so the LED reads as bands of light
  const tex = canvasTexture(256, 8, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const nx = Math.sin((x / w) * Math.PI * 2 * 4);
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        img.data[i + 1] = 128;
        img.data[i + 2] = Math.round(Math.sqrt(Math.max(0, 1 - nx * nx * 0.25)) * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

/* ---------- the scene ---------- */

async function init(el) {
  const stage = createStage(el, { fov: 30, exposure: 1.1 });
  const { scene, camera } = stage;
  el.classList.add('is-live');
  document.documentElement.classList.add('has-scene');
  await yieldToBrowser();

  const envReady = loadEnvironment(stage, 0.6);
  await yieldToBrowser();

  // Light: a warm high-bay key, a work light inside the press, a cold rim from behind, and the tower.
  scene.add(new THREE.HemisphereLight(0x9aa4c8, 0x050608, 0.3));
  const key = new THREE.SpotLight(0xfff1dc, 300, 0, 0.6, 0.8, 2);
  key.position.set(-3, 7.4, 5.4);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xd8deff, 0.32);
  fill.position.set(3, 2.5, 6);
  scene.add(fill);
  const rim = new THREE.PointLight(0x9fb0ff, 46, 0, 2);
  scene.add(rim);
  const work = new THREE.SpotLight(0xf4f6ff, 26, 3.4, 0.95, 0.7, 2);
  scene.add(work, work.target);
  const towerLight = new THREE.PointLight(0xffffff, 0, 0, 2);
  scene.add(towerLight);
  await yieldToBrowser();

  // Shared finishes.
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    frame: std({ color: 0x394052, roughness: 0.5, metalness: 0.45 }),
    frameDark: std({ color: 0x171a22, roughness: 0.6, metalness: 0.4 }),
    yellow: std({ color: 0xffc21f, roughness: 0.4, metalness: 0.2 }),
    steel: std({ color: 0x9aa2b4, roughness: 0.3, metalness: 0.92 }),
    steelDark: std({ color: 0x3d4351, roughness: 0.36, metalness: 0.85 }),
    chrome: std({ color: 0xeef1f7, roughness: 0.06, metalness: 1, envMapIntensity: 1.7 }),
    rubber: std({ color: 0x0d0e12, roughness: 0.55, metalness: 0 }),
    gloss: std({ color: 0x0b0c10, roughness: 0.2, metalness: 0.25 }),
    motor: std({ color: 0x2d58b0, roughness: 0.42, metalness: 0.35 }),
    sheet: std({ color: 0xcdd3de, roughness: 0.26, metalness: 1 }),
    red: std({ color: 0xd8261a, roughness: 0.28, metalness: 0.1 }),
  };
  const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, detail = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (detail) m.layers.set(DETAIL);
    parent.add(m);
    return m;
  };
  const decal = (parent, w, h, map, x, y, z, { detail = true, rough = 0.45, metal = 0.1, ry = 0 } = {}) => {
    const m = add(parent, new THREE.PlaneGeometry(w, h), std({ map, roughness: rough, metalness: metal, transparent: true }), x, y, z, detail);
    m.rotation.y = ry;
    return m;
  };

  const stripes = stripesTexture();
  const rig = new THREE.Group(); // press + station + power unit, turned to a three-quarter view
  scene.add(rig);

  /* ----- Hydraulic press P-01 (two columns, crown with the cylinder, moving slide) ----- */
  const press = new THREE.Group();
  rig.add(press);
  add(press, rbox(2.12, 0.12, 1.26, 0.02), M.frameDark, 0, 0.06, 0);
  add(press, rbox(1.96, 0.62, 1.12, 0.03), M.frame, 0, 0.43, 0);
  const bedStripes = stripes.clone();
  bedStripes.repeat.set(6, 1);
  decal(press, 1.9, 0.08, bedStripes, 0, 0.66, 0.562, { detail: false });
  add(press, rbox(1.52, 0.08, 0.92, 0.01), M.steel, 0, 0.78, 0);
  [-0.25, 0, 0.25].forEach((z) => add(press, new THREE.BoxGeometry(1.52, 0.004, 0.05), M.frameDark, 0, 0.8215, z, true));
  [-0.84, 0.84].forEach((x) => {
    add(press, rbox(0.32, 2.08, 0.98, 0.03), M.frame, x, 1.78, 0);
    add(press, new THREE.BoxGeometry(0.03, 1.9, 0.1), M.steel, x * 0.79, 1.82, 0.28, true); // gib rails
    add(press, new THREE.BoxGeometry(0.03, 1.9, 0.1), M.steel, x * 0.79, 1.82, -0.28, true);
  });
  add(press, rbox(2.06, 0.56, 1.16, 0.035), M.frame, 0, 3.08, 0);
  // crown front: nameplate, crush-hazard sticker, pressure gauge
  decal(press, 0.92, 0.23, plateTexture(), -0.32, 3.08, 0.582, { detail: false, rough: 0.35, metal: 0.6 });
  [-0.84, 0.84].forEach((x) => decal(press, 0.2, 0.18, hazardTexture(), x, 2.42, 0.492));
  const gauge = new THREE.Group();
  gauge.position.set(0.62, 3.08, 0.58);
  press.add(gauge);
  const bezel = add(gauge, new THREE.CylinderGeometry(0.125, 0.125, 0.05, 40), M.chrome, 0, 0, 0.02);
  bezel.rotation.x = Math.PI / 2;
  add(gauge, new THREE.CircleGeometry(0.108, 40), new THREE.MeshBasicMaterial({ map: gaugeTexture() }), 0, 0, 0.046);
  const needleGeo = new THREE.BoxGeometry(0.008, 0.088, 0.004);
  needleGeo.translate(0, 0.036, 0);
  const needle = add(gauge, needleGeo, new THREE.MeshBasicMaterial({ color: 0xd8261a }), 0, 0, 0.05);
  add(gauge, new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0x1a1d26 }), 0, 0, 0.052, true);
  // the cylinder: square flanges, painted barrel, four chrome tie rods, oil ports
  add(press, rbox(0.84, 0.08, 0.84, 0.02), M.steelDark, 0, 3.4, 0);
  add(press, new THREE.CylinderGeometry(0.3, 0.3, 0.58, 48), M.frame, 0, 3.73, 0);
  add(press, rbox(0.8, 0.08, 0.8, 0.02), M.steelDark, 0, 4.06, 0);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    add(press, new THREE.CylinderGeometry(0.022, 0.022, 0.74, 12), M.chrome, sx * 0.32, 3.73, sz * 0.32, true);
    add(press, new THREE.CylinderGeometry(0.036, 0.036, 0.03, 6), M.steel, sx * 0.32, 4.115, sz * 0.32, true);
  });
  [3.52, 3.94].forEach((y) => {
    const port = add(press, new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16), M.steel, 0.33, y, 0);
    port.rotation.z = Math.PI / 2;
  });

  // Slide: yellow ram with the upper die, guided between the columns.
  const SLIDE_TOP = 2.02;
  const SLIDE_DOWN = 1.175; // upper die meets the blank
  const slide = new THREE.Group();
  press.add(slide);
  add(slide, rbox(1.34, 0.38, 0.9, 0.02), M.yellow, 0, 0.19, 0);
  const slideStripes = stripes.clone();
  slideStripes.repeat.set(5, 1);
  decal(slide, 1.3, 0.08, slideStripes, 0, 0.055, 0.452, { detail: false });
  add(slide, rbox(0.92, 0.15, 0.62, 0.01), M.steel, 0, -0.075, 0);
  add(slide, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 40), M.steelDark, 0, -0.18, 0);
  const rodGeo = new THREE.CylinderGeometry(0.095, 0.095, 1, 40);
  rodGeo.translate(0, -0.5, 0);
  const rod = add(press, rodGeo, M.chrome, 0, 2.95, 0);
  // lower die, blank and the part it becomes
  add(press, rbox(0.98, 0.13, 0.68, 0.01), M.steelDark, 0, 0.885, 0);
  const blank = add(press, new THREE.BoxGeometry(0.72, 0.012, 0.5), M.sheet, 0, 0.956, 0);
  const boss = add(press, rbox(0.4, 0.05, 0.28, 0.02, 3), M.sheet, 0, 0.966, 0);
  boss.visible = false;
  // light curtain at the opening: two bars with emitters and a status LED
  const emitter = emitterTexture();
  const curtainLeds = [];
  [-0.72, 0.72].forEach((x) => {
    add(press, rbox(0.06, 1.24, 0.06, 0.01), M.gloss, x, 1.5, 0.53);
    add(press, rbox(0.07, 0.05, 0.07, 0.01), M.yellow, x, 2.14, 0.53, true);
    add(press, rbox(0.07, 0.05, 0.07, 0.01), M.yellow, x, 0.86, 0.53, true);
    const strip = add(press, new THREE.PlaneGeometry(0.03, 1.16), new THREE.MeshBasicMaterial({ map: emitter }), x - Math.sign(x) * 0.031, 1.5, 0.53, true);
    strip.rotation.y = -Math.sign(x) * Math.PI / 2;
    const led = add(press, new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: 0x22d07b, toneMapped: false }), x, 2.18, 0.53, true);
    curtainLeds.push(led);
  });
  // expanded-metal guard at the back
  const guardMap = meshGuardTexture();
  guardMap.repeat.set(26, 38);
  add(press, new THREE.PlaneGeometry(1.36, 1.98), std({ color: 0x1c2029, roughness: 0.5, metalness: 0.7, alphaMap: guardMap, alphaTest: 0.5, side: THREE.DoubleSide }), 0, 1.79, -0.47, true);
  // work light under the crown
  add(press, rbox(1.1, 0.025, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: 0xf4f6ff, toneMapped: false }), 0, 2.79, 0.36, true);
  work.position.set(0, 2.78, 0.3);
  await yieldToBrowser();

  /* ----- Hydraulic power unit: tank, blue motor, pump, hoses up to the cylinder ----- */
  const hpu = new THREE.Group();
  hpu.position.set(1.72, 0, -0.18);
  rig.add(hpu);
  add(hpu, rbox(0.86, 0.72, 0.62, 0.03), M.frame, 0, 0.42, 0);
  add(hpu, rbox(0.9, 0.06, 0.66, 0.01), M.frameDark, 0, 0.03, 0);
  const motor = add(hpu, new THREE.CylinderGeometry(0.17, 0.17, 0.46, 32), M.motor, -0.06, 0.97, 0);
  motor.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const fin = add(hpu, new THREE.CylinderGeometry(0.186, 0.186, 0.014, 32), M.motor, -0.24 + i * 0.07, 0.97, 0, true);
    fin.rotation.z = Math.PI / 2;
  }
  const fan = add(hpu, new THREE.CylinderGeometry(0.18, 0.18, 0.1, 32), M.steelDark, -0.34, 0.97, 0);
  fan.rotation.z = Math.PI / 2;
  const bell = add(hpu, new THREE.CylinderGeometry(0.12, 0.15, 0.16, 24), M.steelDark, 0.25, 0.97, 0);
  bell.rotation.z = Math.PI / 2;
  add(hpu, rbox(0.2, 0.2, 0.2, 0.02), M.steel, 0.39, 0.97, 0);
  add(hpu, new THREE.PlaneGeometry(0.05, 0.22), std({ color: 0x2a1a04, emissive: 0xffa21f, emissiveIntensity: 0.5 }), 0.2, 0.46, 0.312, true);
  // hoses (in rig space, from the pump to the cylinder ports)
  const hose = (pts) => add(rig, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 64, 0.034, 10, false), M.rubber);
  hose([[2.2, 0.97, -0.12], [2.38, 1.6, -0.2], [2.1, 3.1, -0.15], [1.2, 3.5, -0.05], [0.4, 3.52, 0]]);
  hose([[2.2, 1.0, -0.26], [2.46, 1.9, -0.32], [2.05, 3.55, -0.25], [1.15, 3.92, -0.1], [0.4, 3.94, 0]]);
  await yieldToBrowser();

  /* ----- Operator station: two-hand control, emergency stop, the reader and the stack light ----- */
  const station = new THREE.Group();
  // in front of the press, at a safe distance from the die, turned a little towards the camera
  station.position.set(-0.84, 0, 2.78);
  station.rotation.y = 0.54;
  rig.add(station);
  add(station, new THREE.CylinderGeometry(0.3, 0.32, 0.04, 40), M.frameDark, 0, 0.02, 0);
  add(station, rbox(0.16, 1.04, 0.16, 0.02), M.frame, 0, 0.56, 0);
  const desk = new THREE.Group();
  desk.position.set(0, 1.13, 0.02);
  desk.rotation.x = 0.3; // top face tilts towards the operator
  station.add(desk);
  add(desk, rbox(0.98, 0.2, 0.42, 0.035), M.yellow, 0, 0, 0);
  const buttons = [-0.33, 0.33].map((x) => {
    add(desk, new THREE.CylinderGeometry(0.078, 0.084, 0.03, 32), M.gloss, x, 0.112, 0);
    const mat = std({ color: 0x0e3b26, emissive: 0x22d07b, emissiveIntensity: 0, roughness: 0.25 });
    const cap = add(desk, new THREE.SphereGeometry(0.062, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, 0.124, 0);
    cap.scale.y = 0.7;
    return { cap, mat, rest: 0.124 };
  });
  add(desk, new THREE.CylinderGeometry(0.05, 0.055, 0.04, 24), M.gloss, 0, 0.118, 0.04);
  const estop = add(desk, new THREE.SphereGeometry(0.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.red, 0, 0.138, 0.04);
  estop.scale.y = 0.75;
  // mast behind the desk
  add(station, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 20), M.steel, 0, 1.68, -0.19);

  // Reader: gloss terminal with a screen, the antenna pad and a ring that lights.
  const reader = new THREE.Group();
  reader.position.set(0, 1.74, -0.12);
  station.add(reader);
  add(reader, rbox(0.52, 0.72, 0.09, 0.04, 4), M.gloss, 0, 0, 0);
  add(reader, rbox(0.12, 0.2, 0.06, 0.01), M.steelDark, 0, 0, -0.07);
  add(reader, rbox(0.5, 0.035, 0.094, 0.015, 2), std({ color: 0x3a0906, emissive: 0xff3d2e, emissiveIntensity: 0.9 }), 0, 0.33, 0, true);
  const screenTex = canvasTexture(768, 400, (ctx, w, h) => drawScreen(ctx, w, h, 'idle'));
  add(reader, new THREE.PlaneGeometry(0.42, 0.219), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), 0, 0.16, 0.047);
  const padY = -0.16;
  const pad = add(reader, new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: padTexture(), transparent: true, toneMapped: false }), 0, padY, 0.047, true);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1b2030, toneMapped: false });
  add(reader, new THREE.RingGeometry(0.165, 0.178, 64), ringMat, 0, padY, 0.048);
  const ripple = add(reader, new THREE.RingGeometry(0.13, 0.145, 64), new THREE.MeshBasicMaterial({ color: 0x8c9bff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), 0, padY, 0.05, true);
  const ringGlow = glowSprite(0x8c9bff, 0.7, 0);
  ringGlow.position.set(0, padY, 0.06);
  reader.add(ringGlow);

  // Stack light: green, amber, red from the bottom, fluted lenses over an LED column, buzzer on top.
  const tower = new THREE.Group();
  tower.position.set(0, 2.18, -0.19);
  station.add(tower);
  add(tower, new THREE.CylinderGeometry(0.075, 0.085, 0.06, 32), M.gloss, 0, 0.03, 0);
  let ty = 0.06;
  const ribs = ribTexture();
  const lamps = {};
  [['g', 0x22d07b], ['y', 0xffb21f], ['r', 0xff3d2e]].forEach(([k, hex]) => {
    const H = 0.17;
    const color = new THREE.Color(hex);
    const lens = std({
      color: color.clone().lerp(new THREE.Color(0x30343f), 0.45).multiplyScalar(0.16), roughness: 0.24, metalness: 0, transparent: true, opacity: 0.9,
      emissive: color, emissiveIntensity: 0.03, normalMap: ribs, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.7,
    });
    add(tower, new THREE.CylinderGeometry(0.088, 0.088, H, 48, 1, true), lens, 0, ty + H / 2, 0);
    const core = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.15), toneMapped: false });
    add(tower, new THREE.CylinderGeometry(0.046, 0.046, H * 0.84, 16), core, 0, ty + H / 2, 0);
    add(tower, new THREE.CylinderGeometry(0.091, 0.091, 0.014, 40), M.steelDark, 0, ty + H + 0.007, 0);
    const halo = glowSprite(hex, 0.42, 0);
    const bloom = glowSprite(hex, 0.95, 0);
    halo.position.set(0, ty + H / 2, 0.11); // in front of the lens, or its depth would hide the glow
    bloom.position.copy(halo.position);
    tower.add(halo, bloom);
    lamps[k] = { lens, core, halo, bloom, color, y: ty + H / 2, level: 0, mode: 'off' };
    ty += H + 0.014;
  });
  add(tower, new THREE.CylinderGeometry(0.088, 0.088, 0.1, 40), M.gloss, 0, ty + 0.05, 0);
  add(tower, new THREE.SphereGeometry(0.088, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.gloss, 0, ty + 0.1, 0);
  await yieldToBrowser();

  /* ----- Floor: the mirror (after the geometry, see addFloor), hazard tape, shadows, the hall ----- */
  const floor = addFloor(stage, { mirrorTint: 0xa2a8bc, reach: 5.5, floorFade: 0.2, clear: 0.36 });
  highBays(scene, { count: 6, y: 5.6, z: -10, spread: 20 });
  const tape = (w, x, z, ry) => {
    const t = stripes.clone();
    t.repeat.set(Math.round(w / 0.32), 1);
    const m = add(rig, new THREE.PlaneGeometry(w, 0.08), std({ map: t, roughness: 0.6 }), x, 0.004, z, true);
    m.rotation.set(-Math.PI / 2, 0, ry);
  };
  tape(4.0, 0.42, 0.95, 0);
  tape(4.0, 0.42, -0.95, 0);
  tape(1.9, -1.58, 0, Math.PI / 2);
  tape(1.9, 2.42, 0, Math.PI / 2);
  const sPress = contactShadow(1.5, 0.8, 1.55);
  sPress.position.set(0.3, 0.006, 0);
  const sStation = contactShadow(0.5, 0.75);
  sStation.position.set(-0.84, 0.006, 2.78);
  rig.add(sPress, sStation);
  const hall = new THREE.Group();
  [[-6.5, 1.3, -8, 3.2, 2.6, 1.2], [5.8, 1.0, -7.4, 2.4, 2.0, 1.6], [-1.2, 1.6, -11, 4, 3.2, 1]].forEach(([x, y, z, w, h, d]) => {
    add(hall, rbox(w, h, d, 0.04), M.frameDark, x, y, z, true);
  });
  [[-6.1, 2.75, -7.38, 0x22d07b], [5.4, 2.1, -6.58, 0xffb21f]].forEach(([x, y, z, c]) => {
    add(hall, new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), x, y, z, true);
    const g = glowSprite(c, 0.7, 0.5);
    g.position.set(x, y, z + 0.05);
    g.layers.set(DETAIL);
    hall.add(g);
  });
  scene.add(hall);

  /* ----- Cards: white PVC with a printed face ----- */
  const cards = CARDS.map((c) => {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ'; // same order as faceAngles()
    const shape = new THREE.Shape();
    const w = 0.5;
    const h = 0.32;
    const r = 0.03;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    add(g, new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }), std({ color: 0xe9ebf1, roughness: 0.35 }), 0, 0, -0.004);
    const face = add(g, new THREE.PlaneGeometry(w, h), std({ map: cardFace(c), transparent: true, roughness: 0.32 }), 0, 0, 0.0045);
    g.visible = false;
    scene.add(g);
    return { ...c, g, face };
  });

  /* ----- State: screen, ring, tower lamps, buttons, slide ----- */
  const verdictEl = document.querySelector('[data-scene-verdict]');
  const verdictText = verdictEl && verdictEl.querySelector('.scene-verdict__text');
  const RING = { idle: 0x1b2030, read: 0x8c9bff, ok: 0x22d07b, no: 0xff3d2e };
  function setScreen(state, card) {
    screenTex.userData.redraw((ctx, w, h) => drawScreen(ctx, w, h, state, card));
    ringMat.color.setHex(RING[state]);
    ringGlow.material.color.setHex(RING[state]);
    ringGlow.material.opacity = state === 'idle' ? 0 : 0.55;
    if (!verdictEl) return;
    verdictEl.dataset.state = state === 'idle' ? '' : state;
    if (state === 'idle') verdictText.innerHTML = 'Posto da <strong>P-01</strong> aguardando um cartão';
    if (state === 'read') verdictText.innerHTML = `<strong>${card.name}</strong> · UID ${card.uid} · consultando`;
    if (state === 'ok') verdictText.innerHTML = `<strong>Liberado</strong> · ${card.name} · motivo AUTORIZADO`;
    if (state === 'no') verdictText.innerHTML = `<strong>Bloqueado</strong> · ${card.name} · ${card.code}`;
  }
  function setLamps(g, y, r) {
    lamps.g.mode = g;
    lamps.y.mode = y;
    lamps.r.mode = r;
  }
  const cycle = { s: 0 }; // 0 = slide up, 1 = die closed
  const buttonsLit = { k: 0 };

  function updateMachine(t, dt) {
    // tower: LEDs switch fast but not in one frame
    let lit = null;
    const k = 1 - Math.exp(-dt * 30);
    Object.values(lamps).forEach((l) => {
      const on = l.mode === 'on' ? 1
        : l.mode === 'blink' ? (Math.sin(t * Math.PI * 2 * 1.6) > 0 ? 1 : 0)
          : l.mode === 'strobe' ? ((t * 4.5) % 1 < 0.5 ? 1 : 0) : 0;
      l.level += (on - l.level) * (dt ? k : 1);
      const L = l.level;
      l.lens.emissiveIntensity = 0.03 + L * 2.3;
      l.core.color.copy(l.color).multiplyScalar(0.15 + L * 0.85);
      l.halo.material.opacity = L * 0.9;
      l.bloom.material.opacity = L * 0.22;
      if (!lit || L > lit.level) lit = l;
    });
    towerLight.color.copy(lit.color);
    towerLight.intensity = lit.level * 5;
    tower.updateMatrixWorld();
    towerLight.position.set(0, lit.y, 0.75).applyMatrix4(tower.matrixWorld); // far enough not to light the next lens

    // slide, rod and gauge follow the cycle; the needle climbs as the die closes
    const s = cycle.s;
    slide.position.y = SLIDE_TOP + (SLIDE_DOWN - SLIDE_TOP) * s;
    rod.scale.y = 2.95 - (slide.position.y + 0.38);
    const p = s * 0.18 + Math.max(0, (s - 0.82) / 0.18) * 0.62;
    needle.rotation.z = 2.36 - p * 4.72;
    buttons.forEach((b) => { b.mat.emissiveIntensity = buttonsLit.k * 2.6; });
  }

  // Fonts arrive after the first draw: repaint the printed faces once they are ready.
  if (document.fonts) {
    Promise.all([
      document.fonts.load('800 64px Archivo'),
      document.fonts.load('600 30px "Martian Mono"'),
    ]).then(() => {
      cards.forEach((c) => { c.face.material.map.dispose(); c.face.material.map = cardFace(c); c.face.material.needsUpdate = true; });
      setScreen('idle');
      if (stage.armed && !stage.running) stage.renderOnce();
    }).catch(() => {});
  }

  /* ----- Framing: the station's reader lands at (fx, fy); the press stands behind it ----- */
  const shots = {
    wide: { fx: 0.605, fy: 0.5, camY: 2.3, camZ: 12.4, turn: -0.42, fov: 30 },
    mid: { fx: 0.6, fy: 0.44, camY: 2.4, camZ: 14.4, turn: -0.4, fov: 32 },
    tall: { fx: 0.36, fy: 0.41, camY: 2.6, camZ: 14.6, turn: -0.36, fov: 40 },
  };
  const frame = { lookY: 1.6, camY: 2.2, camZ: 8.4 };
  const readerWorld = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function layout(w, h) {
    const aspect = w / h;
    const shot = aspect < 0.85 ? shots.tall : aspect < 1.25 || w < 1021 ? shots.mid : shots.wide;
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    rig.rotation.y = shot.turn;
    rig.position.set(0, 0, 0);
    rig.updateMatrixWorld(true);
    reader.getWorldPosition(readerWorld);
    camera.position.set(0, shot.camY, shot.camZ);
    const targetY = 1 - shot.fy * 2;
    let lo = -4;
    let hi = 6;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      camera.lookAt(0, mid, 0);
      camera.updateMatrixWorld();
      probe.copy(readerWorld).project(camera);
      if (probe.y > targetY) lo = mid; else hi = mid;
    }
    frame.lookY = (lo + hi) / 2;
    camera.lookAt(0, frame.lookY, 0);
    camera.updateMatrixWorld();
    ndc.set(shot.fx * 2 - 1, targetY);
    ray.setFromCamera(ndc, camera);
    plane.constant = -readerWorld.z;
    if (ray.ray.intersectPlane(plane, hit)) rig.position.x = hit.x - readerWorld.x;
    rig.updateMatrixWorld(true);
    frame.camY = shot.camY;
    frame.camZ = shot.camZ;
    // lights and floor follow the rig
    const c = new THREE.Vector3(0.2, 1.6, 0).applyMatrix4(rig.matrixWorld);
    key.target.position.copy(c);
    rim.position.set(c.x + 3.4, 4.2, -3);
    work.target.position.set(0, 0.95, 0.1).applyMatrix4(rig.matrixWorld);
    work.position.set(0, 2.78, 0.3).applyMatrix4(rig.matrixWorld);
    floor.setFocus(c.x - 0.3, 0.4);
  }
  stage.onResize.push(layout);
  layout(stage.width, stage.height);

  const pointer = pointerTracker();
  const leave = leaveTracker(el.closest('.hero') || el);
  stage.update = (t, dt) => {
    pointer.step(dt);
    const out = leave();
    camera.position.set(pointer.x * 0.32, frame.camY - pointer.y * 0.1 + out * 0.5, frame.camZ + out * 1.2);
    camera.lookAt(0, frame.lookY + out * 0.2, 0);
    curtainLeds.forEach((l) => { l.visible = (t * 2) % 2 > 0.12; });
    updateMachine(t, dt);
  };

  // Where the card hovers: just in front of the reader's antenna pad.
  const padWorld = new THREE.Vector3();
  const facing = new THREE.Quaternion();
  const facingEuler = new THREE.Euler();
  function padPoint(dz) {
    rig.updateMatrixWorld(true);
    pad.getWorldPosition(padWorld);
    reader.getWorldQuaternion(facing);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(facing);
    return padWorld.clone().addScaledVector(n, dz);
  }
  function faceAngles() {
    reader.getWorldQuaternion(facing);
    facingEuler.setFromQuaternion(facing, 'YXZ');
    return facingEuler;
  }

  setScreen('idle');
  setLamps('off', 'off', 'off');

  await envReady;
  await stage.warmUp([screenTex, ...cards.map((c) => c.face.material.map)]);

  if (stage.reduce || !window.gsap) {
    const c = cards[0];
    c.g.visible = true;
    c.g.position.copy(padPoint(0.06));
    const e = faceAngles();
    c.g.rotation.set(e.x, e.y, -0.06, 'YXZ');
    setScreen('ok', c);
    setLamps('on', 'off', 'off');
    buttonsLit.k = 1;
    updateMachine(0, 0);
    stage.start();
    if (verdictEl) verdictEl.hidden = false;
    return;
  }
  stage.start();

  const gsap = window.gsap;
  function pressButtons(tl, at) {
    buttons.forEach((b, i) => {
      tl.to(b.cap.position, { y: b.rest - 0.022, duration: 0.12, ease: 'power2.in' }, `${at}+=${i * 0.07}`);
    });
  }
  function releaseButtons(tl, at) {
    buttons.forEach((b) => { tl.to(b.cap.position, { y: b.rest, duration: 0.25, ease: 'power2.out' }, at); });
  }
  function pass(c) {
    const tl = gsap.timeline();
    const near = () => padPoint(0.17);
    const touch = () => padPoint(0.032);
    tl.call(() => {
      c.g.visible = true;
      const p = padPoint(0.17);
      c.g.position.set(p.x + 2.2, p.y + 1.1, p.z + 1.6);
      c.g.rotation.set(0.5, -1.1, 0.7);
      boss.visible = false;
      setScreen('idle');
      setLamps('off', 'off', 'off');
    })
      .to(c.g.position, { x: () => near().x, y: () => near().y, z: () => near().z, duration: 1.1, ease: 'expo.out' })
      .to(c.g.rotation, { x: () => faceAngles().x, y: () => faceAngles().y, z: -0.06, duration: 1.1, ease: 'expo.out' }, '<')
      .to(c.g.position, { x: () => touch().x, y: () => touch().y, z: () => touch().z, duration: 0.22, ease: 'power2.in' })
      .call(() => { setScreen('read', c); setLamps('off', 'blink', 'off'); })
      .fromTo(ripple.scale, { x: 0.6, y: 0.6 }, { x: 2.3, y: 2.3, duration: 0.8, ease: 'power2.out' })
      .fromTo(ripple.material, { opacity: 0.9 }, { opacity: 0, duration: 0.8, ease: 'power2.out' }, '<')
      .to({}, { duration: 0.35 })
      .addLabel('verdict');
    if (c.ok) {
      tl.call(() => { setScreen('ok', c); setLamps('on', 'off', 'off'); }, null, 'verdict')
        .to(buttonsLit, { k: 1, duration: 0.3, ease: 'power2.out' }, 'verdict+=0.25');
      pressButtons(tl, 'verdict+=0.9');
      tl.to(cycle, { s: 1, duration: 1.0, ease: 'power2.in' }, 'verdict+=1.12')
        .call(() => { boss.visible = true; })
        .to(rig.position, { keyframes: { y: [0, -0.012, 0.004, 0] }, duration: 0.28, ease: 'none' })
        .to(cycle, { s: 0, duration: 1.4, ease: 'power3.inOut' }, '+=0.12')
        .addLabel('up', '<');
      releaseButtons(tl, 'up');
      tl.to(buttonsLit, { k: 0, duration: 0.5 }, 'up+=1.1');
    } else {
      tl.call(() => { setScreen('no', c); setLamps('off', 'off', 'strobe'); }, null, 'verdict');
      // the operator tries the buttons: nothing lights, nothing moves
      pressButtons(tl, 'verdict+=1.1');
      releaseButtons(tl, 'verdict+=1.7');
      tl.call(() => setLamps('off', 'off', 'on'), null, 'verdict+=2.2')
        .to({}, { duration: 1.1 }, 'verdict+=2.2');
    }
    tl.to(c.g.position, { x: () => c.g.position.x + 2.1, y: () => c.g.position.y + 1.2, z: () => c.g.position.z + 1.2, duration: 0.8, ease: 'power3.in' }, '+=0.3')
      .to(c.g.rotation, { x: -0.4, y: -1.2, z: 0.6, duration: 0.8, ease: 'power3.in' }, '<')
      .call(() => { c.g.visible = false; setScreen('idle'); setLamps('off', 'off', 'off'); });
    return tl;
  }

  const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
  loop.addLabel('card0', 0).add(pass(cards[0]), 'card0')
    .addLabel('card1', '+=0.5').add(pass(cards[1]), 'card1');
  let started = false;

  const nextBtn = verdictEl && verdictEl.querySelector('[data-scene-next]');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const t = loop.time();
      const second = loop.labels.card1 || loop.duration() / 2;
      cards.forEach((c) => { c.g.visible = false; });
      cycle.s = 0;
      buttonsLit.k = 0;
      buttons.forEach((b) => { b.cap.position.y = b.rest; });
      loop.play(t < second ? second : 0);
    });
  }

  whenOpen().then(() => {
    if (verdictEl) {
      verdictEl.hidden = false;
      gsap.from(verdictEl, { y: 10, autoAlpha: 0, duration: 0.6, ease: 'expo.out', delay: 0.5 });
    }
    gsap.delayedCall(0.6, () => { started = true; loop.play(); });
  });

  // Pause the story with the scene: off-screen nothing runs.
  new IntersectionObserver(([e]) => {
    if (!started) return;
    if (e.isIntersecting) loop.resume(); else loop.pause();
  }).observe(el);
}

const host = document.querySelector('[data-scene="lm"]');
if (host && webglOk()) {
  // any failure falls back to the flat version of the hero
  init(host).catch((e) => fallBack(host, e));
}
