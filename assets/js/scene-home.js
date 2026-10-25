/* LinkWave · cena da página inicial: a marca Encaixe em alumínio anodizado,
   as duas metades travam sobre o piso de epóxi e acompanham o ponteiro. */
import {
  THREE, webglOk, createStage, addFloor, contactShadow, highBays, pointerTracker, leaveProgress, whenOpen,
} from './scene-kit.js';

const host = document.querySelector('[data-scene="home"]');
if (host && webglOk()) {
  try { init(host); } catch (e) {
    // any failure falls back to the flat version of the hero
    document.documentElement.classList.remove('has-scene');
    host.classList.remove('is-live');
    host.querySelectorAll('canvas').forEach((c) => c.remove());
    console.error(e);
  }
}

function encaixeHalves() {
  // Same geometry as the SVG mark: a circle split by an S of two half-circles (radius 1).
  const a = new THREE.Shape();
  a.moveTo(-1, 0);
  a.absarc(0, 0, 1, Math.PI, 0, true);
  a.absarc(0.5, 0, 0.5, 0, -Math.PI, true);
  a.absarc(-0.5, 0, 0.5, 0, Math.PI, false);

  const b = new THREE.Shape();
  b.moveTo(1, 0);
  b.absarc(0, 0, 1, 0, -Math.PI, true);
  b.absarc(-0.5, 0, 0.5, Math.PI, 0, true);
  b.absarc(0.5, 0, 0.5, -Math.PI, 0, false);

  const extrude = {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.035,
    bevelSegments: 6,
    curveSegments: 72,
  };
  const ga = new THREE.ExtrudeGeometry(a, extrude);
  const gb = new THREE.ExtrudeGeometry(b, extrude);
  [ga, gb].forEach((g) => { g.translate(0, 0, -0.21); g.computeVertexNormals(); });

  // The ink S of the logo becomes a dark inlay on both faces.
  const s = new THREE.Path();
  s.moveTo(-1, 0);
  s.absarc(-0.5, 0, 0.5, Math.PI, 0, true);
  s.absarc(0.5, 0, 0.5, Math.PI, Math.PI * 2, false);
  const pts = s.getPoints(96);
  const inlay = (z) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, z))), 160, 0.028, 12, false);
  return { ga, gb, sFront: inlay(0.275), sBack: inlay(-0.275) };
}

function anodized(color, env) {
  return new THREE.MeshPhysicalMaterial({
    color,
    envMap: env,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 0.7,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.95,
  });
}

