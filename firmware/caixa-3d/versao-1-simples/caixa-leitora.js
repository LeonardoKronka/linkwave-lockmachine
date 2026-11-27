// LockMachine · caixa da leitora RFID (base + tampa) para impressão 3D.
//
// A caixa guarda o protoboard montado como está (ESP32, ligações, LEDs e buzzer) e põe o leitor
// MFRC522 logo abaixo da tampa: o cartão é lido através de 1,2 mm de plástico.
//
// Abra este arquivo em https://openjscad.xyz (arraste para a página) para ver, mudar as medidas no
// painel de parâmetros e exportar o STL. Ou gere os STL no computador: `npm install` e `npm run gerar`.
//
// Medidas em milímetros. "Protoboard" = o conjunto de protoboards emendados, visto de cima,
// com o conector USB do ESP32 virado para a borda de cima (a parede do USB).

const jscad = require('@jscad/modeling')

const { roundedRectangle, rectangle, circle, cylinder, cuboid, arc } = jscad.primitives
const { union, subtract } = jscad.booleans
const { translate, rotateX, rotateZ } = jscad.transforms
const { extrudeLinear } = jscad.extrusions
const { expand } = jscad.expansions
const { vectorText } = jscad.text
const { path2 } = jscad.geometries
const { measureBoundingBox } = jscad.measurements
const { colorize } = jscad.colors

const getParameterDefinitions = () => [
  { name: 'peca', type: 'choice', caption: 'Mostrar', values: ['montada', 'aberta', 'base', 'tampa'],
    captions: ['Caixa montada (prévia)', 'Caixa aberta (prévia)', 'Base (para imprimir)', 'Tampa (para imprimir)'], initial: 'aberta' },
  { name: 'componentes', type: 'checkbox', caption: 'Mostrar placas na prévia', checked: true },
  { name: 'grupo1', type: 'group', caption: 'Protoboard e ESP32' },
  { name: 'protoLargura', type: 'float', initial: 100, step: 0.5, caption: 'Largura do protoboard' },
  { name: 'protoComprimento', type: 'float', initial: 165, step: 0.5, caption: 'Comprimento do protoboard' },
  { name: 'sobraEsp', type: 'float', initial: 4, step: 0.5, caption: 'ESP32 passando da borda de cima' },
  { name: 'usbX', type: 'float', initial: 50, step: 0.5, caption: 'Centro do USB: distância da borda esquerda' },
  { name: 'usbZ', type: 'float', initial: 15, step: 0.5, caption: 'Centro do USB: altura acima do fundo do protoboard' },
  { name: 'grupo2', type: 'group', caption: 'Caixa' },
  { name: 'alturaLivre', type: 'float', initial: 48, step: 1, caption: 'Altura livre dentro da caixa' },
  { name: 'folga', type: 'float', initial: 1.5, step: 0.1, caption: 'Folga em volta do protoboard' },
  { name: 'parede', type: 'float', initial: 2.2, step: 0.1, caption: 'Espessura das paredes' },
  { name: 'fundo', type: 'float', initial: 2, step: 0.1, caption: 'Espessura do fundo' },
  { name: 'raio', type: 'float', initial: 7, step: 0.5, caption: 'Raio dos cantos' },
  { name: 'grupo3', type: 'group', caption: 'Tampa' },
  { name: 'tampaEspessura', type: 'float', initial: 2.4, step: 0.1, caption: 'Espessura da tampa' },
  { name: 'sobreRfid', type: 'float', initial: 1.2, step: 0.1, caption: 'Plástico sobre o leitor RFID' },
  { name: 'encaixe', type: 'float', initial: 0.3, step: 0.05, caption: 'Folga do encaixe da tampa' },
  { name: 'ledDiametro', type: 'float', initial: 5, step: 0.5, caption: 'Diâmetro dos LEDs' },
  { name: 'buzzerDiametro', type: 'float', initial: 12, step: 0.5, caption: 'Diâmetro do buzzer' },
]

