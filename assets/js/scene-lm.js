/* LockMachine · cena do topo: o cartão RFID encontra a leitora da máquina, a torre de
   sinalização responde (verde libera, vermelho bloqueia) e o piso reflete a luz.
   Os nomes e UIDs são os mesmos dados fictícios do simulador. */
import {
  THREE, webglOk, createStage, addFloor, contactShadow, highBays, pointerTracker, leaveProgress,
  whenOpen, canvasTexture, roundRect,
} from './scene-kit.js';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';

const CARDS = [
  { name: 'Ana Ribeiro', id: 'OP-1042', uid: '04A1B2C3D4', initials: 'AR', tone: '#22D07B', ok: true, code: 'AUTORIZADO' },
  { name: 'Bruno Teixeira', id: 'OP-1077', uid: '04B7E1A290', initials: 'BT', tone: '#FFD23F', ok: false, code: 'TREINAMENTO_VENCIDO' },
];
const MACHINE = 'P-01 · Prensa hidráulica';

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

function drawScreen(ctx, w, h, line1, line2, color) {
  ctx.fillStyle = '#04050A';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = '700 64px "Martian Mono"';
  ctx.textBaseline = 'middle';
  ctx.fillText(line1, 36, h * 0.38);
  ctx.fillStyle = '#7C8298';
  ctx.font = '500 34px "Martian Mono"';
  ctx.fillText(line2, 36, h * 0.72);
}