function init(el) {
  const stage = createStage(el, { fov: 30 });
  const { scene, camera } = stage;
  el.classList.add('is-live');
  document.documentElement.classList.add('has-scene');

  addFloor(stage, { mirrorTint: 0x70768a });
  highBays(scene, { count: 6, y: 4.4, z: -9, spread: 18 });

  // Light: a warm high-bay key, a cobalt rim behind the mark and an amber kick from the floor.
  scene.add(new THREE.HemisphereLight(0x9aa4c8, 0x050608, 0.35));
  const key = new THREE.SpotLight(0xfff1dc, 220, 0, 0.42, 0.85, 2);
  key.position.set(-3.2, 7.5, 4.5);
  key.target.position.set(0.6, 1.2, 0);
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0x2f45ff, 40, 0, 2);
  rim.position.set(2.6, 2.9, -2.4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe4ff, 0.4);
  fill.position.set(1.5, 2.2, 6);
  scene.add(fill);
  const kick = new THREE.PointLight(0xffb43a, 9, 0, 2);
  kick.position.set(-1.6, 0.35, 1.8);
  scene.add(kick);

  // The mark: cobalt and safety-yellow halves inside a polished steel ring.
  const { ga, gb, sFront, sBack } = encaixeHalves();
  const env = scene.environment;
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x20253a, envMap: env, metalness: 1, roughness: 0.16, clearcoat: 1, envMapIntensity: 1.8 });
  const mark = new THREE.Group();
  const halfA = new THREE.Mesh(ga, anodized(0x2f45ff, env));
  const halfB = new THREE.Mesh(gb, anodized(0xffc81f, env));
  const seamA = new THREE.Mesh(sFront, steel);
  const seamB = new THREE.Mesh(sBack, steel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.09, 0.055, 32, 220), steel);
  const seam = new THREE.Group();
  seam.add(seamA, seamB);
  mark.add(halfA, halfB, seam, ring);
  mark.scale.setScalar(0.74);
  const holder = new THREE.Group(); // holder moves with pointer and scroll, mark keeps its own idle motion
  holder.add(mark);
  scene.add(holder);

  const shadow = contactShadow(1.15, 0.85);
  scene.add(shadow);

  // Framing: the mark sits right of the copy on wide screens, above it on tall ones.
  const frame = { x: 0.75, y: 1.32, camZ: 8.4, camY: 1.75, look: 1.1 };
  function layout(w, h) {
    const aspect = w / h;
    if (aspect < 0.85) {
      Object.assign(frame, { x: 0, y: 1.05, camZ: 10.6, camY: 1.15, look: -0.15 });
    } else if (aspect < 1.25) {
      Object.assign(frame, { x: 0.9, y: 1.0, camZ: 8.6, camY: 1.4, look: 0.55 });
    } else {
      Object.assign(frame, { x: 0.75, y: 1.32, camZ: 8.4, camY: 1.75, look: 1.1 });
    }
    holder.position.set(frame.x, frame.y, 0);
    shadow.position.set(frame.x, 0.006, 0);
    camera.position.set(0, frame.camY, frame.camZ);
    camera.lookAt(0, frame.look, 0);
  }
  stage.onResize.push(layout);
  layout(stage.width, stage.height);

  // Opening pose: halves apart, then they lock (encaixe) once the veil opens.
  const lock = { k: stage.reduce ? 1 : 0 };
  function pose() {
    const k = lock.k;
    const inv = 1 - k;
    seam.scale.setScalar(Math.max(0.001, (k - 0.6) / 0.4));
    halfA.position.set(-0.55 * inv, 0.62 * inv, 0.35 * inv);
    halfA.rotation.set(0.5 * inv, -0.6 * inv, 0.9 * inv);
    halfB.position.set(0.55 * inv, -0.62 * inv, -0.35 * inv);
    halfB.rotation.set(-0.5 * inv, 0.6 * inv, -0.9 * inv);
    ring.scale.setScalar(0.001 + k * 0.999);
    ring.rotation.set(Math.PI / 2 * inv, 0, 0);
  }
  pose();

  const pointer = pointerTracker();
  const hero = el.closest('.hero') || el;
  stage.update = (t, dt) => {
    pointer.step(dt);
    pose();
    const leave = leaveProgress(hero);
    mark.rotation.y = -0.5 + Math.sin(t * 0.33) * 0.28 + pointer.x * 0.35 + leave * 1.2;
    mark.rotation.x = -pointer.y * 0.14 + Math.sin(t * 0.21) * 0.05;
    mark.position.y = Math.sin(t * 0.8) * 0.045;
    holder.position.y = frame.y + leave * 0.6;
    shadow.material.opacity = 1 - leave * 0.6;
    camera.position.x = pointer.x * 0.35;
    camera.position.y = frame.camY + pointer.y * -0.12 + leave * 0.5;
    camera.lookAt(frame.x * 0.22, frame.look, 0);
    rim.intensity = 36 + Math.sin(t * 1.3) * 6;
  };

  if (stage.reduce) {
    stage.update(0, 0);
    stage.renderOnce();
    return;
  }

  stage.play();
  whenOpen().then(() => {
    if (window.gsap) {
      window.gsap.to(lock, { k: 1, duration: 1.6, ease: 'expo.inOut', delay: 0.1 });
    } else {
      lock.k = 1;
    }
  });
}
