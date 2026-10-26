/* LinkWave · cenas 3D: palco, piso de epóxi espelhado, luz e economia de bateria.
   Módulo ES sem etapa de build: three.js vem de assets/vendor/three (licença MIT).

   Desempenho:
   - a montagem é feita em etapas curtas (yieldToBrowser) para a abertura da página não engasgar;
   - o ambiente de reflexos vem pré-calculado (img/env-room.png) e os sombreadores compilam em paralelo
     antes do primeiro quadro, inclusive os do espelho;
   - a cena desenha no mesmo tick do GSAP, junto com o ScrollSmoother, sem ler o layout a cada quadro;
   - se os quadros ficam lentos, a resolução cai um degrau (nunca volta, para não piscar);
   - fora da tela, em aba escondida ou com movimento reduzido, nada roda. */
import * as THREE from '../vendor/three/three.module.min.js';
import { Reflector } from '../vendor/three/Reflector.js';

export { THREE };

export const BG = 0x06070a;
/* Layer of small details: the main camera sees it, the floor mirror skips it (the mirror pass costs a whole render). */
export const DETAIL = 1;

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

/* Cheap check: the real test is creating the renderer, which throws and falls back to the flat hero. */
export function webglOk() {
  return !!(window.WebGL2RenderingContext || window.WebGLRenderingContext);
}

/* Gives the browser a turn between heavy steps (works in background tabs too, unlike rAF). */
export function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* A canvas drawn in 2D and used as a texture (card faces, screens, labels). */
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
  const deviceDpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({
    antialias: deviceDpr < 2.5, // only very dense screens are sharp enough without multisampling
    powerPreference: 'high-performance',
    stencil: false,
  });

  // A software rasterizer (no GPU, or acceleration turned off) would make the whole page crawl.
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
    renderer.dispose();
    throw new Error(`WebGL sem aceleração (${gpu}): usando a versão plana`);
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setClearColor(BG, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 9, 24);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 80);
  camera.layers.enable(DETAIL);

  // Resolution: device pixels, capped by a pixel budget, times the adaptive scale.
  const quality = {
    scale: 1,
    maxDpr: Math.min(deviceDpr, coarse ? 1.6 : 2),
    budget: coarse ? 1.8e6 : 4.2e6,
  };

  const stage = {
    THREE, renderer, scene, camera, host, quality, gpu,
    reduce, coarse,
    width: 1, height: 1,
    onResize: [],
    update: null,
    visible: true,
    running: false,
    armed: false,
    mirror: null,
    renderOnce() { renderer.render(scene, camera); },
  };

  function pixelRatio() {
    const byBudget = Math.sqrt(quality.budget / Math.max(1, stage.width * stage.height));
    return Math.max(0.5, Math.min(quality.maxDpr, byBudget) * quality.scale);
  }

  function applySize() {
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(stage.width, stage.height, false);
    camera.aspect = stage.width / stage.height;
    camera.updateProjectionMatrix();
    stage.onResize.forEach((fn) => fn(stage.width, stage.height));
  }

  function resize() {
    stage.width = Math.max(1, host.clientWidth);
    stage.height = Math.max(1, host.clientHeight);
    applySize();
    if (stage.armed && !stage.running) stage.renderOnce();
  }
  new ResizeObserver(resize).observe(host);

  // Compiles programs on the GPU's background threads (KHR_parallel_shader_compile) and waits for them.
  // three's compileAsync asks "ready?" right after queueing the compile, and that question makes the page
  // wait for the GPU (~150 ms on Windows/D3D11 on a first visit). Here the first question comes later.
  // Render targets must already exist (initRenderTarget): creating one also waits for pending compiles.
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  async function compileParallel(target, cam) {
    const materials = renderer.compile(target, cam);
    if (!parallel || !materials || !materials.forEach) return;
    for (let i = 0; i < 300 && materials.size; i++) {
      await new Promise((resolve) => setTimeout(resolve, i ? 16 : 40));
      materials.forEach((m) => {
        const program = renderer.properties.get(m).currentProgram;
        if (!program || program.isReady()) materials.delete(m);
      });
    }
  }

  // Uploads textures and compiles every program before the first frame, so nothing stalls mid-animation.
  // The mirror renders into a target without tone mapping: those variants are compiled too.
  // Textures go up one per task: a canvas upload is synchronous (a few ms to tens of ms each).
  stage.warmUp = async (extra = []) => {
    const textures = new Set(extra);
    if (scene.environment) textures.add(scene.environment);
    scene.traverse((o) => {
      const mats = o.material ? [].concat(o.material) : [];
      mats.forEach((m) => ['map', 'alphaMap', 'normalMap', 'emissiveMap'].forEach((key) => { if (m[key]) textures.add(m[key]); }));
    });
    for (const tex of textures) {
      renderer.initTexture(tex);
      await yieldToBrowser();
    }
    const jobs = [compileParallel(scene, camera)];
    if (stage.mirror) {
      renderer.setRenderTarget(stage.mirror.getRenderTarget());
      jobs.push(compileParallel(scene, stage.mirror.camera));
      renderer.setRenderTarget(null);
    }
    await Promise.all(jobs);
  };

  // Frame loop: driven by GSAP's ticker when present, so the scene and ScrollSmoother move in the same frame.
  const clock = new THREE.Clock(false);
  let t = 0;
  const samples = [];
  let warm = 0;
  function watch(raw) {
    // ignore stalls (tab switch, a long task): only a sustained slow median lowers the resolution
    if (raw > 0.2) { samples.length = 0; warm = 0; return; }
    if (warm < 60) { warm++; return; }
    samples.push(raw);
    if (samples.length < 50) return;
    samples.sort((a, b) => a - b);
    const median = samples[25];
    samples.length = 0;
    if (median > 1 / 42 && quality.scale > 0.56) {
      quality.scale *= 0.8;
      applySize();
      warm = 30;
    }
  }
  function tick() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    t += dt;
    if (stage.update) stage.update(t, dt);
    renderer.render(scene, camera);
    watch(raw);
  }
  const ticker = window.gsap && window.gsap.ticker;
  function rafLoop() {
    if (!stage.running) return;
    tick();
    requestAnimationFrame(rafLoop);
  }
  stage.play = () => {
    if (stage.running || reduce || !stage.armed) return;
    stage.running = true;
    clock.start();
    clock.getDelta();
    if (ticker) ticker.add(tick); else requestAnimationFrame(rafLoop);
  };
  stage.pause = () => {
    if (!stage.running) return;
    stage.running = false;
    if (ticker) ticker.remove(tick);
  };

  // Called once the scene is built and compiled: first frame, fade in, then the loop if on screen.
  stage.start = () => {
    stage.armed = true;
    if (stage.update) stage.update(0, 0);
    stage.renderOnce();
    host.classList.add('is-ready');
    if (stage.visible && !document.hidden) stage.play();
  };

  new IntersectionObserver(([entry]) => {
    stage.visible = entry.isIntersecting;
    if (stage.visible && !document.hidden) stage.play(); else stage.pause();
  }, { rootMargin: '120px' }).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stage.pause(); else if (stage.visible) stage.play();
  });

  resize();
  (window.LW3D = window.LW3D || []).push(stage); // handle for checks in the browser console
  return stage;
}

