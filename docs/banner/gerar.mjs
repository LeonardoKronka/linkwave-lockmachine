// Banner 70 × 90 cm da apresentação do TCC (LinkWave · LockMachine).
//
// Monta a arte com as logos do kit da marca (assets/brand) e as fontes do site (assets/fonts), com todo o
// texto convertido em curvas, e gera:
//   banner-lockmachine-70x90.svg   arte vetorial 710 × 910 mm (com 5 mm de sangria em cada lado)
//   banner-lockmachine-70x90.pdf   arquivo da gráfica: MediaBox/BleedBox 710 × 910 mm, TrimBox 700 × 900 mm
//   banner-lockmachine-previa.png  prévia feita a partir do próprio PDF, já refilada (700 × 900 mm)
//
// Uso (nesta pasta):  npm install   e depois   npm run gerar
// Opções: --guias desenha a área de segurança só na prévia (o PDF nunca leva guias).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import wawoff2 from 'wawoff2';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import puppeteer from 'puppeteer-core';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';

const RAIZ = new URL('../../', import.meta.url);
const aqui = (nome) => fileURLToPath(new URL(nome, import.meta.url));
const GUIAS = process.argv.includes('--guias');

// ---------------------------------------------------------------- medidas (mm)
const LARGURA = 700, ALTURA = 900, SANGRIA = 5;
const MARGEM = 48;                      // nada importante a menos de 48 mm da borda (bastão, ilhós, refile)
const X0 = MARGEM, X1 = LARGURA - MARGEM, UTIL = X1 - X0;

// ---------------------------------------------------------------- conteúdo
const URL_APP = 'https://somoslinkwave.com.br/lockmachine.html#app';
const EQUIPE = [
  ['Leonardo Kronka Rodrigues', 'Product Owner · Full-stack'],
  ['Cauê Henrique de Oliveira', 'Scrum Master · Back-end'],
  ['Evelyn Caporali Escanavaque', 'Front-end'],
  ['João Victor Monteiro Gamero', 'Banco de dados'],
  ['Gabriel Miranda', 'Documentação'],
];
// Orientação copiada do rodapé de lockmachine.html. Deixe '' para tirar a linha do banner.
const ORIENTACAO = 'Prof. Leonardo Oliveira Casellato, Prof. Ricardo Akira Harada e Prof. Wellinton Cardoso Teodoro';
const TEXTOS = {
  info: 'TCC · Técnico em Desenvolvimento de Sistemas · SENAI Mococa · 2026',
  lead: 'O cartão RFID identifica. O servidor confere:',
  confere: ['Cadastro ativo', 'Máquina disponível', 'Capacitações na validade'],
  registro: 'Toda tentativa fica registrada com o motivo.',
  etapas: [['Cartão RFID', '13,56 MHz'], ['Leitora', 'ESP32 + MFRC522'], ['Servidor', 'API PHP + MySQL'], ['App', 'Web e Android']],
  setas: ['UID', 'JSON', 'histórico'],
  app: ['Baixe o app', 'Aponte a câmera do celular.', 'somoslinkwave.com.br'],
};

// ---------------------------------------------------------------- cores (assets/css/styles.css)
const C = {
  fundo: '#06070A', painel: '#0F1219', painel2: '#151923', painel3: '#1C212D',
  texto: '#ECEEF4', texto2: '#A6ACC0', texto3: '#7D849C', escuro: '#0B0C10', papel: '#E9EBF2', tinta: '#11131F',
  cobalto: '#2F45FF', cobaltoLuz: '#8C9BFF', vermelho: '#FF3D2E', amarelo: '#FFD23F', verde: '#22D07B',
  appFundo: '#F4F5F8', linha: '#E6EAF5',
};
// No impresso, tons quase pretos se fundem: as linhas usam opacidade um pouco maior que a do site
const LINHA = 0.2, LINHA2 = 0.3;

// ---------------------------------------------------------------- fontes do site em curvas
const familias = {};
for (const [nome, arquivo] of [['archivo', 'archivo-latin.woff2'], ['mono', 'martianmono-latin.woff2']]) {
  const woff2 = readFileSync(new URL('assets/fonts/' + arquivo, RAIZ));
  familias[nome] = fontkit.create(Buffer.from(await wawoff2.decompress(woff2)));
}
const instancias = new Map();
function fonte(familia, wght, wdth) {
  const chave = `${familia}:${wght}:${wdth}`;
  if (!instancias.has(chave)) instancias.set(chave, familias[familia].getVariation({ wght, wdth }));
  return instancias.get(chave);
}

// Estilos: tam em mm (corpo da fonte), track em em
const E = {
  titulo: { familia: 'archivo', wght: 800, wdth: 106, track: -0.034 },
  h2: { familia: 'archivo', wght: 800, wdth: 106, track: -0.018, tam: 21 },
  h3: { familia: 'archivo', wght: 800, wdth: 106, track: -0.012, tam: 13.2 },
  lead: { familia: 'archivo', wght: 470, wdth: 100, track: 0, tam: 15.4 },
  check: { familia: 'archivo', wght: 650, wdth: 100, track: -0.004, tam: 15.4 },
  info: { familia: 'archivo', wght: 520, wdth: 100, track: 0, tam: 11 },
  nome: { familia: 'archivo', wght: 680, wdth: 100, track: -0.004, tam: 10.6 },
  papel: { familia: 'archivo', wght: 450, wdth: 100, track: 0, tam: 8.8 },
  selo: { familia: 'archivo', wght: 620, wdth: 100, track: 0.01, tam: 10.6 },
  mono: { familia: 'mono', wght: 500, wdth: 100, track: 0, tam: 8.4 },
  url: { familia: 'mono', wght: 500, wdth: 100, track: 0, tam: 10.4 },
};
const est = (base, extra) => ({ ...base, ...extra });

