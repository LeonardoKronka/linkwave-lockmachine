/* LinkWave · cenas 3D: palco, piso de epóxi espelhado, luz e economia de bateria.
   Módulo ES sem etapa de build: three.js vem de assets/vendor/three (licença MIT). */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { Reflector } from '../vendor/three/Reflector.js';

export { THREE };

export const BG = 0x06070a;

export function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

/* A canvas drawn in 2D and used as a texture (card faces, reader screen, floor fade). */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.redraw = (fn) => {
    ctx.clearRect(0, 0, w, h);
    fn(ctx, w, h);
    tex.needsUpdate = true;
  };
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Stage: renderer + scene + camera bound to a host element.
   update(t, dt) runs only while the host is on screen and the tab is visible. */
export function createStage(host, { fov = 32, exposure = 1.05 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const maxDpr = coarse ? 1.6 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setClearColor(BG, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 9, 24);

  // Reflections come from a soft studio room: metals and clear coats pick up real highlights.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 80);

  const stage = {
    THREE, renderer, scene, camera, host,
    reduce, coarse,
    width: 1, height: 1,
    onResize: [],
    update: null,
    visible: true,
    running: false,
    renderOnce() { renderer.render(scene, camera); },
  };

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    stage.width = w;
    stage.height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    stage.onResize.forEach((fn) => fn(w, h));
    if (!stage.running) stage.renderOnce();
  }
  new ResizeObserver(resize).observe(host);

  // Frame loop: paused off-screen and in background tabs; reduced motion draws on demand only.
  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    if (!stage.running) return;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    t += dt;
    if (stage.update) stage.update(t, dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  stage.play = () => {
    if (stage.running || reduce) return;
    stage.running = true;
    clock.getDelta();
    requestAnimationFrame(frame);
  };
  stage.pause = () => { stage.running = false; };

  new IntersectionObserver(([entry]) => {
    stage.visible = entry.isIntersecting;
    if (stage.visible && !document.hidden) stage.play(); else stage.pause();
  }, { rootMargin: '120px' }).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stage.pause(); else if (stage.visible) stage.play();
  });

  resize();
  return stage;
}

/* Polished epoxy floor: a soft mirror under a tinted, light-catching coat that fades into the dark. */
export function addFloor(stage, { size = 40, mirrorTint = 0x6b7080 } = {}) {
  const { scene, renderer } = stage;
  const res = stage.coarse ? 0.3 : 0.42; // a smaller mirror texture blurs the reflection like real epoxy
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: mirrorTint,
    multisample: stage.coarse ? 0 : 4,
  });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);

  const fade = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#6a6a6a');
    g.addColorStop(0.35, '#9a9a9a');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  fade.colorSpace = THREE.NoColorSpace;
  const coat = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0x0a0c11, roughness: 0.32, metalness: 0.1, transparent: true, alphaMap: fade, envMapIntensity: 0.35 })
  );
  coat.rotation.x = -Math.PI / 2;
  coat.position.y = 0.002;
  scene.add(coat);

  const sizeMirror = (w, h) => {
    const dpr = renderer.getPixelRatio();
    mirror.getRenderTarget().setSize(Math.round(w * dpr * res), Math.round(h * dpr * res));
  };
  stage.onResize.push(sizeMirror);
  sizeMirror(stage.width, stage.height);
  return { mirror, coat };
}

/* A soft dark blot that grounds an object on the floor. */
export function contactShadow(radius = 1.4, strength = 0.75) {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.35})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  return m;
}

/* High-bay light strips far back: they streak across the floor's reflection. */
export function highBays(scene, { count = 5, y = 6.5, z = -9, spread = 16, color = 0xfff3e2 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const geo = new THREE.BoxGeometry(2.4, 0.05, 0.22);
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-spread / 2 + (spread / (count - 1)) * i, y + (i % 2) * 0.35, z - (i % 3) * 1.4);
    group.add(m);
  }
  scene.add(group);
  return group;
}

/* Pointer as -1..1 on both axes, eased; touch devices stay centred. */
export function pointerTracker(target = window) {
  const p = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse) {
    target.addEventListener('pointermove', (e) => {
      p.tx = (e.clientX / window.innerWidth) * 2 - 1;
      p.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }
  p.step = (dt) => {
    const k = 1 - Math.exp(-dt * 3.2);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  };
  return p;
}

/* Scroll progress of an element leaving the top of the viewport (0 at rest, 1 when gone). */
export function leaveProgress(el) {
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
}

/* Resolves when the page's opening has revealed the scene (or right away without it). */
export function whenOpen() {
  return (window.LW && window.LW.ready) ? window.LW.ready : Promise.resolve();
}