/* Posições na tampa, medidas a partir do canto de baixo à esquerda do protoboard (vista de cima).
   O leitor fica sobre a parte vazia do protoboard (embaixo à esquerda), onde sobra altura para os fios. */
const LEITOR = { largura: 39.5, comprimento: 60, x: 4, y: 8 }          // MFRC522 azul, conector virado para cima
const TORRE = { x: 76, yVerde: 32, passo: 12 }                          // LEDs: verde embaixo, amarelo, vermelho em cima
const BUZZER = { x: 76, y: 14 }
const MARCA = { x: 50, y: 136 }                                         // cadeado + "LockMachine"
const CABO = { x: 70, z: 32, raio: 5 }                                  // furo dos fios do relé / máquina (parede de baixo)
const USB = { largura: 14, altura: 15 }                                 // abertura do micro-USB (cabe a capa do plugue)
const GRAVACAO = 0.5                                                    // profundidade dos desenhos gravados

const SEG = 48

function medidas(p) {
  const Wi = p.protoLargura + 2 * p.folga
  const Li = p.protoComprimento + p.sobraEsp + 2 * p.folga
  const We = Wi + 2 * p.parede
  const Le = Li + 2 * p.parede
  const rInt = Math.max(1, p.raio - p.parede)
  const zTopoBase = p.fundo + p.alturaLivre
  return {
    Wi, Li, We, Le, rInt, zTopoBase,
    zTopoTampa: zTopoBase + p.tampaEspessura,
    // Converte coordenadas do protoboard (canto de baixo à esquerda) para coordenadas da caixa (centro em 0, 0).
    px: (x) => -Wi / 2 + p.folga + x,
    py: (y) => -Li / 2 + p.folga + y,
  }
}

const prisma = (forma2d, z0, z1) => translate([0, 0, z0], extrudeLinear({ height: z1 - z0 }, forma2d))

const retArredondado = (largura, altura, raio, centro = [0, 0]) =>
  roundedRectangle({ size: [largura, altura], roundRadius: Math.min(raio, Math.min(largura, altura) / 2 - 0.01), segments: SEG, center: centro })

const anel = (raioFora, raioDentro, centro) =>
  subtract(circle({ radius: raioFora, center: centro, segments: SEG }), circle({ radius: raioDentro, center: centro, segments: SEG }))

const traco = (pontos, largura) => expand({ delta: largura / 2, corners: 'round', segments: 12 }, path2.fromPoints({}, pontos))

/* Texto em traço simples, no maior tamanho que cabe em largura × altura (mm, contando o traço).
   Fica centralizado em (x, cy), ou começa em x com alinhar = 'esquerda'.
   O tamanho é medido, e não calculado, porque a fonte do JSCAD não segue a "height" pedida. */
function texto(conteudo, { largura, altura, traco: espessura, x, cy, alinhar = 'centro' }) {
  const linhas = (h) => vectorText({ height: h, input: conteudo }).filter((s) => s.length > 1)
  const pontos = linhas(10).flat()
  const larguraBruta = Math.max(...pontos.map((q) => q[0])) - Math.min(...pontos.map((q) => q[0]))
  const alturaBruta = Math.max(...pontos.map((q) => q[1])) - Math.min(...pontos.map((q) => q[1]))
  const escala = Math.min((largura - espessura) / larguraBruta, (altura - espessura) / alturaBruta)
  const forma = union(linhas(10 * escala).map((s) => traco(s, espessura)))
  const [[x0, y0], [x1, y1]] = measureBoundingBox(forma)
  const dx = alinhar === 'esquerda' ? x - x0 : x - (x0 + x1) / 2
  return translate([dx, cy - (y0 + y1) / 2, 0], forma)
}

