// Gera os arquivos da prensa a partir de caixa-leitora.js:
//   stl/prensa-*.stl      (9 peças, já na posição de impressão, prontas para o fatiador)
//   stl/tinkercad/*.stl   (as mesmas peças na posição de montagem + peças de referência, para ver no Tinkercad)
//   previa/modelo.json    (malhas e fios da prévia 3D no navegador)
// Uso, nesta pasta: npm install && npm run gerar
// Para mudar medidas: edite os valores "initial" em caixa-leitora.js ou passe JSON, ex.:
//   node gerar.js "{\"protoComprimento\": 170, \"usbX\": 48}"

const fs = require('fs')
const path = require('path')
const { geometries, measurements, modifiers, primitives } = require('@jscad/modeling')
const stl = require('@jscad/stl-serializer')
const caixa = require('./caixa-leitora.js')

// Costura a malha antes de exportar: põe nas arestas os vértices que as operações booleanas deixam
// no meio do vizinho (o fatiador aceita sem eles, mas a malha fica mais limpa) e divide tudo em triângulos.
const costurar = (g) => Object.assign(modifiers.generalize({ snap: true, triangulate: true }, g), { grupo: g.grupo, tipo: g.tipo, brilho: g.brilho, led: g.led })

const ajustes = process.argv[2] ? JSON.parse(process.argv[2]) : {}
const p = Object.assign(caixa.padroes(), ajustes)
const pasta = (nome) => {
  const d = path.join(__dirname, nome)
  fs.mkdirSync(d, { recursive: true })
  return d
}

const PECAS = [
  ['base', 'prensa-1-base.stl'],
  ['tampa', 'prensa-2-mesa.stl'],
  ['portico', 'prensa-3-portico.stl'],
  ['tampaMec', 'prensa-4-tampa-mecanismo.stl'],
  ['pistao', 'prensa-5-pistao.stl'],
  ['martelo', 'prensa-6-martelo.stl'],
  ['cilindro', 'prensa-7-cilindro.stl'],
  ['comando', 'prensa-8-caixa-comando.stl'],
  ['tampaComando', 'prensa-9-tampa-comando.stl'],
]

const gramas = (g) => Math.round((measurements.measureVolume(g) / 1000) * 1.24) // PLA: 1,24 g/cm³ (paredes finas saem quase maciças)
const pesos = {}
const dimensoes = {}
const salvar = (arquivo, ...geoms) => {
  const dados = stl.serialize({ binary: true }, ...geoms)
  fs.writeFileSync(arquivo, Buffer.concat(dados.map((d) => Buffer.from(d))))
}
const caixaDe = (g) => measurements.measureBoundingBox(g)
const r1 = (v) => +v.toFixed(1)

for (const [peca, nome] of PECAS) {
  const geometria = costurar(caixa.main(Object.assign({}, p, { peca })))
  salvar(path.join(pasta('stl'), nome), geometria)
  const [[x0, y0, z0], [x1, y1, z1]] = caixaDe(geometria)
  pesos[peca] = gramas(geometria)
  dimensoes[peca] = [r1(x1 - x0), r1(y1 - y0), r1(z1 - z0)]
  console.log(`${nome}: ${(x1 - x0).toFixed(1)} x ${(y1 - y0).toFixed(1)} x ${(z1 - z0).toFixed(1)} mm, ${geometries.geom3.toPolygons(geometria).length} polígonos, ~${pesos[peca]} g`)
}

/* ---------- Tinkercad: peças na posição de montagem ----------
   O Tinkercad (como os fatiadores) costuma recentralizar cada arquivo importado. Para as peças chegarem
   montadas mesmo assim, todo arquivo leva 2 cubinhos de 1 mm no chão, nos cantos opostos do conjunto inteiro:
   como todos os arquivos ficam com a mesma caixa externa, qualquer recentralização move todos igual.
   Estes arquivos são só para ver e medir; para imprimir, use os stl/prensa-*.stl (sem os cubinhos). */
