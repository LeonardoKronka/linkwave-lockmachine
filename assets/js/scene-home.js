/* LinkWave · cena da página inicial: a marca Encaixe em alumínio anodizado,
   as duas metades travam sobre o piso de epóxi espelhado e acompanham o ponteiro. */
import {
  THREE, webglOk, createStage, addFloor, contactShadow, highBays, pointerTracker, leaveTracker, whenOpen,
  yieldToBrowser, fallBack, loadEnvironment,
} from './scene-kit.js';

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
    curveSegments: 64,
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

function anodized(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 0.7,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.95,
  });
}

async function init(el) {
  const stage = createStage(el, { fov: 30 });
  const { scene, camera } = stage;
  el.classList.add('is-live');
  document.documentElement.classList.add('has-scene');
  await yieldToBrowser();

  const envReady = loadEnvironment(stage); // fetch + decode run while the mark is built
  await yieldToBrowser();


  // Light: a warm high-bay key, a cobalt rim behind the mark and an amber kick from the floor.
  scene.add(new THREE.HemisphereLight(0x9aa4c8, 0x050608, 0.35));
  const key = new THREE.SpotLight(0xfff1dc, 220, 0, 0.42, 0.85, 2);
  key.position.set(-1.6, 7.5, 4.5);
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0x2f45ff, 40, 0, 2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe4ff, 0.4);
  fill.position.set(1.5, 2.2, 6);
  scene.add(fill);
  const kick = new THREE.PointLight(0xffb43a, 9, 0, 2);
  scene.add(kick);
  await yieldToBrowser();

  // The mark: cobalt and safety-yellow halves inside a polished steel ring.
  const { ga, gb, sFront, sBack } = encaixeHalves();
  await yieldToBrowser();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x20253a, metalness: 1, roughness: 0.16, clearcoat: 1, envMapIntensity: 1.8 });
  const mark = new THREE.Group();
  const halfA = new THREE.Mesh(ga, anodized(0x2f45ff));
  const halfB = new THREE.Mesh(gb, anodized(0xffc81f));
  const seam = new THREE.Group();
  seam.add(new THREE.Mesh(sFront, steel), new THREE.Mesh(sBack, steel));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.09, 0.055, 28, 200), steel);
  mark.add(halfA, halfB, seam, ring);
  const SCALE = 0.74;
  mark.scale.setScalar(SCALE);
  const RADIUS = 1.145 * SCALE; // outer edge of the ring
  const holder = new THREE.Group(); // holder moves with pointer and scroll, mark keeps its own idle motion
  holder.add(mark);
  scene.add(holder);

  // the floor comes after the geometry (see addFloor in scene-kit.js)
  const floor = addFloor(stage, { mirrorTint: 0x9298ae, reach: 3.6, floorFade: 0.12, clear: 0.4 });
  highBays(scene, { count: 6, y: 4.4, z: -9, spread: 18 });
  const shadow = contactShadow(1.05, 0.9, 1.25);
  scene.add(shadow);

  // Framing: the mark stands just above the floor so its reflection reads right under it.
  // Wide screens keep the copy on the left and give the right side to the mark and its reflection;
  // tall screens put the mark above the copy. fx/fy: where the mark's centre sits on screen (0..1).
  const HEIGHT = RADIUS + 0.06;
  const shots = {
    wide: { fx: 0.71, fy: 0.42, camY: 1.25, camZ: 7.8 },
    mid: { fx: 0.62, fy: 0.3, camY: 1.3, camZ: 9.6 },
    tall: { fx: 0.5, fy: 0.245, camY: 1.3, camZ: 14 },
  };
  const frame = { x: 0, lookY: 0.6, camY: 1.25, camZ: 8 };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const probe = new THREE.Vector3();

  function aim(shot) {
    camera.position.set(0, shot.camY, shot.camZ);
    // look height that puts the mark's centre at fy (bisection: looking higher moves things down)
    const targetY = 1 - shot.fy * 2;
    let lo = -4;
    let hi = 5;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      camera.lookAt(0, mid, 0);
      camera.updateMatrixWorld();
      probe.set(0, HEIGHT, 0).project(camera);
      if (probe.y > targetY) lo = mid; else hi = mid;
    }
    frame.lookY = (lo + hi) / 2;
    camera.lookAt(0, frame.lookY, 0);
    camera.updateMatrixWorld();
    // horizontal place for fx, on the mark's own plane
    ndc.set(shot.fx * 2 - 1, targetY);
    ray.setFromCamera(ndc, camera);
    frame.x = ray.ray.intersectPlane(plane, hit) ? hit.x : 0;
    frame.camY = shot.camY;
    frame.camZ = shot.camZ;
  }

  function layout(w, h) {
    const aspect = w / h;
    aim(aspect < 0.85 ? shots.tall : aspect < 1.25 || w < 1021 ? shots.mid : shots.wide);
    holder.position.set(frame.x, HEIGHT, 0);
    shadow.position.set(frame.x, 0.006, 0.05);
    floor.setFocus(frame.x, 0);
    key.target.position.set(frame.x, HEIGHT, 0);
    rim.position.set(frame.x + 1.9, HEIGHT + 1.9, -2.4);
    kick.position.set(frame.x - 2.3, 0.35, 1.8);
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

  const pointer = pointerTracker();
  const leave = leaveTracker(el.closest('.hero') || el);
  stage.update = (t, dt) => {
    pointer.step(dt);
    pose();
    const out = leave();
    mark.rotation.y = -0.5 + Math.sin(t * 0.33) * 0.28 + pointer.x * 0.35 + out * 1.2;
    mark.rotation.x = -pointer.y * 0.1 + Math.sin(t * 0.21) * 0.04;
    mark.position.y = Math.sin(t * 0.8) * 0.02;
    holder.position.y = HEIGHT + out * 0.7;
    shadow.material.opacity = 1 - out * 0.7;
    camera.position.set(pointer.x * 0.35, frame.camY - pointer.y * 0.1 + out * 0.4, frame.camZ);
    camera.lookAt(0, frame.lookY + out * 0.25, 0);
    rim.intensity = 36 + Math.sin(t * 1.3) * 6;
  };

  // Everything is compiled before the first frame: no stall when the veil opens.
  if (stage.reduce) lock.k = 1;
  pose();
  await envReady;
  await stage.warmUp();
  stage.start();
  if (stage.reduce) return;

  whenOpen().then(() => {
    if (window.gsap) {
      window.gsap.to(lock, { k: 1, duration: 1.6, ease: 'expo.inOut', delay: 0.1 });
    } else {
      lock.k = 1;
    }
  });
}

const host = document.querySelector('[data-scene="home"]');
if (host && webglOk()) {
  // any failure falls back to the flat version of the hero
  init(host).catch((e) => fallBack(host, e));
}