function moldar(str, e) {
  const f = fonte(e.familia, e.wght, e.wdth);
  const corrida = f.layout(str);
  const k = e.tam / f.unitsPerEm, esp = (e.track || 0) * e.tam;
  let x = 0;
  const glifos = corrida.glyphs.map((g, i) => {
    const p = corrida.positions[i];
    const item = { g, x: x + p.xOffset * k, y: p.yOffset * k };
    x += p.xAdvance * k + esp;
    return item;
  });
  return { glifos, k, largura: glifos.length ? x - esp : 0, avanco: x };
}

const n = (v) => Math.round(v * 100) / 100;
function curvas(m, x0, y0) {
  let d = '';
  for (const { g, x, y } of m.glifos) {
    const px = (a) => n(x0 + x + a * m.k), py = (b) => n(y0 - y - b * m.k);
    for (const c of g.path.commands) {
      const a = c.args;
      if (c.command === 'moveTo') d += `M${px(a[0])} ${py(a[1])}`;
      else if (c.command === 'lineTo') d += `L${px(a[0])} ${py(a[1])}`;
      else if (c.command === 'quadraticCurveTo') d += `Q${px(a[0])} ${py(a[1])} ${px(a[2])} ${py(a[3])}`;
      else if (c.command === 'bezierCurveTo') d += `C${px(a[0])} ${py(a[1])} ${px(a[2])} ${py(a[3])} ${px(a[4])} ${py(a[5])}`;
      else if (c.command === 'closePath') d += 'Z';
    }
  }
  return d;
}