/* Soft studio reflections for metals and clear coats: three's RoomEnvironment, prefiltered (PMREM, cube 128)
   once and stored as assets/img/env-room.png (top half: RGB, bottom half: shared exponent). Baking it in the
   browser compiled heavy shaders and froze the opening for ~300 ms; reading the PNG costs ~15 ms. */
export async function loadEnvironment(stage, intensity = 0.55) {
  const res = await fetch(new URL('../img/env-room.png', import.meta.url));
  if (!res.ok) throw new Error('env-room.png: ' + res.status);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const w = bmp.width;
  const h = bmp.height / 2;
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const toHalf = THREE.DataUtils.toHalfFloat;
  const scale = new Float32Array(256);
  for (let e = 1; e < 256; e++) scale[e] = Math.pow(2, e - 128) / 255;
  const one = toHalf(1);
  const n = w * h * 4;
  const data = new Uint16Array(n);
  for (let i = 0; i < n; i += 4) {
    const s = scale[px[n + i]];
    data[i] = toHalf(px[i] * s);
    data[i + 1] = toHalf(px[i + 1] * s);
    data[i + 2] = toHalf(px[i + 2] * s);
    data[i + 3] = one;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.CubeUVReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  stage.scene.environment = tex;
  stage.scene.environmentIntensity = intensity;
  return tex;
}

/* Mirror shader for the epoxy: a soft 5-tap blur (the mirror renders at half resolution; the blur hides
   the stair steps and reads like a glossy floor) and a fade with distance from `focus`, so reflections
   are strongest right under the object and die out towards the camera, as on a real floor. */
const EpoxyShader = {
  name: 'EpoxyReflector',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    focus: { value: new THREE.Vector2(0, 0) },
    reach: { value: 3 },
    floorFade: { value: 0.15 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vXZ;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vec4 world = modelMatrix * vec4( position, 1.0 );
      vXZ = world.xz;
      gl_Position = projectionMatrix * viewMatrix * world;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform vec2 focus;
    uniform float reach;
    uniform float floorFade;
    varying vec4 vUv;
    varying vec2 vXZ;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      vec3 c = texture2D( tDiffuse, uv ).rgb * 0.4;
      c += texture2D( tDiffuse, uv + texel * vec2( 1.4, 0.5 ) ).rgb * 0.15;
      c += texture2D( tDiffuse, uv + texel * vec2( -1.4, -0.5 ) ).rgb * 0.15;
      c += texture2D( tDiffuse, uv + texel * vec2( -0.5, 1.4 ) ).rgb * 0.15;
      c += texture2D( tDiffuse, uv + texel * vec2( 0.5, -1.4 ) ).rgb * 0.15;
      float k = mix( 1.0, floorFade, smoothstep( 0.0, reach, distance( vXZ, focus ) ) );
      gl_FragColor = vec4( c * color * 2.0 * k, 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* Call addFloor after building the geometry: its render target is the first call that waits for the GPU,
   and a freshly created WebGL context keeps the GPU busy for ~0.1 s on its first use in a session.
   Polished epoxy floor: the blurred mirror above, under a dark coat that catches the lights (colour pools
   from lamps) and closes in towards the edges. Move both with setFocus(x, z) to where the object stands. */
export function addFloor(stage, { size = 40, mirrorTint = 0x8a90a4, reach = 3, floorFade = 0.15, clear = 0.45 } = {}) {
  const { scene, renderer } = stage;
  const res = stage.coarse ? 0.34 : 0.5;
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: mirrorTint,
    multisample: 0,
    shader: EpoxyShader,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.material.uniforms.reach.value = reach;
  mirror.material.uniforms.floorFade.value = floorFade;
  scene.add(mirror);
  stage.mirror = mirror;

  const grey = (v) => {
    const c = Math.round(Math.min(1, v) * 255);
    return `rgb(${c},${c},${c})`;
  };
  const fade = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, grey(clear));
    g.addColorStop(0.3, grey(clear + 0.25));
    g.addColorStop(1, grey(1));
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
  coat.layers.set(DETAIL);
  scene.add(coat);

  const texel = mirror.material.uniforms.texel.value;
  const sizeMirror = (w, h) => {
    const dpr = renderer.getPixelRatio();
    const tw = Math.max(64, Math.round(w * dpr * res));
    const th = Math.max(64, Math.round(h * dpr * res));
    mirror.getRenderTarget().setSize(tw, th);
    texel.set(1 / tw, 1 / th);
    renderer.initRenderTarget(mirror.getRenderTarget()); // allocated now, not while shaders compile (see compileParallel)
  };
  stage.onResize.push(sizeMirror);
  sizeMirror(stage.width, stage.height);

  const setFocus = (x, z) => {
    mirror.material.uniforms.focus.value.set(x, z);
    coat.position.set(x, 0.002, z);
  };
  return { mirror, coat, setFocus };
}

/* A soft dark blot that grounds an object on the floor. */
export function contactShadow(radius = 1.4, strength = 0.75, stretch = 1) {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.35})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2 * stretch, radius * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  m.layers.set(DETAIL);
  return m;
}

/* A soft round glow sprite: a cheap bloom for lamps and LEDs (additive, no post-processing pass). */
let glowTex = null;
export function glowSprite(color, size = 1, opacity = 1) {
  if (!glowTex) {
    glowTex = canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(255,255,255,.55)');
      g.addColorStop(0.45, 'rgba(255,255,255,.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  s.scale.setScalar(size);
  return s;
}

/* High-bay light strips far back: they streak across the floor's reflection. */
export function highBays(scene, { count = 5, y = 6.5, z = -9, spread = 16, color = 0xfff3e2 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const geo = new THREE.BoxGeometry(2.4, 0.05, 0.22);
  const bars = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(-spread / 2 + (spread / (count - 1)) * i, y + (i % 2) * 0.35, z - (i % 3) * 1.4);
    bars.setMatrixAt(i, m);
  }
  scene.add(bars);
  return bars;
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

/* How far an element has left the top of the viewport (0 at rest, 1 when gone).
   Read from ScrollTrigger, which already follows ScrollSmoother: no layout read per frame. */
export function leaveTracker(el) {
  const ST = window.ScrollTrigger;
  if (ST) {
    const st = ST.create({ trigger: el, start: 'top top', end: 'bottom top' });
    return () => st.progress;
  }
  return () => {
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  };
}

/* Resolves when the page's opening has revealed the scene (or right away without it). */
export function whenOpen() {
  return (window.LW && window.LW.ready) ? window.LW.ready : Promise.resolve();
}

/* Removes a half-built scene and brings back the flat hero. */
export function fallBack(host, err) {
  document.documentElement.classList.remove('has-scene');
  host.classList.remove('is-live', 'is-ready');
  host.querySelectorAll('canvas').forEach((c) => c.remove());
  if (err) console.warn(err);
}