/* Desenho do cartão RFID com as ondas: mostra onde encostar o cartão. */
function iconeCartao(cx, cy) {
  const contorno = subtract(retArredondado(34, 21.6, 2.6, [cx, cy]), retArredondado(31.8, 19.4, 1.6, [cx, cy]))
  const chip = retArredondado(6.4, 5, 1, [cx - 9, cy + 2])
  // O arco só aceita ângulos positivos: desenha de 0 a 1,7 rad e gira para ficar centrado na horizontal.
  const ondas = [3, 5.6, 8.2].map((r) =>
    translate([cx + 4, cy - 1.5, 0], rotateZ(-0.85,
      expand({ delta: 0.5, corners: 'round', segments: 12 }, arc({ radius: r, startAngle: 0, endAngle: 1.7, segments: 32 })))))
  return union(contorno, chip, ...ondas)
}

/* Cadeado do LockMachine (corpo, alça e fechadura). */
function iconeCadeado(cx, cy) {
  const corpo = subtract(retArredondado(13, 10.5, 2.6, [cx, cy - 2.5]), retArredondado(10.8, 8.3, 1.6, [cx, cy - 2.5]))
  const alca = expand({ delta: 0.55, corners: 'round', segments: 12 }, arc({ center: [cx, cy + 2.8], radius: 3.6, startAngle: 0, endAngle: Math.PI, segments: 32 }))
  const pernas = union(traco([[cx - 3.6, cy + 2.8], [cx - 3.6, cy + 2.1]], 1.1), traco([[cx + 3.6, cy + 2.8], [cx + 3.6, cy + 2.1]], 1.1))
  const fechadura = union(circle({ radius: 1.3, center: [cx, cy - 1.8], segments: 24 }), rectangle({ size: [1.1, 3], center: [cx, cy - 3.6] }))
  return union(corpo, alca, pernas, fechadura)
}

/* ======================= Base ======================= */

function base(p) {
  const m = medidas(p)
  const casca = prisma(retArredondado(m.We, m.Le, p.raio), 0, m.zTopoBase)
  const vazio = prisma(retArredondado(m.Wi, m.Li, m.rInt), p.fundo, m.zTopoBase + 1)

  // Abertura do micro-USB na parede de cima, alinhada com o conector do ESP32.
  const usb = cuboid({ size: [USB.largura, p.parede * 4, USB.altura], center: [m.px(p.usbX), m.Le / 2 - p.parede / 2, p.fundo + p.usbZ] })
  // Furo dos fios que saem para o relé / a máquina, na parede de baixo.
  const cabo = translate([m.px(CABO.x), -m.Le / 2 + p.parede / 2, p.fundo + CABO.z],
    rotateX(Math.PI / 2, cylinder({ radius: CABO.raio, height: p.parede * 4, segments: SEG })))
  // Rebaixo para a unha: ajuda a levantar a tampa.
  const unha = cuboid({ size: [18, p.parede * 4, 2.4], center: [0, -m.Le / 2 + p.parede / 2, m.zTopoBase - 1.2] })

  return subtract(casca, vazio, usb, cabo, unha)
}

/* ======================= Tampa ======================= */