// Texto em uma linha; y é a linha de base
function texto(str, e, x, y, { cor = C.texto, ancora = 'start', opacidade } = {}) {
  const m = moldar(str, e);
  const xi = ancora === 'end' ? x - m.largura : ancora === 'middle' ? x - m.largura / 2 : x;
  const op = opacidade != null ? ` fill-opacity="${opacidade}"` : '';
  return { svg: `<path fill="${cor}"${op} d="${curvas(m, xi, y)}"/>`, largura: m.largura, avanco: m.avanco, x: xi };
}
// Vários trechos na mesma linha, cada um com estilo e cor
function linhaMista(trechos, x, y, { ancora = 'start' } = {}) {
  const ms = trechos.map((t) => moldar(t.str, t.e));
  const total = ms.reduce((s, m, i) => s + (i < ms.length - 1 ? m.avanco : m.largura), 0);
  let cx = ancora === 'end' ? x - total : ancora === 'middle' ? x - total / 2 : x;
  let svg = '';
  ms.forEach((m, i) => { svg += `<path fill="${trechos[i].cor || C.texto}" d="${curvas(m, cx, y)}"/>`; cx += m.avanco; });
  return { svg, largura: total };
}
function quebrar(str, e, max) {
  const palavras = str.split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const tenta = atual ? atual + ' ' + p : p;
    if (atual && moldar(tenta, e).largura > max) { linhas.push(atual); atual = p; } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
// Parágrafo: \n força quebra; devolve a altura até a última linha de base
function paragrafo(str, e, x, y, { max = 1e9, entrelinha = 1.4, cor = C.texto, ancora = 'start' } = {}) {
  const linhas = str.split('\n').flatMap((p) => quebrar(p, e, max));
  const passo = e.tam * entrelinha;
  const svg = linhas.map((l, i) => texto(l, e, x, y + i * passo, { cor, ancora }).svg).join('');
  const larguras = linhas.map((l) => moldar(l, e).largura);
  return { svg, linhas, ultima: y + (linhas.length - 1) * passo, passo, largura: Math.max(...larguras) };
}

// ---------------------------------------------------------------- utilidades de desenho
const defs = [];
let nid = 0;
const id = (p) => `${p}${++nid}`;
function hex(c) { const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function mistura(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// Brilho de uma fonte de luz: degradê radial que some devagar (vetorial no PDF; nada de filtro de desfoque)
function brilho(cor, op, cx, cy, r, { sy = 1 } = {}) {
  const g = id('b');
  const paradas = [[0, 1], [0.18, 0.72], [0.38, 0.4], [0.6, 0.16], [0.8, 0.05], [1, 0]]
    .map(([o, f]) => `<stop offset="${o}" stop-color="${cor}" stop-opacity="${n(op * f * 1000) / 1000}"/>`).join('');
  defs.push(`<radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"` +
    (sy !== 1 ? ` gradientTransform="translate(0 ${n(cy)}) scale(1 ${sy}) translate(0 ${n(-cy)})"` : '') + `>${paradas}</radialGradient>`);
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r)}" ry="${n(r * sy)}" fill="url(#${g})"/>`;
}
function linear(paradas, { x1 = 0, y1 = 0, x2 = 1, y2 = 0, unidades = 'objectBoundingBox' } = {}) {
  const g = id('l');
  defs.push(`<linearGradient id="${g}" gradientUnits="${unidades}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    paradas.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('') + '</linearGradient>');
  return `url(#${g})`;
}
const ret = (x, y, w, h, r, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} ${extra}/>`;
const fio = (op = LINHA, w = 0.5) => `fill="none" stroke="${C.linha}" stroke-opacity="${op}" stroke-width="${w}"`;

// ---------------------------------------------------------------- logos do kit da marca
// Lê o SVG do kit: o símbolo entra como está e o nome é refeito em curvas com os mesmos parâmetros
// (Archivo 800, largura 108%, letter-spacing -0,02em, mesmas cores e posição).
function lockup(arquivo, x, y, altura) {
  const svg = readFileSync(new URL('assets/brand/' + arquivo, RAIZ), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const simbolo = svg.match(/<g transform="[^"]*">[\s\S]*?<\/g>/)[0];
  const t = svg.match(/<text([^>]*)>([\s\S]*?)<\/text>/);
  const attr = (nome) => t[1].match(new RegExp(` ${nome}="([^"]+)"`))[1];
  const estilo = attr('style');
  const val = (k) => parseFloat(estilo.match(new RegExp(k + ':(-?[\\d.]+)'))[1]);
  const e = { familia: 'archivo', wght: val('font-weight'), wdth: val('font-stretch'), track: val('letter-spacing'), tam: val('font-size') };
  const trechos = [...t[2].matchAll(/<tspan fill="([^"]+)">([^<]+)<\/tspan>/g)].map((m) => ({ str: m[2], e, cor: m[1] }));
  const nome = linhaMista(trechos, +attr('x'), +attr('y'));
  const k = altura / vb[3];
  return {
    svg: `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k * 10000) / 10000})">${simbolo}${nome.svg}</g>`,
    largura: (+attr('x') + nome.largura) * k,
  };
}

// ---------------------------------------------------------------- peças
// Selo "MVP em desenvolvimento": a pílula de status do site, com o ponto amarelo aceso
function selo(str, xFim, yMeio) {
  const e = E.selo, m = moldar(str, e);
  const h = 22, padE = 11, ponto = 4.2, gap = 7.5, padD = 12;
  const w = padE + ponto * 2 + gap + m.largura + padD;
  const x = xFim - w, y = yMeio - h / 2, cxp = x + padE + ponto;
  return ret(x, y, w, h, h / 2, `fill="${C.painel}" stroke="${C.linha}" stroke-opacity="${LINHA2}" stroke-width="0.6"`) +
    brilho(C.amarelo, 0.55, cxp, yMeio, 13) +
    `<circle cx="${n(cxp)}" cy="${n(yMeio)}" r="${ponto}" fill="${C.amarelo}"/>` +
    texto(str, e, cxp + ponto + gap, yMeio + e.tam * 0.36, { cor: C.texto }).svg;
}

// Título do site: "Sem capacitação válida, sem acesso." com "válida" na etiqueta de papel
function titulo(x, y, larguraMax) {
  const base = { ...E.titulo, tam: 100 };
  const pad = 0.16 * 100;
  const w1 = moldar('Sem capacitação', base).largura;
  const w2 = pad * 2 + moldar('válida', base).avanco + moldar(', sem acesso.', base).largura;
  const tam = Math.floor((larguraMax / Math.max(w1, w2)) * 1000) / 10;
  const e = { ...E.titulo, tam };
  const entre = 1.1 * tam;
  const y2 = y + entre;
  const p = 0.16 * tam;
  const mv = moldar('válida', e);
  // caixa da etiqueta (mesma geometria do .hl do site: padding .02em .16em .07em, raio .14em, -1.2°)
  const topo = y2 - 0.829 * tam, alt = 1.04 * tam, larg = mv.avanco + 2 * p;
  const etiqueta = `<g transform="rotate(-1.2 ${n(x)} ${n(topo + alt / 2)})">` +
    ret(x, topo, larg, alt, 0.14 * tam, `fill="${C.papel}"`) + '</g>';
  const svg = etiqueta +
    texto('Sem capacitação', e, x, y).svg +
    `<path fill="${C.escuro}" d="${curvas(mv, x + p, y2)}"/>` +
    texto(', sem acesso.', e, x + larg, y2).svg;
  return { svg, tam, ultima: y2 };
}

// Ícone de "confere" (círculo verde com visto)
function visto(cx, cy, r) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${C.verde}"/>` +
    `<path d="M${n(cx - r * 0.45)} ${n(cy + r * 0.02)}L${n(cx - r * 0.12)} ${n(cy + r * 0.34)}L${n(cx + r * 0.48)} ${n(cy - r * 0.32)}" fill="none" stroke="${C.escuro}" stroke-width="${n(r * 0.3)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Torre de sinalização (vermelho em cima, amarelo, verde embaixo), vista de frente, lentes estriadas
function torre(cx, topo, w, acesa) {
  const out = [], frente = [];
  const segH = w * 0.78, anel = w * 0.07, tampaH = w * 0.34, baseH = w * 0.36;
  const lentes = [['vermelho', C.vermelho], ['amarelo', C.amarelo], ['verde', C.verde]];
  let y = topo + tampaH;
  // tampa com o buzzer
  const tw = w * 0.92;
  frente.push(ret(cx - tw / 2, topo, tw, tampaH + 2, w * 0.16,
    `fill="${linear([[0, '#0C0E12'], [0.22, '#2A2F3A'], [0.5, '#3A404D'], [0.78, '#252A33'], [1, '#0C0E12']])}"`));
  frente.push(`<ellipse cx="${n(cx)}" cy="${n(topo + w * 0.05)}" rx="${n(tw * 0.42)}" ry="${n(w * 0.035)}" fill="#FFFFFF" fill-opacity="0.08"/>`);
  for (let i = 0; i < 4; i++) {
    const yy = topo + tampaH * (0.36 + i * 0.13);
    frente.push(ret(cx - w * 0.2, yy, w * 0.4, w * 0.022, w * 0.011, `fill="#05060A" fill-opacity="0.85"`));
  }
  const centros = {};
  for (const [nome, cor] of lentes) {
    // anel (junta entre módulos)
    frente.push(ret(cx - w * 0.52, y, w * 1.04, anel, anel * 0.4,
      `fill="${linear([[0, '#08090C'], [0.5, '#262A33'], [1, '#08090C']])}"`));
    y += anel;
    const ligada = nome === acesa;
    centros[nome] = y + segH / 2;
    const clip = id('c');
    defs.push(`<clipPath id="${clip}">${ret(cx - w / 2, y, w, segH, w * 0.05)}</clipPath>`);
    const claro = ligada ? mistura(cor, '#FFFFFF', 0.62) : mistura(cor, '#000000', 0.62);
    const meio = ligada ? cor : mistura(cor, '#000000', 0.76);
    const borda = ligada ? mistura(cor, '#000000', 0.38) : mistura(cor, '#000000', 0.88);
    let lente = ret(cx - w / 2, y, w, segH, w * 0.05,
      `fill="${linear([[0, borda], [0.2, meio], [0.48, claro], [0.56, claro], [0.8, meio], [1, borda]])}"`);
    // estrias verticais da lente
    const nE = 11;
    for (let i = 0; i <= nE; i++) {
      const xx = cx - w / 2 + (w * i) / nE;
      lente += ret(xx - w * 0.012, y, w * 0.024, segH, 0, `fill="#FFFFFF" fill-opacity="${ligada ? 0.16 : 0.05}"`);
      lente += ret(xx + w * 0.02, y, w * 0.018, segH, 0, `fill="#000000" fill-opacity="${ligada ? 0.1 : 0.18}"`);
    }
    // sombra no alto e embaixo de cada módulo
    lente += ret(cx - w / 2, y, w, segH, 0,
      `fill="${linear([[0, '#000000', 0.45], [0.16, '#000000', 0], [0.84, '#000000', 0], [1, '#000000', 0.45]], { x2: 0, y2: 1 })}"`);
    if (ligada) {
      const g = id('n');
      defs.push(`<radialGradient id="${g}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>`);
      lente += `<ellipse cx="${n(cx)}" cy="${n(y + segH / 2)}" rx="${n(w * 0.34)}" ry="${n(segH * 0.42)}" fill="url(#${g})"/>`;
    }
    frente.push(`<g clip-path="url(#${clip})">${lente}</g>`);
    y += segH;
  }
  frente.push(ret(cx - w * 0.52, y, w * 1.04, anel, anel * 0.4, `fill="${linear([[0, '#08090C'], [0.5, '#262A33'], [1, '#08090C']])}"`));
  y += anel;
  // base e flange de fixação
  frente.push(ret(cx - w * 0.47, y, w * 0.94, baseH, w * 0.04,
    `fill="${linear([[0, '#07080B'], [0.3, '#1F232B'], [0.5, '#2B303A'], [0.72, '#1A1D24'], [1, '#07080B']])}"`));
  y += baseH;
  frente.push(ret(cx - w * 0.68, y, w * 1.36, w * 0.09, w * 0.03, `fill="${linear([[0, '#0A0B0F'], [0.5, '#2E333D'], [1, '#0A0B0F']])}"`));
  const fim = y + w * 0.09;
  // luz da lente acesa (atrás da torre) e o reflexo no chão
  if (acesa) {
    const cor = lentes.find(([k]) => k === acesa)[1];
    out.push(brilho(cor, 0.36, cx, centros[acesa], w * 3.1));
    out.push(brilho(cor, 0.5, cx, centros[acesa], w * 1.25));
    out.push(brilho(cor, 0.22, cx, fim + w * 0.05, w * 1.6, { sy: 0.16 }));
  }
  return { svg: out.join('') + frente.join(''), fim, centros };
}