const montadas = caixa.pecasMontadas(p).map(costurar)
const referencias = caixa.placas(p).map(costurar)
let gx0 = Infinity, gy0 = Infinity, gz0 = Infinity, gx1 = -Infinity, gy1 = -Infinity
for (const g of [...montadas, ...referencias]) {
  const [[x0, y0, z0], [x1, y1]] = caixaDe(g)
  gx0 = Math.min(gx0, x0); gy0 = Math.min(gy0, y0); gz0 = Math.min(gz0, z0)
  gx1 = Math.max(gx1, x1); gy1 = Math.max(gy1, y1)
}
const marcadores = [
  primitives.cuboid({ size: [1, 1, 1], center: [gx0 + 0.5, gy0 + 0.5, gz0 + 0.5] }),
  primitives.cuboid({ size: [1, 1, 1], center: [gx1 - 0.5, gy1 - 0.5, gz0 + 0.5] }),
]
const pastaTk = pasta(path.join('stl', 'tinkercad'))
for (const f of fs.readdirSync(pastaTk)) if (f.endsWith('.stl')) fs.unlinkSync(path.join(pastaTk, f))
const NOMES_TK = {
  base: '01-base', tampa: '02-mesa', portico: '03-portico', tampaMec: '04-tampa-mecanismo', pistao: '05-pistao',
  martelo: '06-martelo', cilindro: '07-cilindro', comando: '08-caixa-comando', tampaComando: '09-tampa-comando',
}
for (const g of montadas) salvar(path.join(pastaTk, `${NOMES_TK[g.grupo]}.stl`), g, ...marcadores)
// Peças compradas ou do kit, só como referência (não imprimir): ajudam a conferir se tudo cabe.
const REFS = [
  ['ref-a-protoboard-esp32', ['base']],
  ['ref-b-leitor-rfid', ['tampa']],
  ['ref-c-servo', ['servo', 'manivela']],
  ['ref-d-modulo-reles', ['comando']],
  ['ref-e-torre', ['torre']],
]
for (const [nome, grupos] of REFS) {
  const geoms = referencias.filter((g) => grupos.includes(g.grupo))
  if (geoms.length) salvar(path.join(pastaTk, `${nome}.stl`), ...geoms, ...marcadores)
}
console.log(`stl/tinkercad: ${montadas.length} peças + ${REFS.length} referências (conjunto de ${r1(gx1 - gx0)} x ${r1(gy1 - gy0)} mm)`)

// Prévia: cada peça vira uma lista de triângulos (x, y, z) com a sua cor e o seu grupo (que peça a carrega).
function malha(peca) {
  const g = costurar(peca)
  const pos = []
  for (const poligono of geometries.geom3.toPolygons(g)) {
    const v = poligono.vertices
    for (let i = 1; i < v.length - 1; i++) {
      for (const q of [v[0], v[i], v[i + 1]]) pos.push(+q[0].toFixed(2), +q[1].toFixed(2), +q[2].toFixed(2))
    }
  }
  const cor = (g.color || [0.6, 0.6, 0.6]).slice(0, 3).map((c) => +c.toFixed(3))
  const item = { cor, pos, grupo: g.grupo || 'base' }
  if (g.tipo === 'caixa') item.caixa = true
  if (g.brilho) item.brilho = true
  if (g.led) item.led = g.led
  return item
}

const m = caixa.medidas(p)
const previa = {
  medidas: {
    largura: +(m.We + 6).toFixed(1), comprimento: +(m.Le + 6).toFixed(1),
    alturaBase: +m.zTopoBase.toFixed(1), alturaMesa: +m.zTopoTampa.toFixed(1), alturaTotal: +(m.zTopo + 26).toFixed(1),
    larguraConjunto: +(m.cmd.x1 + 3 + m.We / 2 + 3).toFixed(1),
    alturaTorre: +(m.zTopoTampa + caixa.TORRE.alturaPe + caixa.TORRE.alturaHaste + caixa.TORRE.alturaBase
      + caixa.TORRE.gomos.reduce((a, b) => a + b, 0) + caixa.TORRE.alturaTopo).toFixed(1),
    vaoMartelo: +(p.alturaColunas - 24).toFixed(1),
    curso: m.curso,
    gramas: pesos,
    dimensoes,
  },
  explosao: caixa.EXPLOSAO,
  // O braço do servo gira em torno do eixo (paralelo a x); o pistão e o martelo descem 2 × manivela.
  mecanismo: { pivo: [m.xBraco, m.yR, m.zs].map((v) => +v.toFixed(2)), manivela: p.manivela, giram: ['manivela'], descem: ['pistao', 'martelo'] },
  pecas: [...caixa.pecasMontadas(p), ...caixa.placas(p)].map(malha),
  fios: caixa.fios(p),
}
fs.writeFileSync(path.join(pasta('previa'), 'modelo.json'), JSON.stringify(previa))
console.log(`previa/modelo.json gerado (${previa.pecas.length} malhas, ${previa.fios.length} fios)`)