function init(el) {
  const stage = createStage(el, { fov: 30, exposure: 1.1 });
  const { scene, camera } = stage;
  el.classList.add('is-live');
  document.documentElement.classList.add('has-scene');

  addFloor(stage, { mirrorTint: 0x777d90 });
  highBays(scene, { count: 6, y: 4.6, z: -9, spread: 18 });

  scene.add(new THREE.HemisphereLight(0x9aa4c8, 0x050608, 0.3));
  const key = new THREE.SpotLight(0xfff1dc, 240, 0, 0.5, 0.85, 2);
  key.position.set(-1.5, 7.2, 5);
  key.target.position.set(1.4, 1, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xd8deff, 0.35);
  fill.position.set(-2, 2, 6);
  scene.add(fill);
  // a cold rim from behind the machine separates its silhouette from the dark hall
  const rim = new THREE.PointLight(0x9fb0ff, 34, 0, 2);
  rim.position.set(4.2, 3.6, -2.8);
  scene.add(rim);

  // The machine: a powder-coated cabinet in front of a taller body.
  const coat = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.35, envMapIntensity: 0.6 });
  const machine = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.2, 3.1, 1.2, 6, 0.08), coat(0x12151d, 0.62));
  body.position.set(0.55, 1.55, -1.05);
  const cabinet = new THREE.Mesh(new RoundedBoxGeometry(1.5, 2.3, 0.7, 6, 0.07), coat(0x1b2030));
  cabinet.position.set(0, 1.15, -0.3);
  // a yellow guard rail along the cabinet base
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0xffc21f, roughness: 0.5, metalness: 0.2 }));
  rail.position.set(0, 0.32, 0.07);
  machine.add(body, cabinet, rail);

  // Reader: gloss black plastic, a backlit screen and the antenna pad.
  const reader = new THREE.Group();
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.52, 0.74, 0.1, 6, 0.045),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0d12, roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 })
  );
  const screenTex = canvasTexture(768, 320, (ctx, w, h) => drawScreen(ctx, w, h, 'APROXIME O CARTÃO', MACHINE, '#ECEEF4'));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.175), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(0, 0.2, 0.051);
  const padTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(200,206,222,.55)';
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
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: padTex, transparent: true, toneMapped: false }));
  pad.position.set(0, -0.12, 0.051);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x1a1d26, emissive: 0x000000, emissiveIntensity: 3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), ledMat);
  led.position.set(0.19, 0.33, 0.055);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.145, 64), new THREE.MeshBasicMaterial({ color: 0x8c9bff, transparent: true, opacity: 0, toneMapped: false }));
  ripple.position.set(0, -0.12, 0.06);
  reader.add(shell, screen, pad, led, ripple);
  reader.position.set(0, 1.28, 0.1);
  machine.add(reader);

  // Stack light: green, amber, red, read from the bottom up.
  const tower = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2f3c, roughness: 0.35, metalness: 0.8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 16), darkMetal);
  pole.position.y = 0.15;
  tower.add(pole);
  const lampDefs = [
    { key: 'g', color: 0x22d07b, y: 0.38 },
    { key: 'y', color: 0xffc21f, y: 0.54 },
    { key: 'r', color: 0xff3d2e, y: 0.7 },
  ];
  const lamps = {};
  lampDefs.forEach((d) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(d.color).multiplyScalar(0.35),
      emissive: d.color,
      emissiveIntensity: 0.06,
      roughness: 0.25,
      transmission: 0,
      clearcoat: 1,
    });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.15, 32), mat);
    lamp.position.y = d.y;
    const light = new THREE.PointLight(d.color, 0, 0, 2);
    light.position.set(0, d.y, 0.25);
    tower.add(lamp, light);
    lamps[d.key] = { mat, light };
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 32), darkMetal);
  cap.position.y = 0.8;
  tower.add(cap);
  tower.position.set(-0.55, 2.3, -0.3);
  machine.add(tower);

  // Details every shop machine has: an ID plate, a hazard sticker and an emergency stop.
  const plateTex = canvasTexture(768, 200, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3A4152');
    g.addColorStop(1, '#232838');
    roundRect(ctx, 0, 0, w, h, 26);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
    [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = '#9AA0B2'; ctx.fill();
    });
    ctx.fillStyle = '#E8EAF0';
    ctx.font = '800 64px Archivo';
    ctx.textBaseline = 'middle';
    ctx.fillText('P-01', 56, h / 2 - 4);
    ctx.fillStyle = '#A6ACC0';
    ctx.font = '700 40px Archivo';
    ctx.fillText('PRENSA HIDRÁULICA', 236, h / 2 - 2);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.172), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4, metalness: 0.5, transparent: true }));
  plate.position.set(0, 2.0, 0.052);
  const hazardTex = canvasTexture(256, 232, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, 8); ctx.lineTo(w - 8, h - 8); ctx.lineTo(8, h - 8); ctx.closePath();
    ctx.fillStyle = '#FFD23F'; ctx.fill();
    ctx.lineWidth = 14; ctx.strokeStyle = '#0B0C10'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#0B0C10';
    ctx.fillRect(w / 2 - 9, 74, 18, 82);
    ctx.beginPath(); ctx.arc(w / 2, 186, 11, 0, Math.PI * 2); ctx.fill();
  });
  const hazard = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.18), new THREE.MeshStandardMaterial({ map: hazardTex, transparent: true, roughness: 0.5 }));
  hazard.position.set(0.48, 1.55, 0.052);
  const estop = new THREE.Group();
  const estopBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: 0xffc21f, roughness: 0.45 }));
  const estopNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 24), darkMetal);
  estopNeck.rotation.x = Math.PI / 2;
  estopNeck.position.z = 0.04;
  const estopHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xe0281a, roughness: 0.25, clearcoat: 1 })
  );
  estopHead.rotation.x = Math.PI / 2;
  estopHead.position.z = 0.07;
  estop.add(estopBase, estopNeck, estopHead);
  estop.position.set(-0.46, 1.55, 0.06);
  cabinet.add(plate, hazard, estop);
  plate.position.z = 0.352;
  hazard.position.z = 0.352;
  estop.position.z = 0.36;
  plate.position.y -= 1.15;
  hazard.position.y -= 1.15;
  estop.position.y -= 1.15;

  machine.position.set(1.7, 0, 0);
  scene.add(machine);
  const shadow = contactShadow(1.6, 0.7);
  shadow.position.set(1.7, 0.006, -0.3);
  scene.add(shadow);

  // Safety lane painted on the epoxy in front of the machine.
  const paint = new THREE.MeshStandardMaterial({ color: 0xffc21f, roughness: 0.6, metalness: 0 });
  [0.75, 1.25].forEach((z) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.07), paint);
    line.rotation.x = -Math.PI / 2;
    line.position.set(1.2, 0.004, z);
    scene.add(line);
  });

  // Cards: white PVC with a printed face.
  const cards = CARDS.map((c) => {
    const g = new THREE.Group();
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
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }),
      new THREE.MeshPhysicalMaterial({ color: 0xe9ebf1, roughness: 0.35, clearcoat: 0.6 })
    );
    slab.position.z = -0.004;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: cardFace(c), transparent: true, roughness: 0.32, metalness: 0 }));
    face.position.z = 0.0045;
    g.add(slab, face);
    g.visible = false;
    scene.add(g);
    return { ...c, g, face };
  });

  // Fonts arrive after the first draw: repaint the printed faces once they are ready.
  if (document.fonts) {
    Promise.all([
      document.fonts.load('800 64px Archivo'),
      document.fonts.load('700 64px "Martian Mono"'),
    ]).then(() => {
      cards.forEach((c) => { c.face.material.map = cardFace(c); c.face.material.needsUpdate = true; });
      setScreen('idle');
      stage.renderOnce();
    }).catch(() => {});
  }

  // State changes: screen text, LED, tower and the HTML verdict line.
  const verdictEl = document.querySelector('[data-scene-verdict]');
  const verdictText = verdictEl && verdictEl.querySelector('.scene-verdict__text');
  function setLamp(which) {
    Object.entries(lamps).forEach(([k, l]) => {
      const on = k === which;
      const to = { e: on ? 3.2 : 0.06, i: on ? 7 : 0 };
      if (window.gsap && !stage.reduce) {
        window.gsap.to(l.mat, { emissiveIntensity: to.e, duration: 0.35, ease: 'power2.out', overwrite: true });
        window.gsap.to(l.light, { intensity: to.i, duration: 0.35, ease: 'power2.out', overwrite: true });
      } else {
        l.mat.emissiveIntensity = to.e;
        l.light.intensity = to.i;
      }
    });
    ledMat.emissive.set(which === 'g' ? 0x22d07b : which === 'r' ? 0xff3d2e : which === 'y' ? 0xffc21f : 0x000000);
  }
  function setScreen(state, card) {
    const redraw = screenTex.userData.redraw;
    if (state === 'idle') redraw((c, w, h) => drawScreen(c, w, h, 'APROXIME O CARTÃO', MACHINE, '#ECEEF4'));
    if (state === 'read') redraw((c, w, h) => drawScreen(c, w, h, 'LENDO…', 'UID ' + card.uid, '#FFD23F'));
    if (state === 'ok') redraw((c, w, h) => drawScreen(c, w, h, 'LIBERADO', 'P-01 · AUTORIZADO', '#63E6A6'));
    if (state === 'no') redraw((c, w, h) => drawScreen(c, w, h, 'BLOQUEADO', card.code, '#FF7A6F'));
    if (verdictEl) {
      verdictEl.dataset.state = state === 'idle' ? '' : state;
      if (state === 'idle') verdictText.innerHTML = 'Leitora de <strong>P-01</strong> aguardando um cartão';
      if (state === 'read') verdictText.innerHTML = `<strong>${card.name}</strong> · UID ${card.uid}`;
      if (state === 'ok') verdictText.innerHTML = `<strong>Liberado</strong> · ${card.name} · motivo AUTORIZADO`;
      if (state === 'no') verdictText.innerHTML = `<strong>Bloqueado</strong> · ${card.name} · ${card.code}`;
    }
  }

  // Framing: machine to the right of the copy on wide screens, above it on tall ones.
  const frame = { camX: -0.3, camY: 1.95, camZ: 7.6, lookX: 0.3, lookY: 1.55, fov: 30 };
  function layout(w, h) {
    const aspect = w / h;
    if (aspect < 0.85) Object.assign(frame, { camX: 1.45, camY: 2.3, camZ: 9.5, lookX: 1.6, lookY: 1.15, fov: 40 });
    else if (aspect < 1.25) Object.assign(frame, { camX: 0.4, camY: 2.0, camZ: 8.8, lookX: 0.9, lookY: 1.3, fov: 32 });
    else Object.assign(frame, { camX: -0.3, camY: 1.95, camZ: 7.6, lookX: 0.3, lookY: 1.55, fov: 30 });
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
  }
  stage.onResize.push(layout);
  layout(stage.width, stage.height);

  const pointer = pointerTracker();
  const hero = el.closest('.hero') || el;
  const padWorld = new THREE.Vector3();
  stage.update = (t, dt) => {
    pointer.step(dt);
    const leave = leaveProgress(hero);
    camera.position.set(frame.camX + pointer.x * 0.3, frame.camY - pointer.y * 0.1 + leave * 0.5, frame.camZ + leave * 1.2);
    camera.lookAt(frame.lookX, frame.lookY, 0);
    machine.rotation.y = -0.32 + pointer.x * 0.06;
  };

  // Where the card hovers: just in front of the reader's antenna pad.
  function padPoint(dz) {
    machine.updateMatrixWorld(true);
    pad.getWorldPosition(padWorld);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(machine.quaternion);
    return padWorld.clone().addScaledVector(n, dz);
  }

  setScreen('idle');
  setLamp(null);

  if (stage.reduce || !window.gsap) {
    const c = cards[0];
    const p = padPoint(0.06);
    c.g.visible = true;
    c.g.position.copy(p);
    c.g.rotation.set(0, machine.rotation.y - 0.32, 0);
    setScreen('ok', c);
    setLamp('g');
    stage.update(0, 0);
    stage.renderOnce();
    if (verdictEl) verdictEl.hidden = false;
    return;
  }

  const gsap = window.gsap;
  function pass(c) {
    const tl = gsap.timeline();
    const near = () => padPoint(0.16);
    const touch = () => padPoint(0.035);
    tl.call(() => {
      c.g.visible = true;
      c.g.position.set(4.6, 2.6, 1.6);
      c.g.rotation.set(0.5, -1.1, 0.7);
      setScreen('idle');
      setLamp(null);
    })
      .to(c.g.position, { x: () => near().x, y: () => near().y, z: () => near().z, duration: 1.1, ease: 'expo.out' })
      .to(c.g.rotation, { x: 0, y: () => machine.rotation.y, z: -0.06, duration: 1.1, ease: 'expo.out' }, '<')
      .to(c.g.position, { x: () => touch().x, y: () => touch().y, z: () => touch().z, duration: 0.22, ease: 'power2.in' })
      .call(() => { setScreen('read', c); setLamp('y'); })
      .fromTo(ripple.scale, { x: 0.6, y: 0.6 }, { x: 2.4, y: 2.4, duration: 0.8, ease: 'power2.out' })
      .fromTo(ripple.material, { opacity: 0.9 }, { opacity: 0, duration: 0.8, ease: 'power2.out' }, '<')
      .call(() => { setScreen(c.ok ? 'ok' : 'no', c); setLamp(c.ok ? 'g' : 'r'); }, null, '-=0.1')
      .to(machine.position, c.ok
        ? { keyframes: { y: [0, 0.02, 0] }, duration: 0.4, ease: 'power2.out' }
        : { keyframes: { x: [1.7, 1.66, 1.74, 1.68, 1.71, 1.7] }, duration: 0.45, ease: 'none' })
      .to(c.g.position, { x: 4.4, y: 2.9, z: 1.4, duration: 0.8, ease: 'power3.in' }, '+=1.6')
      .to(c.g.rotation, { x: -0.4, y: -1.2, z: 0.6, duration: 0.8, ease: 'power3.in' }, '<')
      .call(() => { c.g.visible = false; setScreen('idle'); setLamp(null); });
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
      loop.play(t < second ? second : 0);
    });
  }

  stage.play();
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
  try { init(host); } catch (e) {
    // any failure falls back to the flat version of the hero
    document.documentElement.classList.remove('has-scene');
    host.classList.remove('is-live');
    host.querySelectorAll('canvas').forEach((c) => c.remove());
    console.error(e);
  }
}
