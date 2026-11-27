// Gera os arquivos da prensa a partir de caixa-leitora.js:
//   stl/prensa-*.stl      (5 peças, já na posição de impressão, prontas para o fatiador)
//   previa/modelo.json    (malhas e fios da prévia 3D no navegador)
// Uso, nesta pasta: npm install && npm run gerar
// Para mudar medidas: edite os valores "initial" em caixa-leitora.js ou passe JSON, ex.:
//   node gerar.js "{\"protoComprimento\": 170, \"usbX\": 48}"

const fs = require('fs')
const path = require('path')
const { geometries, measurements, modifiers } = require('@jscad/modeling')
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
]

const gramas = (g) => Math.round((measurements.measureVolume(g) / 1000) * 1.24) // PLA: 1,24 g/cm³ (paredes finas saem quase maciças)
const pesos = {}

for (const [peca, nome] of PECAS) {
  const geometria = costurar(caixa.main(Object.assign({}, p, { peca })))
  const dados = stl.serialize({ binary: true }, geometria)
  fs.writeFileSync(path.join(pasta('stl'), nome), Buffer.concat(dados.map((d) => Buffer.from(d))))
  const [[x0, y0, z0], [x1, y1, z1]] = measurements.measureBoundingBox(geometria)
  pesos[peca] = gramas(geometria)
  console.log(`${nome}: ${(x1 - x0).toFixed(1)} x ${(y1 - y0).toFixed(1)} x ${(z1 - z0).toFixed(1)} mm, ${geometries.geom3.toPolygons(geometria).length} polígonos, ~${pesos[peca]} g`)
}

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
    vaoMartelo: +(p.alturaColunas - 24).toFixed(1),
    curso: m.curso,
    gramas: pesos,
  },
  explosao: caixa.EXPLOSAO,
  // O braço do servo gira em torno do eixo (paralelo a x); o pistão e o martelo descem 2 × manivela.
  mecanismo: { pivo: [m.xBraco, m.yR, m.zs].map((v) => +v.toFixed(2)), manivela: p.manivela, giram: ['manivela'], descem: ['pistao', 'martelo'] },
  pecas: [...caixa.pecasMontadas(p), ...caixa.placas(p)].map(malha),
  fios: caixa.fios(p),
}
fs.writeFileSync(path.join(pasta('previa'), 'modelo.json'), JSON.stringify(previa))
console.log(`previa/modelo.json gerado (${previa.pecas.length} malhas, ${previa.fios.length} fios)`)