// Etiqueta de estado (palavra + ponto de luz), como a linha de verdito do site
function estado(str, cor, cx, y) {
  const e = est(E.selo, { wght: 700 }), m = moldar(str, e);
  const h = 21, w = 11 + 8 + 7 + m.largura + 12, x = cx - w / 2;
  return ret(x, y, w, h, h / 2, `fill="${C.painel}" stroke="${cor}" stroke-opacity="0.55" stroke-width="0.6"`) +
    brilho(cor, 0.6, x + 15, y + h / 2, 12) +
    `<circle cx="${n(x + 15)}" cy="${n(y + h / 2)}" r="4" fill="${cor}"/>` +
    texto(str, e, x + 26, y + h / 2 + e.tam * 0.36).svg;
}

// Ondas de RFID (três arcos)
function ondas(cx, cy, r, cor, larg, abertura = 46) {
  let s = '';
  for (const k of [0.42, 0.7, 1]) {
    const rr = r * k, a = (abertura * Math.PI) / 180;
    s += `<path d="M${n(cx + rr * Math.cos(-a))} ${n(cy + rr * Math.sin(-a))}A${n(rr)} ${n(rr)} 0 0 1 ${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}" fill="none" stroke="${cor}" stroke-width="${n(larg)}" stroke-linecap="round"/>`;
  }
  return s;
}

// Símbolo do LockMachine (do kit) em qualquer tamanho
const SIMBOLO_LM = readFileSync(new URL('assets/brand/lockmachine-simbolo.svg', RAIZ), 'utf8').match(/<g transform="[^"]*">[\s\S]*?<\/g>/)[0];
const simboloLM = (x, y, lado) => `<g transform="translate(${n(x)} ${n(y)}) scale(${n((lado / 48) * 10000) / 10000})">${SIMBOLO_LM}</g>`;