function tampa(p) {
  const m = medidas(p)
  const z0 = m.zTopoBase
  const z1 = m.zTopoTampa
  const saiaEsp = 1.6
  const saiaAlt = 5

  const placa = prisma(retArredondado(m.We, m.Le, p.raio), z0, z1)

  // Saia que entra na base e segura a tampa no lugar.
  const saia = prisma(subtract(
    retArredondado(m.Wi - 2 * p.encaixe, m.Li - 2 * p.encaixe, m.rInt - p.encaixe),
    retArredondado(m.Wi - 2 * p.encaixe - 2 * saiaEsp, m.Li - 2 * p.encaixe - 2 * saiaEsp, m.rInt - p.encaixe - saiaEsp),
  ), z0 - saiaAlt, z0)

  // Berço do leitor RFID: rebaixo por baixo (sobra 1,2 mm em cima) + cantoneiras nos quatro cantos.
  // As cantoneiras descem 7 mm para a placa caber dos dois jeitos: costas na tampa (pinos para baixo)
  // ou componentes virados para a tampa (quando os pinos saem pelas costas); o cristal tem uns 4 mm.
  const lw = LEITOR.largura + 0.6
  const lc = LEITOR.comprimento + 0.6
  const lx = m.px(LEITOR.x + LEITOR.largura / 2)
  const ly = m.py(LEITOR.y + LEITOR.comprimento / 2)
  const cantoneiras = []
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      // 0,05 mm além da borda do rebaixo: faces encostadas criariam uma película de 0,01 mm na malha
      const cx = lx + sx * (lw / 2 + 0.65)
      const cy = ly + sy * (lc / 2 + 0.65)
      cantoneiras.push(rectangle({ size: [1.2, 9], center: [cx, cy - sy * 3.9] }))
      cantoneiras.push(rectangle({ size: [9, 1.2], center: [cx - sx * 3.9, cy] }))
    }
  }
  const berco = prisma(union(cantoneiras), z0 - 7, z0)
  const rebaixoRfid = prisma(rectangle({ size: [lw, lc], center: [lx, ly] }), z0 - 0.01, z1 - p.sobreRfid)

  // Torre de LEDs (verde embaixo, amarelo, vermelho em cima): tubos por baixo seguram cada LED pela aba.
  const ledX = m.px(TORRE.x)
  const ledYs = [0, 1, 2].map((i) => m.py(TORRE.yVerde + i * TORRE.passo))
  const raioFuroLed = p.ledDiametro / 2 + 0.15
  const raioTubo = p.ledDiametro / 2 + 0.55
  const tubos = prisma(union(ledYs.map((y) => anel(raioTubo + 1.2, raioTubo, [ledX, y]))), z0 - 4, z0)
  const furosLed = prisma(union(ledYs.map((y) => circle({ radius: raioFuroLed, center: [ledX, y], segments: SEG }))), z0 - 1, z1 + 1)

  // Buzzer: anel que segura por baixo e furinhos para o som.
  const bx = m.px(BUZZER.x)
  const by = m.py(BUZZER.y)
  const raioBuzzer = p.buzzerDiametro / 2 + 0.2
  const suporteBuzzer = prisma(anel(raioBuzzer + 1.6, raioBuzzer, [bx, by]), z0 - 6, z0)
  const pontosSom = [[0, 0]]
  for (let i = 0; i < 6; i++) pontosSom.push([3.4 * Math.cos((i * Math.PI) / 3), 3.4 * Math.sin((i * Math.PI) / 3)])
  const furosSom = pontosSom.map(([dx, dy]) => circle({ radius: 0.9, center: [bx + dx, by + dy], segments: 16 }))
  const somFuros = prisma(union(furosSom), z0 - 1, z1 + 1)

  // Desenhos gravados na face de cima.
  const rfidCentroY = ly - lc / 2 + 22  // antena: o lado oposto ao conector
  // Marca: cadeado à esquerda e o texto em duas linhas, o bloco todo centralizado em (mx, my).
  const mx = m.px(MARCA.x)
  const my = m.py(MARCA.y)
  const gravacoes = union(
    iconeCartao(lx, rfidCentroY + 3),
    texto('APROXIME AQUI', { largura: 42, altura: 5, traco: 0.8, x: lx, cy: rfidCentroY - 14 }),
    subtract(retArredondado(16, 3 * TORRE.passo + 6, 4, [ledX, ledYs[1]]), retArredondado(14, 3 * TORRE.passo + 4, 3, [ledX, ledYs[1]])),
    iconeCadeado(mx - 36, my - 0.7),
    texto('LockMachine', { largura: 66, altura: 9, traco: 1.2, x: mx - 23.5, cy: my + 4.5, alinhar: 'esquerda' }),
    texto('por LinkWave', { largura: 44, altura: 8, traco: 0.8, x: mx - 23.5, cy: my - 7.5, alinhar: 'esquerda' }),
  )
  const gravado = prisma(gravacoes, z1 - GRAVACAO, z1 + 1)

  return subtract(union(placa, saia, berco, tubos, suporteBuzzer), rebaixoRfid, furosLed, somFuros, gravado)
}

