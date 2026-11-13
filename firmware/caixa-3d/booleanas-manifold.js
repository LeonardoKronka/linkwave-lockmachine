// Troca as operações booleanas 3D do JSCAD (union, subtract, intersect) pelas do Manifold na hora de gerar os STL.
//
// Por quê: as booleanas do JSCAD deixam milhares de "juntas em T" (um vértice no meio da aresta do vizinho) e
// triângulos-agulha. O fatiador aceita, mas o Tinkercad e outros visualizadores desenham essas emendas como
// riscos em cima das faces planas, principalmente em volta das escritas. O Manifold sempre devolve uma malha
// fechada e limpa (cada aresta com exatamente 2 triângulos, sem triângulos degenerados).
//
// caixa-leitora.js continua igual e ainda abre no openjscad.xyz (lá ele usa as booleanas do próprio JSCAD).
// As operações 2D (contornos, letras) vão para o CrossSection do Manifold (Clipper2) e as 3D para o Manifold.
// Se alguma entrada não servir (sólido aberto), aquela operação volta para o JSCAD e o total aparece no fim.

const jscad = require('@jscad/modeling')
const { geom2, geom3, poly3 } = jscad.geometries

const originais = { ...jscad.booleans }
const estatistica = { manifold: 0, jscad: 0, clipper: 0, jscad2d: 0 }
let wasm = null

const achatar = (lista) => lista.reduce((acc, g) => acc.concat(Array.isArray(g) ? achatar(g) : [g]), [])

// geom3 do JSCAD (polígonos convexos, anti-horário visto de fora) -> sólido do Manifold.
function paraManifold(g) {
  const { Manifold, Mesh } = wasm
  const indice = new Map()
  const posicoes = []
  const triangulos = []
  const vertice = (v) => {
    const x = Math.fround(v[0]), y = Math.fround(v[1]), z = Math.fround(v[2])
    const chave = `${x},${y},${z}`
    let i = indice.get(chave)
    if (i === undefined) {
      i = posicoes.length / 3
      indice.set(chave, i)
      posicoes.push(x, y, z)
    }
    return i
  }
  for (const poligono of geom3.toPolygons(g)) {
    const ids = poligono.vertices.map(vertice)
    for (let k = 1; k < ids.length - 1; k++) triangulos.push(ids[0], ids[k], ids[k + 1])
  }
  const malha = new Mesh({ numProp: 3, vertProperties: new Float32Array(posicoes), triVerts: new Uint32Array(triangulos) })
  malha.merge()
  return new Manifold(malha) // lança erro se não for um sólido fechado
}

// Sólido do Manifold -> geom3 do JSCAD (só triângulos).
function paraJscad(m) {
  const malha = m.getMesh()
  const p = malha.vertProperties
  const t = malha.triVerts
  const n = malha.numProp
  const ponto = (i) => [p[i * n], p[i * n + 1], p[i * n + 2]]
  const poligonos = []
  for (let k = 0; k < t.length; k += 3) poligonos.push(poly3.create([ponto(t[k]), ponto(t[k + 1]), ponto(t[k + 2])]))
  return geom3.create(poligonos)
}

// Desenho 2D do JSCAD (contornos: de fora anti-horário, furos horário) -> CrossSection do Manifold (Clipper2).
// A regra "Positive" junta sozinha os traços que se sobrepõem (letras, ondas do cartão).
const paraSecao = (g) => new wasm.CrossSection(geom2.toOutlines(g).filter((c) => c.length > 2), 'Positive')

function paraGeom2(secao) {
  const lados = []
  for (const contorno of secao.toPolygons()) {
    for (let k = 0; k < contorno.length; k++) {
      const a = contorno[k], b = contorno[(k + 1) % contorno.length]
      lados.push([[a[0], a[1]], [b[0], b[1]]])
    }
  }
  return geom2.create(lados)
}

// Operação 2D no Clipper2: as booleanas 2D do JSCAD deixam contornos que se cruzam, e o texto extrudado
// a partir deles não fechava (não virava sólido), então a gravação inteira caía de volta para o JSCAD.
function comClipper(nome, operacao) {
  return (geoms, entrada) => {
    let secoes = []
    try {
      secoes = geoms.map(paraSecao)
      const resultado = operacao(secoes)
      const g = paraGeom2(resultado)
      resultado.delete()
      estatistica.clipper++
      return g
    } catch (erro) {
      estatistica.jscad2d++
      return originais[nome](...entrada)
    } finally {
      for (const s of secoes) s.delete()
    }
  }
}

// Roda a operação no Manifold; se qualquer entrada não for sólido fechado, usa a do JSCAD.
function comManifold(nome, operacao, operacao2d) {
  const em2d = comClipper(nome, operacao2d)
  return (...entrada) => {
    const geoms = achatar(entrada)
    if (wasm && geoms.length >= 2 && geoms.every(geom2.isA)) return em2d(geoms, entrada)
    if (!wasm || geoms.length < 2 || !geoms.every(geom3.isA)) return originais[nome](...entrada)
    const solidos = []
    try {
      for (const g of geoms) solidos.push(paraManifold(g))
    } catch (erro) {
      for (const s of solidos) s.delete()
      estatistica.jscad++
      return originais[nome](...entrada)
    }
    const resultado = operacao(solidos)
    const g = paraJscad(resultado)
    resultado.delete()
    for (const s of solidos) s.delete()
    estatistica.manifold++
    return g
  }
}

// Passa uma peça pronta pelo Manifold mais uma vez (junta tudo numa malha só e limpa o que sobrou).
function limpar(g) {
  if (!wasm) return g
  try {
    const m = paraManifold(g)
    const limpo = paraJscad(m)
    m.delete()
    return limpo
  } catch (erro) {
    return g
  }
}

async function ativar() {
  const { default: Module } = await import('manifold-3d')
  wasm = await Module()
  wasm.setup()
  const { Manifold, CrossSection } = wasm
  // Subtrai do primeiro a união de todos os outros (como o subtract do JSCAD).
  const menos = (Classe) => (s) => {
    const resto = s.length > 2 ? Classe.union(s.slice(1)) : s[1]
    const r = Classe.difference(s[0], resto)
    if (resto !== s[1]) resto.delete()
    return r
  }
  jscad.booleans.union = comManifold('union', (s) => Manifold.union(s), (s) => CrossSection.union(s))
  jscad.booleans.subtract = comManifold('subtract', menos(Manifold), menos(CrossSection))
  jscad.booleans.intersect = comManifold('intersect', (s) => Manifold.intersection(s), (s) => CrossSection.intersection(s))
}

module.exports = { ativar, limpar, estatistica }