// 1. Cartão RFID (peça física: clara)
function iconeCartao(cx, cy) {
  const w = 82, h = w * (54 / 85.6);
  return `<g transform="rotate(-7 ${n(cx)} ${n(cy)})">` +
    ret(cx - w / 2, cy - h / 2, w, h, 4.6, `fill="${linear([[0, '#F4F5F8'], [1, '#D9DCE6']], { x2: 0, y2: 1 })}"`) +
    simboloLM(cx - w / 2 + 6.5, cy - h / 2 + 6.5, 11) +
    ret(cx - w / 2 + 7, cy - 1.5, 13, 10, 2, `fill="${linear([[0, '#E3C77A'], [1, '#B8963E']], { x2: 1, y2: 1 })}"`) +
    `<path d="M${n(cx - w / 2 + 7)} ${n(cy + 3.5)}h13M${n(cx - w / 2 + 13.5)} ${n(cy - 1.5)}v10" stroke="#8E7330" stroke-width="0.6"/>` +
    ondas(cx + w / 2 - 22, cy - 3, 13.5, '#5B6275', 1.9) +
    ret(cx - w / 2 + 7, cy + 13, 30, 3, 1.5, `fill="#AEB3C2"`) +
    ret(cx - w / 2 + 7, cy + 18.5, 19, 3, 1.5, `fill="#C4C8D4"`) +
    '</g>';
}
// 2. Leitora (caixa clara com a antena do MFRC522 e os LEDs da bancada)
function iconeLeitora(cx, cy) {
  const w = 58, h = 76;
  let s = ret(cx - w / 2, cy - h / 2, w, h, 8, `fill="${linear([[0, '#F4F5F8'], [1, '#D3D7E1']], { x2: 0, y2: 1 })}"`) +
    ret(cx - w / 2 + 7, cy - h / 2 + 8, w - 14, 40, 5, `fill="#DDE0E8" stroke="#B9BECB" stroke-width="0.6"`) +
    ondas(cx - 9, cy - h / 2 + 28, 17, '#5B6275', 2);
  const leds = [[C.verde, true], [C.amarelo, false], [C.vermelho, false]];
  leds.forEach(([cor, aceso], i) => {
    const x = cx - 13 + i * 13, y = cy + h / 2 - 15;
    if (aceso) s += brilho(cor, 0.9, x, y, 11);
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="3.3" fill="${aceso ? cor : mistura(cor, '#000000', 0.55)}" stroke="#9AA0B0" stroke-width="0.5"/>`;
  });
  return s;
}
// 3. Servidor (API PHP + MySQL): banco de dados e a API
function iconeServidor(cx, cy) {
  const rx = 25, ry = 7.5, h = 50, topo = cy - h / 2 - 2;
  const corpo = linear([[0, '#141823'], [0.5, '#2A3142'], [1, '#141823']]);
  let s = `<path d="M${n(cx - rx)} ${n(topo)}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${-h}" fill="${corpo}" stroke="${C.linha}" stroke-opacity="0.55" stroke-width="0.9"/>`;
  for (const f of [1 / 3, 2 / 3]) {
    s += `<path d="M${n(cx - rx)} ${n(topo + h * f)}a${rx} ${ry} 0 0 0 ${2 * rx} 0" fill="none" stroke="${C.linha}" stroke-opacity="0.45" stroke-width="0.9"/>`;
  }
  s += `<ellipse cx="${n(cx)}" cy="${n(topo)}" rx="${rx}" ry="${ry}" fill="#323A4D" stroke="${C.linha}" stroke-opacity="0.6" stroke-width="0.9"/>`;
  // luzes de atividade
  for (const [i, f] of [[0, 1 / 6], [1, 1 / 2], [2, 5 / 6]]) {
    const y = topo + h * f + ry * 0.55;
    s += `<circle cx="${n(cx + rx * 0.62)}" cy="${n(y)}" r="1.6" fill="${i === 1 ? C.verde : '#4B5366'}"/>`;
  }
  // selo da API sobre o banco
  const bw = 30, bh = 17, bx = cx - rx - 8, by = cy + 6;
  s += ret(bx, by, bw, bh, 4, `fill="${C.papel}"`) +
    texto('</>', est(E.mono, { wght: 700, tam: 9 }), bx + bw / 2, by + bh / 2 + 3.3, { cor: C.escuro, ancora: 'middle' }).svg;
  return s;
}
// 4. App (celular com o painel claro do app)
function iconeApp(cx, cy) {
  const w = 48, h = 86, x = cx - w / 2, y = cy - h / 2;
  let s = ret(x, y, w, h, 8, `fill="#1C212D" stroke="${C.linha}" stroke-opacity="0.35" stroke-width="0.6"`) +
    ret(x + 3, y + 3, w - 6, h - 6, 5.5, `fill="${C.appFundo}"`) +
    ret(cx - 6, y + 5.2, 12, 2.6, 1.3, `fill="#1C212D"`);
  s += simboloLM(x + 7, y + 11, 8) + ret(x + 18, y + 13.4, 16, 3, 1.5, `fill="#AEB3C2"`);
  const linhas = [C.verde, C.vermelho, C.verde, C.amarelo];
  linhas.forEach((cor, i) => {
    const yy = y + 25 + i * 13.5;
    s += ret(x + 6.5, yy, w - 13, 10.5, 2.6, `fill="#FFFFFF" stroke="#E1E4EC" stroke-width="0.4"`) +
      `<circle cx="${n(x + 12)}" cy="${n(yy + 5.25)}" r="2.2" fill="${cor}"/>` +
      ret(x + 17, yy + 2.6, 17, 2.2, 1.1, `fill="#B5BAC8"`) + ret(x + 17, yy + 6, 11, 1.8, 0.9, `fill="#D3D7E0"`);
  });
  return s;
}

// Seta de fluxo entre as estações
function seta(xa, xb, y, rotulo) {
  let s = `<path d="M${n(xa)} ${n(y)}H${n(xb - 1.5)}" fill="none" stroke="${C.texto3}" stroke-width="0.9" stroke-dasharray="2.2 2.6" stroke-linecap="round"/>` +
    `<path d="M${n(xb - 6)} ${n(y - 3.8)}L${n(xb)} ${n(y)}L${n(xb - 6)} ${n(y + 3.8)}" fill="none" stroke="${C.texto2}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (rotulo) s += texto(rotulo, est(E.mono, { tam: 7.2 }), (xa + xb) / 2, y - 5.5, { cor: C.texto3, ancora: 'middle' }).svg;
  return s;
}

// QR code numa etiqueta de papel (módulos escuros sobre claro: lê em qualquer câmera)
function qr(x, y, lado, url) {
  const codigo = QRCode.create(url, { errorCorrectionLevel: 'Q' });
  const tam = codigo.modules.size, dados = codigo.modules.data;
  const margem = lado * 0.085, mod = (lado - 2 * margem) / tam;
  let d = '';
  for (let r = 0; r < tam; r++) {
    let c = 0;
    while (c < tam) {
      if (!dados[r * tam + c]) { c++; continue; }
      let fim = c;
      while (fim < tam && dados[r * tam + fim]) fim++;
      d += `M${n(x + margem + c * mod)} ${n(y + margem + r * mod)}h${n((fim - c) * mod)}v${n(mod)}h${n(-(fim - c) * mod)}z`;
      c = fim;
    }
  }
  return {
    svg: ret(x, y, lado, lado, 5, `fill="${C.papel}"`) + `<path fill="${C.escuro}" d="${d}"/>`,
    versao: codigo.version, modulos: tam, modulo: mod,
  };
}

// ================================================================ composição (coordenadas da área final)
const arte = [];
arte.push(ret(-SANGRIA, -SANGRIA, LARGURA + 2 * SANGRIA, ALTURA + 2 * SANGRIA, 0, `fill="${C.fundo}"`));
// luz azul da LinkWave vindo do alto, à esquerda
arte.push(brilho(C.cobalto, 0.3, 40, -30, 470));

// Cada seção é desenhada a partir do próprio topo (y = 0) e depois posicionada: o cabeçalho encosta na margem de
// cima, a última seção na margem de baixo, e a altura que sobra vira o mesmo respiro entre elas, com uma linha fina no meio.
const problemas = [];
const capital = (tam) => 0.686 * tam;            // altura das maiúsculas da Archivo
const GAP = 16, SW = (UTIL - 3 * GAP) / 4;      // grade de 4 colunas do "Como funciona"
const coluna = (i) => X0 + i * (SW + GAP);

// ---- cabeçalho: LinkWave + selo
function cabecalho() {
  const s = [];
  const lw = lockup('linkwave-horizontal-escuro.svg', X0, 0, 44);
  s.push(lw.svg, selo('MVP em desenvolvimento', X1, 22));
  if (lw.largura > UTIL - 160) problemas.push('logo da LinkWave encosta no selo');
  s.push(texto(TEXTOS.info, E.info, X0, 44 + 19, { cor: C.texto2 }).svg);
  return { nome: 'cabeçalho', svg: s.join(''), altura: 44 + 19 + 3 };
}

// ---- LockMachine: marca, título, o que confere e a torre ao lado (alinhada à 4ª coluna)
function heroi() {
  const s = [];
  const COL = 446, TORRE_W = 82, TORRE_CX = coluna(3) + SW / 2;
  s.push(lockup('lockmachine-horizontal-escuro.svg', X0, 0, 50).svg);
  const tam = titulo(X0, 0, COL).tam;
  const tit = titulo(X0, 70 + capital(tam), COL);
  s.push(tit.svg);
  let y = tit.ultima + 44;
  const lead = texto(TEXTOS.lead, E.lead, X0, y, { cor: C.texto2 });
  s.push(lead.svg);
  y += 34;
  TEXTOS.confere.forEach((item, i) => {
    const linha = texto(item, E.check, X0 + 25, y);
    s.push(visto(X0 + 9, y - E.check.tam * 0.34, 8.6), linha.svg);
    if (25 + linha.largura > COL) problemas.push(`"${item}" passa da coluna`);
    if (i < TEXTOS.confere.length - 1) y += 24;
  });
  y += 36;
  const reg = texto(TEXTOS.registro, E.lead, X0, y, { cor: C.texto2 });
  s.push(reg.svg);
  if (Math.max(lead.largura, reg.largura) > COL) problemas.push('o texto do LockMachine passa da coluna');
  const t = torre(TORRE_CX, 4, TORRE_W, 'verde');
  s.push(t.svg, estado('Liberado', C.verde, TORRE_CX, t.fim + 11));
  return { nome: 'LockMachine', svg: s.join(''), altura: Math.max(y + 4, t.fim + 32) };
}

// ---- Como funciona: quatro etapas, nome e dado técnico
function como() {
  const s = [];
  const tamH = 17, ICONE_H = 92, ESCALA = 1.1;
  s.push(texto('Como funciona', est(E.h2, { tam: tamH }), X0, capital(tamH)).svg);
  const topoIcones = capital(tamH) + 10, cy = topoIcones + ICONE_H / 2;
  const icones = [[iconeCartao, 86], [iconeLeitora, 58], [iconeServidor, 66], [iconeApp, 48]];
  TEXTOS.etapas.forEach(([nome, tag], i) => {
    const cx = coluna(i) + SW / 2, [icone, larg] = icones[i];
    s.push(`<g transform="translate(${n(cx)} ${n(cy)}) scale(${ESCALA}) translate(${n(-cx)} ${n(-cy)})">${icone(cx, cy)}</g>`);
    if (i < icones.length - 1) {
      const cxProx = coluna(i + 1) + SW / 2;
      s.push(seta(cx + (larg / 2) * ESCALA + 7, cxProx - (icones[i + 1][1] / 2) * ESCALA - 7, cy, TEXTOS.setas[i]));
    }
    const yb = topoIcones + ICONE_H + 18;
    s.push(texto(nome, E.h3, cx, yb, { ancora: 'middle' }).svg);
    s.push(texto(tag, E.mono, cx, yb + 13, { cor: C.texto2, ancora: 'middle' }).svg);
  });
  return { nome: 'Como funciona', svg: s.join(''), altura: topoIcones + ICONE_H + 18 + 13 + 3 };
}

// ---- QR do app, equipe (alinhada à 3ª coluna) e orientação
function rodape() {
  const s = [];
  const QR_L = 112, codigo = qr(X0, 0, QR_L, URL_APP);
  s.push(codigo.svg);
  const xq = X0 + QR_L + 18, tamH = 19;
  s.push(texto(TEXTOS.app[0], est(E.h2, { tam: tamH }), xq, capital(tamH)).svg);
  const instrucao = texto(TEXTOS.app[1], est(E.lead, { tam: 11.2 }), xq, capital(tamH) + 18, { cor: C.texto2 });
  s.push(instrucao.svg);
  s.push(texto(TEXTOS.app[2], est(E.url, { tam: 9.6 }), xq, capital(tamH) + 18 + 17, { cor: C.texto }).svg);
  const xe = coluna(2), larguraEquipe = X1 - xe;
  if (xq + instrucao.largura > xe - 12) problemas.push('o texto do QR encosta na equipe');
  s.push(texto('Feito pela LinkWave', E.h3, xe, capital(E.h3.tam)).svg);
  const colNome = Math.max(...EQUIPE.map(([nome]) => moldar(nome, E.nome).largura)) + 9;
  let ye = capital(E.h3.tam) + 20;
  for (const [nome, papel] of EQUIPE) {
    s.push(texto(nome, E.nome, xe, ye).svg, texto(papel, E.papel, xe + colNome, ye, { cor: C.texto2 }).svg);
    ye += 14.6;
  }
  const larguraTabela = colNome + Math.max(...EQUIPE.map(([, papel]) => moldar(papel, E.papel).largura));
  if (larguraTabela > larguraEquipe) problemas.push(`tabela da equipe passa ${n(larguraTabela - larguraEquipe)} mm da margem`);
  let altura = Math.max(QR_L, ye - 14.6 + 3);
  if (ORIENTACAO) {
    const yo = altura + 22;
    const ori = linhaMista([
      { str: 'Orientação: ', e: est(E.papel, { wght: 650 }), cor: C.texto },
      { str: ORIENTACAO, e: E.papel, cor: C.texto2 },
    ], X0, yo);
    s.push(ori.svg);
    if (ori.largura > UTIL) problemas.push('a linha da orientação passa da margem');
    altura = yo + 2.6;
  }
  return { nome: 'QR e equipe', svg: s.join(''), altura, qr: { lado: QR_L, codigo } };
}

const secoes = [cabecalho(), heroi(), como(), rodape()];
const respiro = (ALTURA - 2 * MARGEM - secoes.reduce((t, s) => t + s.altura, 0)) / (secoes.length - 1);
if (respiro < 30) problemas.push(`pouco respiro entre as seções (${n(respiro)} mm)`);
const ocupado = [];                      // [nome, topo, base] de cada seção, para o relatório
let yAtual = MARGEM;
secoes.forEach((s, i) => {
  if (i > 0) arte.push(`<path d="M${X0} ${n(yAtual - respiro / 2)}H${X1}" ${fio(LINHA, 0.5)}/>`);
  arte.push(`<g transform="translate(0 ${n(yAtual)})">${s.svg}</g>`);
  ocupado.push([s.nome, n(yAtual), n(yAtual + s.altura)]);
  s.topo = yAtual;
  yAtual += s.altura + respiro;
});
const topoQR = secoes[3].topo, QR_L = secoes[3].qr.lado, codigoQR = secoes[3].qr.codigo;

// guias (só na prévia com --guias)
const guias = [
  ret(0, 0, LARGURA, ALTURA, 0, `fill="none" stroke="#FF00FF" stroke-width="0.6"`),
  ret(MARGEM, MARGEM, LARGURA - 2 * MARGEM, ALTURA - 2 * MARGEM, 0, `fill="none" stroke="#00FFFF" stroke-width="0.5" stroke-dasharray="4 3"`),
].join('');

// ================================================================ saída
function montarSVG(comGuias) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA + 2 * SANGRIA}mm" height="${ALTURA + 2 * SANGRIA}mm" ` +
    `viewBox="${-SANGRIA} ${-SANGRIA} ${LARGURA + 2 * SANGRIA} ${ALTURA + 2 * SANGRIA}">` +
    `<title>Banner LockMachine 70 × 90 cm · LinkWave</title><defs>${defs.join('')}</defs>${arte.join('')}${comGuias ? guias : ''}</svg>`;
}
const svg = montarSVG(false);
writeFileSync(aqui('banner-lockmachine-70x90.svg'), svg);