/* ======================= Placas (só para a prévia) ======================= */

function placas(p) {
  const m = medidas(p)
  const f = p.fundo
  const caixa = (x, y, w, l, z0, h, cor) =>
    colorize(cor, cuboid({ size: [w, l, h], center: [m.px(x + w / 2), m.py(y + l / 2), z0 + h / 2] }))
  const meio = p.protoLargura / 2
  const lw = LEITOR.largura
  const lc = LEITOR.comprimento
  const ledX = m.px(TORRE.x)
  const coresLed = [[0.13, 0.82, 0.48], [1, 0.82, 0.25], [1, 0.24, 0.18]]
  return [
    caixa(meio, 0, p.protoLargura - meio, p.protoComprimento, f, 9.5, [0.93, 0.93, 0.9]),            // protoboard grande
    caixa(0, p.protoComprimento / 2, meio, p.protoComprimento / 2, f, 9.5, [0.93, 0.93, 0.9]),        // protoboard pequeno
    caixa(p.usbX - 14.15, p.protoComprimento + p.sobraEsp - 51.5, 28.3, 51.5, f + 12, 1.6, [0.1, 0.1, 0.12]), // ESP32
    caixa(p.usbX - 6, p.protoComprimento + p.sobraEsp - 5, 12, 5, f + 13.6, 2.8, [0.75, 0.75, 0.78]), // micro-USB
    caixa(LEITOR.x, LEITOR.y, lw, lc, medidas(p).zTopoBase - 1.6 + (p.tampaEspessura - p.sobreRfid), 1.6, [0.12, 0.3, 0.75]), // MFRC522
    ...[0, 1, 2].map((i) => colorize(coresLed[i], cylinder({
      radius: p.ledDiametro / 2, height: 8.6, segments: 32,
      center: [ledX, m.py(TORRE.yVerde + i * TORRE.passo), m.zTopoBase + 4.3], // aba presa por baixo da tampa
    }))),
    colorize([0.1, 0.1, 0.1], cylinder({ radius: p.buzzerDiametro / 2, height: 9.5, segments: 32, center: [m.px(BUZZER.x), m.py(BUZZER.y), m.zTopoBase - 4.75] })),
  ]
}

/* ======================= Principal ======================= */

const COR_BASE = [0.11, 0.13, 0.18]
const COR_TAMPA = [1, 0.24, 0.18]

function main(params) {
  const p = Object.assign({}, padroes(), params)
  const m = medidas(p)
  if (p.peca === 'base') return base(p)
  if (p.peca === 'tampa') {
    // Para imprimir: de cabeça para baixo, com a face de cima na mesa (sem suportes).
    return translate([0, 0, m.zTopoTampa], rotateX(Math.PI, tampa(p)))
  }
  // "tipo" deixa a prévia separar a caixa das placas (o LED vermelho tem a mesma cor da tampa).
  const casca = (cor, g) => Object.assign(colorize(cor, g), { tipo: 'caixa' })
  const pecas = [casca(COR_BASE, base(p))]
  const t = casca(COR_TAMPA, tampa(p))
  const extras = p.componentes ? placas(p) : []
  if (p.peca === 'aberta') {
    // Tampa virada ao lado da base, mostrando por baixo o berço do leitor, os tubos dos LEDs e o buzzer.
    // O leitor, os LEDs e o buzzer ficam presos na tampa, então viram junto com ela.
    const presos = [t, ...extras.slice(4)]
    const virados = presos.map((g) => translate([m.We + 24, 0, m.zTopoTampa], rotateX(Math.PI, g)))
    return [...pecas, ...extras.slice(0, 4), ...virados]
  }
  return [...pecas, t, ...extras]
}

function padroes() {
  const r = {}
  for (const d of getParameterDefinitions()) {
    if (d.type === 'group') continue
    r[d.name] = d.type === 'checkbox' ? d.checked : d.initial
  }
  return r
}

module.exports = { main, getParameterDefinitions, base, tampa, placas, medidas, padroes }
