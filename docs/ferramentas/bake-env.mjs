/* Gera assets/img/env-room.png: o ambiente de reflexos das cenas 3D, pré-calculado.

   O que faz: abre o three.js do próprio site num Chromium sem janela, passa o RoomEnvironment pelo
   PMREMGenerator (cubo 128) e grava o atlas resultante (384 x 512) num PNG: metade de cima com o RGB e
   metade de baixo com o expoente comum de cada pixel. O site lê esse PNG em loadEnvironment()
   (assets/js/scene-kit.js), sem compilar os sombreadores do PMREM na hora (isso travava a abertura).

   Só é preciso rodar de novo se o three.js for atualizado ou se quiser outro ambiente. Opcional:
   o PNG já está no repositório e o site não depende de Node.

   Uso (precisa de Node e do Playwright; a pasta video/ já tem os dois):
     1. com o site rodando em http://localhost:5173 (php -S localhost:5173 na raiz do projeto)
     2. copie este arquivo para video/ (o Node procura o Playwright ao lado do script)
     3. cd video && node bake-env.mjs ../assets/img/env-room.png */
import fs from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] || 'env-room.png';
const base = process.env.LW_URL || 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.goto(base + '/assets/vendor/three/LICENSE');
const res = await page.evaluate(async () => {
  const THREE = await import('/assets/vendor/three/three.module.min.js');
  const { RoomEnvironment } = await import('/assets/vendor/three/RoomEnvironment.js');
  const renderer = new THREE.WebGLRenderer();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const setSize = pmrem._setSize;
  pmrem._setSize = () => setSize.call(pmrem, 128);
  const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
  const w = rt.width;
  const h = rt.height;
  const half = new Uint16Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, half);
  const f = THREE.DataUtils.fromHalfFloat;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h * 2;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h * 2);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const r = f(half[i * 4]);
    const g = f(half[i * 4 + 1]);
    const b = f(half[i * 4 + 2]);
    const m = Math.max(r, g, b);
    let eb = 0;
    if (m > 1e-7) {
      let e = Math.ceil(Math.log2(m));
      if (m / Math.pow(2, e) > 1) e += 1;
      eb = Math.min(255, Math.max(1, e + 128));
    }
    const s = eb ? 255 / Math.pow(2, eb - 128) : 0;
    d[i * 4] = Math.min(255, Math.round(r * s));
    d[i * 4 + 1] = Math.min(255, Math.round(g * s));
    d[i * 4 + 2] = Math.min(255, Math.round(b * s));
    d[i * 4 + 3] = 255;
    const j = (w * h + i) * 4;
    d[j] = eb; d[j + 1] = eb; d[j + 2] = eb; d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { w, h, url: c.toDataURL('image/png') };
});
fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`Pronto: ${out} (${res.w} x ${res.h * 2})`);
await browser.close();