const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>` +
  `@page{size:${LARGURA + 2 * SANGRIA}mm ${ALTURA + 2 * SANGRIA}mm;margin:0}html,body{margin:0;padding:0;background:${C.fundo}}` +
  `svg{display:block;width:${LARGURA + 2 * SANGRIA}mm;height:${ALTURA + 2 * SANGRIA}mm}</style></head><body>`;

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
if (!CHROME) throw new Error('Chrome ou Edge não encontrado (defina CHROME_PATH).');
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
let pdfBruto;
try {
  const pagina = await navegador.newPage();
  await pagina.setContent(PAGINA + svg + '</body></html>', { waitUntil: 'load' });
  pdfBruto = await pagina.pdf({
    width: `${LARGURA + 2 * SANGRIA}mm`, height: `${ALTURA + 2 * SANGRIA}mm`, printBackground: true,
    preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1',
  });
  if (GUIAS) {
    // prévia com guias direto do SVG (só para conferir margens)
    await pagina.setViewport({ width: 710 * 2, height: 910 * 2, deviceScaleFactor: 1 });
    await pagina.setContent(`<body style="margin:0">${montarSVG(true).replace(/width="[^"]+mm" height="[^"]+mm"/, 'width="1420" height="1820"')}</body>`);
    await pagina.screenshot({ path: aqui('banner-guias.png') });
  }
} finally {
  await navegador.close();
}

// ---- caixas de impressão e metadados
const PT = 72 / 25.4;
const doc = await PDFDocument.load(pdfBruto);
if (doc.getPageCount() !== 1) throw new Error(`O PDF saiu com ${doc.getPageCount()} páginas.`);
const pag = doc.getPage(0);
const { width: wPt, height: hPt } = pag.getSize();
// O Chrome arredonda a página para pixels (fica ~0,1 mm maior). A arte começa no canto de cima à esquerda,
// então as caixas são medidas a partir do topo: MediaBox = BleedBox = 710 × 910 mm exatos, TrimBox 5 mm para dentro.
const W = (LARGURA + 2 * SANGRIA) * PT, H = (ALTURA + 2 * SANGRIA) * PT, base = hPt - H;
pag.setMediaBox(0, base, W, H);
pag.setCropBox(0, base, W, H);
pag.setBleedBox(0, base, W, H);
pag.setTrimBox(SANGRIA * PT, base + SANGRIA * PT, LARGURA * PT, ALTURA * PT);
doc.setTitle('Banner LockMachine 70 × 90 cm');
doc.setAuthor('LinkWave');
doc.setSubject('Banner da apresentação do TCC · Técnico em Desenvolvimento de Sistemas · SENAI Mococa · 2026');
doc.setKeywords(['LinkWave', 'LockMachine', 'TCC', 'banner 70x90']);
doc.setCreator('docs/banner/gerar.mjs (Chrome)');
doc.setLanguage('pt-BR');
const pdf = await doc.save();
writeFileSync(aqui('banner-lockmachine-70x90.pdf'), pdf);

// ---- versão sem sangria (para gráfica que imprime no tamanho da página): mesma arte, página = área final
const docSem = await PDFDocument.load(pdf);
const pagSem = docSem.getPage(0), area = [SANGRIA * PT, base + SANGRIA * PT, LARGURA * PT, ALTURA * PT];
pagSem.setMediaBox(...area); pagSem.setCropBox(...area); pagSem.setBleedBox(...area); pagSem.setTrimBox(...area);
docSem.setTitle('Banner LockMachine 70 × 90 cm (sem sangria)');
writeFileSync(aqui('banner-lockmachine-70x90-sem-sangria.pdf'), await docSem.save());

// ---- QR à parte (vetor e PNG), para montar outra versão do banner, como a do Gemini
{
  const c = QRCode.create(URL_APP, { errorCorrectionLevel: 'Q' }), t = c.modules.size, q = 4, lado = t + 2 * q;
  let d = '';
  for (let r = 0; r < t; r++) for (let col = 0; col < t; col++) if (c.modules.data[r * t + col]) d += `M${col + q} ${r + q}h1v1h-1z`;
  writeFileSync(aqui('qr-lockmachine-app.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado * 10}" height="${lado * 10}" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#FFFFFF"/><path fill="${C.escuro}" d="${d}"/></svg>`);
  const px = 30, tela = createCanvas(lado * px, lado * px), g = tela.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, lado * px, lado * px); g.fillStyle = C.escuro;
  for (let r = 0; r < t; r++) for (let col = 0; col < t; col++) if (c.modules.data[r * t + col]) g.fillRect((col + q) * px, (r + q) * px, px, px);
  writeFileSync(aqui('qr-lockmachine-app.png'), await tela.encode('png'));
}

// ---- conferência do PDF: varre todos os objetos, inclusive os aninhados (degradês, máscaras, grupos)
const fontes = [], imagens = [], espacos = new Set(), vistos = new Set();
function varrer(o) {
  if (o instanceof PDFRef) { if (vistos.has(o.tag)) return; vistos.add(o.tag); return varrer(doc.context.lookup(o)); }
  if (o instanceof PDFArray) { for (let i = 0; i < o.size(); i++) varrer(o.get(i)); return; }
  const dict = o instanceof PDFDict ? o : o?.dict;
  if (!(dict instanceof PDFDict)) return;
  const tipo = String(dict.get(PDFName.of('Type')) ?? ''), sub = String(dict.get(PDFName.of('Subtype')) ?? '');
  if (tipo === '/Font') fontes.push(String(dict.get(PDFName.of('BaseFont')) ?? sub));
  if (sub === '/Image') imagens.push(`${dict.get(PDFName.of('Width'))}×${dict.get(PDFName.of('Height'))} px`);
  const cs = dict.get(PDFName.of('ColorSpace'));
  if (cs && !(cs instanceof PDFDict)) espacos.add(cs instanceof PDFRef ? 'ICC/outro' : String(cs).split(/\s/)[0]);
  if (tipo === '/OutputIntent') espacos.add('OutputIntent');
  for (const k of dict.keys()) varrer(dict.get(k));
}
for (const [ref] of doc.context.enumerateIndirectObjects()) varrer(ref);

// ---- prévia a partir do PDF (pdf.js) e leitura do QR
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
async function renderizar(bytes, pxPorMm) {
  const d = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const p = await d.getPage(1);
  const vp = p.getViewport({ scale: pxPorMm / PT });
  const tela = createCanvas(Math.round(vp.width), Math.round(vp.height));
  await p.render({ canvas: tela, canvasContext: tela.getContext('2d'), viewport: vp }).promise;
  return tela;
}
const PX = 2;                                     // 2 px por mm: prévia de 1400 × 1800 px
const inteira = await renderizar(pdf, PX);
const previa = createCanvas(LARGURA * PX, ALTURA * PX);
previa.getContext('2d').drawImage(inteira, -SANGRIA * PX, -SANGRIA * PX);
writeFileSync(aqui('banner-lockmachine-previa.png'), await previa.encode('png'));

// QR: renderiza só a etiqueta em alta e decodifica
const alta = await renderizar(pdf, 6);
const ctx = alta.getContext('2d');
const qx = Math.round((X0 + SANGRIA - 6) * 6), qy = Math.round((topoQR + SANGRIA - 6) * 6), ql = Math.round((QR_L + 12) * 6);
const pix = ctx.getImageData(qx, qy, ql, ql);
const lido = jsQR(new Uint8ClampedArray(pix.data), ql, ql);

const mm = (v) => (v / PT).toFixed(1);
console.log(`PDF: ${mm(wPt)} × ${mm(hPt)} mm do Chrome → MediaBox/BleedBox 710 × 910 mm, TrimBox 700 × 900 mm`);
console.log(`Fontes no PDF: ${fontes.length ? fontes.join(', ') : 'nenhuma (texto em curvas)'}`);
console.log(`Imagens no PDF: ${imagens.length ? imagens.join(', ') : 'nenhuma (tudo vetorial)'}`);
console.log(`Espaços de cor: ${[...espacos].join(', ') || 'nenhum declarado'} (cores RGB; a gráfica converte para CMYK no RIP)`);
console.log('Também gerados: banner-lockmachine-70x90-sem-sangria.pdf (700 × 900 mm), qr-lockmachine-app.svg/.png');
if (fontes.length || imagens.length) process.exitCode = 1;
console.log(`QR: versão ${codigoQR.versao}, ${codigoQR.modulos} módulos de ${codigoQR.modulo.toFixed(2)} mm; leitura: ${lido ? lido.data : 'FALHOU'}`);
console.log(`Tamanho do PDF: ${(pdf.length / 1024).toFixed(0)} KB`);
console.log('Blocos (topo → base, mm da borda de cima):', ocupado.map(([nome, a, b]) => `${nome} ${a}→${b}`).join(' | '));
console.log(problemas.length ? 'ATENÇÃO: ' + problemas.join('; ') : 'Diagramação: nada encosta e tudo fica dentro da área de segurança.');
if (!lido || lido.data !== URL_APP || problemas.length) process.exitCode = 1;
