// LockMachine · caixa da leitora RFID em forma de prensa hidráulica (a P-01 do site), para impressão 3D.
//
// A base da prensa guarda o protoboard montado como está (ESP32, ligações e resistores). Em cima dela:
//   - tampa (a mesa da prensa): o leitor MFRC522 fica logo abaixo, e o cartão é lido através de 1,2 mm de plástico;
//   - pórtico (duas colunas + coroa): os LEDs ficam na frente da coroa, e os fios descem por dentro da coluna direita;
//   - martelo (amarelo) pendurado na coroa, sobre o lugar do cartão;
//   - cilindro hidráulico em cima da coroa (só decoração).
// São 5 peças, todas impressas sem suporte e encaixadas por pinos (uma gota de cola segura de vez).
//
// Abra este arquivo em https://openjscad.xyz (arraste para a página) para ver, mudar as medidas no
// painel de parâmetros e exportar o STL. Ou gere os STL no computador: `npm install` e `npm run gerar`.
//
// Medidas em milímetros. "Protoboard" = o conjunto de protoboards emendados, visto de cima,
// com o conector USB do ESP32 virado para a borda de trás (a parede do USB). A frente da prensa
// (onde a pessoa fica) é a borda oposta.

const jscad = require('@jscad/modeling')

const { roundedRectangle, rectangle, circle, cylinder, cuboid, arc } = jscad.primitives
const { union, subtract, intersect } = jscad.booleans
const { translate, rotateX, rotateY, rotateZ } = jscad.transforms
const { extrudeLinear } = jscad.extrusions
const { expand } = jscad.expansions
const { hull } = jscad.hulls
const { vectorText } = jscad.text
const { path2 } = jscad.geometries
const { measureBoundingBox } = jscad.measurements
const { colorize } = jscad.colors

const getParameterDefinitions = () => [
  { name: 'peca', type: 'choice', caption: 'Mostrar',
    values: ['montada', 'explodida', 'base', 'tampa', 'portico', 'martelo', 'cilindro'],
    captions: ['Prensa montada (prévia)', 'Prensa explodida (prévia)', 'Base (para imprimir)', 'Tampa / mesa (para imprimir)',
      'Pórtico (para imprimir)', 'Martelo (para imprimir)', 'Cilindro (para imprimir)'], initial: 'montada' },
  { name: 'componentes', type: 'checkbox', caption: 'Mostrar placas na prévia', checked: true },
  { name: 'grupo1', type: 'group', caption: 'Protoboard e ESP32' },
  { name: 'protoLargura', type: 'float', initial: 100, step: 0.5, caption: 'Largura do protoboard' },
  { name: 'protoComprimento', type: 'float', initial: 165, step: 0.5, caption: 'Comprimento do protoboard' },
  { name: 'sobraEsp', type: 'float', initial: 4, step: 0.5, caption: 'ESP32 passando da borda de trás' },
  { name: 'usbX', type: 'float', initial: 50, step: 0.5, caption: 'Centro do USB: distância da borda esquerda' },
  { name: 'usbZ', type: 'float', initial: 15, step: 0.5, caption: 'Centro do USB: altura acima do fundo do protoboard' },
  { name: 'grupo2', type: 'group', caption: 'Base' },
  { name: 'alturaLivre', type: 'float', initial: 48, step: 1, caption: 'Altura livre dentro da base' },
  { name: 'folga', type: 'float', initial: 1.5, step: 0.1, caption: 'Folga em volta do protoboard' },
  { name: 'parede', type: 'float', initial: 2.2, step: 0.1, caption: 'Espessura das paredes' },
  { name: 'fundo', type: 'float', initial: 2, step: 0.1, caption: 'Espessura do fundo' },
  { name: 'raio', type: 'float', initial: 7, step: 0.5, caption: 'Raio dos cantos' },
  { name: 'grupo3', type: 'group', caption: 'Mesa (tampa) e pórtico' },
  { name: 'tampaEspessura', type: 'float', initial: 2.4, step: 0.1, caption: 'Espessura da tampa' },
  { name: 'sobreRfid', type: 'float', initial: 1.2, step: 0.1, caption: 'Plástico sobre o leitor RFID' },
  { name: 'encaixe', type: 'float', initial: 0.3, step: 0.05, caption: 'Folga dos encaixes' },
  { name: 'alturaColunas', type: 'float', initial: 62, step: 1, caption: 'Altura das colunas (da mesa até a coroa)' },
  { name: 'ledDiametro', type: 'float', initial: 5, step: 0.5, caption: 'Diâmetro dos LEDs' },
  { name: 'buzzerDiametro', type: 'float', initial: 12, step: 0.5, caption: 'Diâmetro do buzzer' },
]

/* Posições medidas a partir do canto da frente à esquerda do protoboard (vista de cima). */
const LEITOR = { largura: 39.5, comprimento: 60, x: 30.25, y: 50 }   // MFRC522 centralizado, conector virado para trás
const ANTENA_Y = LEITOR.y + 22                                       // centro da antena: o lado oposto ao conector
const PORTICO = { y: ANTENA_Y, colunasX: [10, 90], colLargura: 14, colProf: 22, coroaLargura: 104, coroaProf: 30, coroaAltura: 20, chanfro: 4 }
const LEDS_X = [9, 17.5, 26]                                         // na coroa, a partir do centro: verde, amarelo, vermelho
const BUZZER = { x: 85, y: 148 }
const MARCA = { x: 50, y: 22 }                                       // cadeado + "LockMachine"
const CABO = { x: 85, z: 20, raio: 5 }                               // furo dos fios do relé (parede de trás, ao lado do USB)
const USB = { largura: 14, altura: 15 }                              // abertura do micro-USB (cabe a capa do plugue)
const ESP = { largura: 28.3, comprimento: 51.5, fileiras: 12.7, primeiroPino: 7 } // ESP32 DevKit de 30 pinos
const GRAVACAO = 0.5                                                 // profundidade dos desenhos gravados na mesa
const GRAVACAO_LADO = 0.6                                            // nas faces de pé

const SEG = 48

function medidas(p) {
  const Wi = p.protoLargura + 2 * p.folga
  const Li = p.protoComprimento + p.sobraEsp + 2 * p.folga
  const We = Wi + 2 * p.parede
  const Le = Li + 2 * p.parede
  const rInt = Math.max(1, p.raio - p.parede)
  const zTopoBase = p.fundo + p.alturaLivre
  const zTopoTampa = zTopoBase + p.tampaEspessura
  const px = (x) => -Wi / 2 + p.folga + x
  const py = (y) => -Li / 2 + p.folga + y
  // Pórtico
  const cy = py(PORTICO.y)
  const zC0 = zTopoTampa + p.alturaColunas
  const zC1 = zC0 + PORTICO.coroaAltura
  return {
    Wi, Li, We, Le, rInt, zTopoBase, zTopoTampa,
    // Converte coordenadas do protoboard (canto da frente à esquerda) para coordenadas da caixa (centro em 0, 0).
    px, py,
    cy,                                             // linha das colunas e do martelo
    colunasX: PORTICO.colunasX.map(px),
    zC0, zC1,                                       // embaixo e em cima da coroa
    zTopo: zC1 + PORTICO.chanfro,                   // topo da coroa, onde o cilindro encaixa
    yFrente: cy - PORTICO.coroaProf / 2,            // face da frente da coroa
    ledZ: zC0 + 10,
  }
}

const prisma = (forma2d, z0, z1) => translate([0, 0, z0], extrudeLinear({ height: z1 - z0 }, forma2d))

const retArredondado = (largura, altura, raio, centro = [0, 0]) =>
  roundedRectangle({ size: [largura, altura], roundRadius: Math.min(raio, Math.min(largura, altura) / 2 - 0.01), segments: SEG, center: centro })

const anel = (raioFora, raioDentro, centro) =>
  subtract(circle({ radius: raioFora, center: centro, segments: SEG }), circle({ radius: raioDentro, center: centro, segments: SEG }))

const moldura = (largura, altura, raio, linha, centro) =>
  subtract(retArredondado(largura, altura, raio, centro), retArredondado(largura - 2 * linha, altura - 2 * linha, Math.max(0.5, raio - linha), centro))

const traco = (pontos, largura) => expand({ delta: largura / 2, corners: 'round', segments: 12 }, path2.fromPoints({}, pontos))

// Cilindro deitado ao longo de y ou de x (o cylinder do JSCAD fica em pé, ao longo de z).
const cilindroY = (raio, comprimento, centro, segmentos = SEG) => translate(centro, rotateX(Math.PI / 2, cylinder({ radius: raio, height: comprimento, segments: segmentos })))
const cilindroX = (raio, comprimento, centro, segmentos = SEG) => translate(centro, rotateY(Math.PI / 2, cylinder({ radius: raio, height: comprimento, segments: segmentos })))
const cilindroZ = (raio, z0, z1, x, y, segmentos = SEG) => cylinder({ radius: raio, height: z1 - z0, center: [x, y, (z0 + z1) / 2], segments: segmentos })

/* Grava um desenho 2D numa face de pé voltada para a frente (−y), que está em y = yFace.
   No desenho, x é a horizontal e y é a altura (z). */
const gravarFrente = (forma2d, yFace, prof) => translate([0, yFace + prof, 0], rotateX(Math.PI / 2, extrudeLinear({ height: prof + 1 }, forma2d)))

/* Faixa zebrada de segurança (listras a 45°) num retângulo largura × altura centrado em (cx, cy). */
function listras(cx, cy, largura, altura, passo = 5) {
  const barras = []
  for (let x = -largura; x <= largura; x += passo) {
    barras.push(translate([cx + x, cy, 0], rotateZ(Math.PI / 4, rectangle({ size: [passo / 2, altura * 3] }))))
  }
  return intersect(union(barras), rectangle({ size: [largura, altura], center: [cx, cy] }))
}

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

/* Cabeça de parafuso sextavada (só o desenho gravado). */
const parafuso = (cx, cy) => union(
  subtract(circle({ radius: 3.4, center: [cx, cy], segments: 6 }), circle({ radius: 2.6, center: [cx, cy], segments: 6 })),
  circle({ radius: 0.9, center: [cx, cy], segments: 16 }),
)

/* ======================= Base (o corpo da prensa) ======================= */

function base(p) {
  const m = medidas(p)
  const aba = 3          // a sapata passa 3 mm para fora das paredes
  const sapataAlt = 4
  const contornoSapata = retArredondado(m.We + 2 * aba, m.Le + 2 * aba, p.raio + aba)
  const sapata = union(
    prisma(contornoSapata, 0, sapataAlt),
    // chanfro de 45° da sapata até a parede (imprime sem suporte)
    hull(prisma(contornoSapata, sapataAlt - 0.01, sapataAlt), prisma(retArredondado(m.We, m.Le, p.raio), sapataAlt + aba - 0.01, sapataAlt + aba)),
  )
  const casca = union(sapata, prisma(retArredondado(m.We, m.Le, p.raio), 0, m.zTopoBase))
  const vazio = prisma(retArredondado(m.Wi, m.Li, m.rInt), p.fundo, m.zTopoBase + 1)

  // Parede de trás: abertura do micro-USB, alinhada com o conector do ESP32, e furo dos fios do relé.
  const usb = cuboid({ size: [USB.largura, p.parede * 4, USB.altura], center: [m.px(p.usbX), m.Le / 2 - p.parede / 2, p.fundo + p.usbZ] })
  const cabo = cilindroY(CABO.raio, p.parede * 4, [m.px(CABO.x), m.Le / 2 - p.parede / 2, p.fundo + CABO.z])

  // Grades de ventilação nas duas laterais, na altura do ESP32: rasgos em pé com as pontas redondas.
  const rasgos = []
  const zRasgo = p.fundo + 25
  const altRasgo = 14
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const x = sx * (m.We / 2 - p.parede / 2)
      const y = m.py(128 + 5 * i)
      rasgos.push(cuboid({ size: [p.parede * 4, 2.4, altRasgo - 2.4], center: [x, y, zRasgo] }))
      rasgos.push(cilindroX(1.2, p.parede * 4, [x, y, zRasgo + (altRasgo - 2.4) / 2], 16))
      rasgos.push(cilindroX(1.2, p.parede * 4, [x, y, zRasgo - (altRasgo - 2.4) / 2], 16))
    }
  }

  // Frente: rebaixo para a unha (ajuda a levantar a mesa) e a faixa zebrada de segurança.
  const unha = cuboid({ size: [18, p.parede * 4, 2.4], center: [0, -m.Le / 2 + p.parede / 2, m.zTopoBase - 1.2] })
  const faixa = gravarFrente(listras(0, p.fundo + 34, 74, 7), -m.Le / 2, GRAVACAO_LADO)

  return subtract(casca, vazio, usb, cabo, ...rasgos, unha, faixa)
}

/* ======================= Tampa (a mesa da prensa) ======================= */

function tampa(p) {
  const m = medidas(p)
  const z0 = m.zTopoBase
  const z1 = m.zTopoTampa
  const saiaEsp = 1.6
  const saiaAlt = 5

  const placa = prisma(retArredondado(m.We, m.Le, p.raio), z0, z1)

  // Saia que entra na base e segura a mesa no lugar.
  const saia = prisma(subtract(
    retArredondado(m.Wi - 2 * p.encaixe, m.Li - 2 * p.encaixe, m.rInt - p.encaixe),
    retArredondado(m.Wi - 2 * p.encaixe - 2 * saiaEsp, m.Li - 2 * p.encaixe - 2 * saiaEsp, m.rInt - p.encaixe - saiaEsp),
  ), z0 - saiaAlt, z0)

  // Berço do leitor RFID: rebaixo por baixo (sobra 1,2 mm em cima) + cantoneiras nos quatro cantos.
  // As cantoneiras descem 7 mm para a placa caber dos dois jeitos: costas na mesa (pinos para baixo)
  // ou componentes virados para a mesa; o cristal tem uns 4 mm.
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

  // Encaixe das colunas: furo retangular + gola por baixo, onde entra o pino oco da coluna (os fios dos LEDs passam por ele).
  const furoW = 10.6 + 2 * 0.2
  const furoL = 18.6 + 2 * 0.2
  const golas = prisma(union(m.colunasX.map((x) => retArredondado(furoW + 4, furoL + 4, 2.5, [x, m.cy]))), z0 - 5.6, z0)
  const furosColuna = prisma(union(m.colunasX.map((x) => retArredondado(furoW, furoL, 1.7, [x, m.cy]))), z0 - 6, z1 + 1)

  // Buzzer: anel que segura por baixo e furinhos para o som.
  const bx = m.px(BUZZER.x)
  const by = m.py(BUZZER.y)
  const raioBuzzer = p.buzzerDiametro / 2 + 0.2
  const suporteBuzzer = prisma(anel(raioBuzzer + 1.6, raioBuzzer, [bx, by]), z0 - 6, z0)
  const pontosSom = [[0, 0]]
  for (let i = 0; i < 6; i++) pontosSom.push([3.4 * Math.cos((i * Math.PI) / 3), 3.4 * Math.sin((i * Math.PI) / 3)])
  const somFuros = prisma(union(pontosSom.map(([dx, dy]) => circle({ radius: 0.9, center: [bx + dx, by + dy], segments: 16 }))), z0 - 1, z1 + 1)

  // Ventilação sobre o ESP32.
  const ventilacao = prisma(union([-10, -5, 0, 5, 10].map((dx) =>
    retArredondado(2.4, 30, 1.2, [m.px(p.usbX) + dx, m.py(140)]))), z0 - 1, z1 + 1)

  // Desenhos gravados na face de cima: o lugar do cartão (embaixo do martelo), a marca e os parafusos.
  const mx = m.px(MARCA.x)
  const my = m.py(MARCA.y)
  const ex = m.We / 2 - 8
  const ey = m.Le / 2 - 8
  const gravacoes = union(
    moldura(58, 52, 4, 0.8, [lx, m.cy]),
    iconeCartao(lx, m.cy + 3),
    texto('APROXIME AQUI', { largura: 42, altura: 5, traco: 0.8, x: lx, cy: m.cy - 13 }),
    iconeCadeado(mx - 36, my - 0.7),
    texto('LockMachine', { largura: 66, altura: 9, traco: 1.2, x: mx - 23.5, cy: my + 4.5, alinhar: 'esquerda' }),
    texto('por LinkWave', { largura: 44, altura: 8, traco: 0.8, x: mx - 23.5, cy: my - 7.5, alinhar: 'esquerda' }),
    parafuso(-ex, -ey), parafuso(ex, -ey), parafuso(-ex, ey), parafuso(ex, ey),
  )
  const gravado = prisma(gravacoes, z1 - GRAVACAO, z1 + 1)

  return subtract(union(placa, saia, berco, golas, suporteBuzzer), rebaixoRfid, furosColuna, somFuros, ventilacao, gravado)
}

/* ======================= Pórtico (colunas + coroa) ======================= */

function portico(p) {
  const m = medidas(p)
  const zL = m.zTopoTampa
  const { cy, zC0, zC1, zTopo, yFrente, ledZ } = m
  const solidos = []
  const vazios = []

  for (const cx of m.colunasX) {
    const s = Math.sign(cx)
    solidos.push(prisma(retArredondado(PORTICO.colLargura, PORTICO.colProf, 2.5, [cx, cy]), zL, zC0 + 0.01))
    // Pino oco que entra na gola da mesa.
    solidos.push(prisma(retArredondado(10.6, 18.6, 1.5, [cx, cy]), zL - 8, zL + 0.01))
    // Guias do martelo na face de dentro (como as da P-01).
    const xi = cx - s * (PORTICO.colLargura / 2)
    for (const dy of [-6, 6]) solidos.push(prisma(rectangle({ size: [1.6, 3], center: [xi - s * 0.75, cy + dy] }), zL + 3, zC0 + 0.01))
    // Canal dos fios por dentro da coluna, do pino até dentro da coroa.
    vazios.push(prisma(rectangle({ size: [7, 13], center: [cx, cy] }), zL - 9, zC0 + 9))
    // Faixa zebrada no pé da coluna.
    vazios.push(gravarFrente(listras(cx, zL + 9, 12, 8, 4), cy - PORTICO.colProf / 2, GRAVACAO_LADO))
  }

  // Coroa com chanfro de 45° em cima.
  const contornoCoroa = retArredondado(PORTICO.coroaLargura, PORTICO.coroaProf, 3, [0, cy])
  solidos.push(prisma(contornoCoroa, zC0, zC1))
  solidos.push(hull(prisma(contornoCoroa, zC1 - 0.01, zC1),
    prisma(retArredondado(PORTICO.coroaLargura - 2 * PORTICO.chanfro, PORTICO.coroaProf - 6, 3, [0, cy]), zTopo - 0.01, zTopo)))

  // Canal dos LEDs atrás da frente da coroa. Entre as colunas ele é aberto por baixo, para pôr os LEDs por dentro;
  // em cima da coluna direita ele fica fechado e se liga ao canal da coluna.
  const yCanal = yFrente + 2.4 + 6
  vazios.push(prisma(rectangle({ size: [24, 12], center: [18, yCanal] }), zC0 - 1, zC0 + 14))
  vazios.push(prisma(rectangle({ size: [16, 12], center: [36, yCanal] }), zC0 + 2, zC0 + 14))
  const raioFuroLed = p.ledDiametro / 2 + 0.15
  for (const lx of LEDS_X) vazios.push(cilindroY(raioFuroLed, 6, [lx, yFrente + 1.2, ledZ]))

  // Placa de identificação gravada na frente da coroa, à esquerda dos LEDs.
  vazios.push(gravarFrente(union(
    moldura(40, 13, 2.5, 0.8, [-24, ledZ]),
    texto('LockMachine', { largura: 34, altura: 7, traco: 1, x: -24, cy: ledZ }),
  ), yFrente, GRAVACAO_LADO))

  // Furos dos pinos do martelo (embaixo) e do cilindro (em cima).
  vazios.push(cilindroZ(4.2, zC0 - 0.01, zC0 + 6, 0, cy))
  vazios.push(cilindroZ(4.2, zTopo - 6, zTopo + 0.01, 0, cy))

  return subtract(union(solidos), ...vazios)
}

/* ======================= Martelo (o punção amarelo) ======================= */

function martelo(p) {
  const m = medidas(p)
  const { cy, zC0 } = m
  const pino = cilindroZ(4, zC0 - 0.01, zC0 + 5, 0, cy)
  const haste = cilindroZ(7, zC0 - 8, zC0, 0, cy)
  // Transição de 45° da haste até a matriz (imprime em pé, com a matriz na mesa, sem suporte).
  const cone = hull(prisma(circle({ radius: 7, center: [0, cy], segments: SEG }), zC0 - 8.01, zC0 - 8),
    prisma(retArredondado(36, 22, 2, [0, cy]), zC0 - 19, zC0 - 18.99))
  const matriz = prisma(retArredondado(38, 24, 2, [0, cy]), zC0 - 25, zC0 - 18.98)
  const faixa = gravarFrente(listras(0, zC0 - 22, 34, 4.4, 4), cy - 12, 0.5)
  return subtract(union(pino, haste, cone, matriz), faixa)
}

/* ======================= Cilindro hidráulico (em cima da coroa) ======================= */

function cilindroHidraulico(p) {
  const m = medidas(p)
  const { cy, zTopo } = m
  const pino = cilindroZ(4, zTopo - 5, zTopo + 0.01, 0, cy)
  const flangeBaixo = prisma(retArredondado(24, 24, 2.5, [0, cy]), zTopo, zTopo + 3)
  const corpo = cilindroZ(10, zTopo + 3 - 0.01, zTopo + 23 + 0.01, 0, cy)
  const flangeCima = prisma(retArredondado(23, 23, 2.5, [0, cy]), zTopo + 23, zTopo + 26)
  const tirantes = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) tirantes.push(cilindroZ(1.4, zTopo + 3 - 0.01, zTopo + 23 + 0.01, sx * 9.2, cy + sy * 9.2, 16))
  // Aro da tampa do cilindro: só um sulco, para continuar plano na mesa da impressora.
  const sulco = prisma(anel(6.5, 5.7, [0, cy]), zTopo + 25.5, zTopo + 26.01)
  return subtract(union(pino, flangeBaixo, corpo, flangeCima, ...tirantes), sulco)
}

/* ======================= Placas e fios (só para a prévia) ======================= */

const marcar = (g, grupo, extra = {}) => Object.assign(g, { grupo }, extra)

/* Furo do protoboard ao lado de um pino do ESP32. lado: 'esq' ou 'dir'; i: 0 é o pino mais perto do USB. */
function furoEsp(p, lado, i) {
  const s = lado === 'dir' ? 1 : -1
  return [p.usbX + s * (ESP.fileiras + 2.54), p.protoComprimento + p.sobraEsp - ESP.primeiroPino - 2.54 * i]
}

/* Pinos usados pelo sketch (firmware/lockmachine_esp32). */
const PINOS = {
  '3V3': ['esq', 0], GND_E: ['esq', 1], D5: ['esq', 7], D18: ['esq', 8], D19: ['esq', 9], D22: ['esq', 13], D23: ['esq', 14],
  VIN: ['dir', 0], GND_D: ['dir', 1], D27: ['dir', 5], D26: ['dir', 6], D25: ['dir', 7], D33: ['dir', 8], D32: ['dir', 9],
}
const TRILHO_GND_X = 95.8   // trilho azul (−) da borda direita do protoboard grande
const RESISTOR = { de: 2, ate: 6 } // em furos, contados a partir do pino (o resistor de 220 Ω atravessa o canal do meio)

function placas(p) {
  const m = medidas(p)
  const f = p.fundo
  const zb = f + 9.5
  const caixa = (x, y, w, l, z0, h, cor, grupo) =>
    marcar(colorize(cor, cuboid({ size: [w, l, h], center: [m.px(x + w / 2), m.py(y + l / 2), z0 + h / 2] })), grupo)
  const meio = p.protoLargura / 2
  const topoEsp = p.protoComprimento + p.sobraEsp
  const coresLed = [[0.13, 0.82, 0.48], [1, 0.82, 0.25], [1, 0.24, 0.18]]
  const lista = [
    caixa(meio, 0, p.protoLargura - meio, p.protoComprimento, f, 9.5, [0.93, 0.93, 0.9], 'base'),          // protoboard grande
    caixa(0, p.protoComprimento / 2, meio, p.protoComprimento / 2, f, 9.5, [0.93, 0.93, 0.9], 'base'),      // protoboard pequeno
    caixa(p.usbX - ESP.largura / 2, topoEsp - ESP.comprimento, ESP.largura, ESP.comprimento, f + 12, 1.6, [0.1, 0.1, 0.12], 'base'), // ESP32
    caixa(p.usbX - 9, topoEsp - 33, 18, 25.5, f + 13.6, 3.2, [0.72, 0.72, 0.74], 'base'),                   // módulo WROOM
    caixa(p.usbX - 4, topoEsp - 5, 8, 5, f + 13.6, 2.8, [0.75, 0.75, 0.78], 'base'),                       // micro-USB
    caixa(LEITOR.x, LEITOR.y, LEITOR.largura, LEITOR.comprimento, m.zTopoBase - 0.4 - 1.6, 1.6, [0.12, 0.3, 0.75], 'tampa'), // MFRC522
    marcar(colorize([0.1, 0.1, 0.1], cylinder({ radius: p.buzzerDiametro / 2, height: 9.5, segments: 32,
      center: [m.px(BUZZER.x), m.py(BUZZER.y), m.zTopoBase - 4.75] })), 'tampa'),
  ]
  // LEDs deitados na coroa, com a ponta para fora da frente.
  LEDS_X.forEach((x, i) => lista.push(marcar(colorize(coresLed[i], cilindroY(p.ledDiametro / 2, 8.6, [x, m.yFrente + 1.3, m.ledZ], 24)), 'portico', { brilho: true })))
  // Resistores de 220 Ω na fileira de cada pino de LED.
  for (const nome of ['D25', 'D33', 'D32']) {
    const [lado, i] = PINOS[nome]
    const [x0, y] = furoEsp(p, lado, i)
    const xa = x0 + 2.54 * RESISTOR.de
    const xb = x0 + 2.54 * RESISTOR.ate
    lista.push(marcar(colorize([0.86, 0.74, 0.52], cilindroX(1.1, (xb - xa) * 0.55, [m.px((xa + xb) / 2), m.py(y), zb + 2.6], 16)), 'base'))
    for (const x of [xa, xb]) lista.push(marcar(colorize([0.7, 0.7, 0.72], cilindroZ(0.3, zb - 0.5, zb + 2.6, m.px(x), m.py(y), 8)), 'base'))
  }
  return lista
}

/* Fios para a prévia: cada ponto é [x, y, z, grupo]. Na vista explodida, cada ponto anda junto com a
   peça do seu grupo; 'meio' anda a média entre o grupo do começo e o do fim do fio. */
function fios(p) {
  const m = medidas(p)
  const zb = p.fundo + 9.5
  const zT = m.zTopoBase
  const r = (v) => Math.round(v * 100) / 100
  const B = (x, y, z, g) => [r(x), r(y), r(z), g]                 // coordenadas da caixa
  const P = (xp, yp, z, g) => B(m.px(xp), m.py(yp), z, g)        // coordenadas do protoboard
  const furo = (nome) => furoEsp(p, ...PINOS[nome])
  const noProto = ([x, y], g = 'base') => [P(x, y, zb + 9, g), P(x, y, zb, g)]   // desce em pé até o furo
  const lista = []
  const fio = (id, nome, de, para, cor, pontos, raio = 0.75) => lista.push({ id, nome, de, para, cor, raio, pontos })

  // Leitor RFID: os 8 pinos ficam na borda de trás da placa, apontando para baixo.
  const yPinoRfid = LEITOR.y + LEITOR.comprimento - 2.5
  const xPinoRfid = (k) => LEITOR.x + LEITOR.largura / 2 - 8.89 + 2.54 * k
  const rfid = [
    ['sda', 'SDA', 0, 'D5', 'GPIO 5', '#FB8C00'],
    ['sck', 'SCK', 1, 'D18', 'GPIO 18', '#8D6E63'],
    ['mosi', 'MOSI', 2, 'D23', 'GPIO 23', '#1E88E5'],
    ['miso', 'MISO', 3, 'D19', 'GPIO 19', '#9C4DCC'],
    ['gnd-rfid', 'GND', 5, 'GND_E', 'GND', '#3B3B3B'],
    ['rst', 'RST', 6, 'D22', 'GPIO 22', '#9E9E9E'],
    ['3v3', '3.3V', 7, '3V3', '3V3 (não use 5 V)', '#F5F5F5'],
  ]
  for (const [id, pino, k, alvo, rotulo, cor] of rfid) {
    const x = xPinoRfid(k)
    const [fx, fy] = furo(alvo)
    fio(id, `Leitor ${pino}`, `Leitor RFID · ${pino}`, `ESP32 · ${rotulo}`, cor, [
      P(x, yPinoRfid, zT - 8, 'tampa'), P(x, yPinoRfid + 1, zT - 15, 'tampa'),
      P((x + fx) / 2, (yPinoRfid + fy) / 2 - 4, zb + 22 - k, 'meio'),
      ...noProto([fx, fy]),
    ])
  }

  // LEDs: sobem pelo canal da coroa, descem pela coluna direita, passam pelo pino oco e chegam aos resistores.
  const xCol = m.colunasX[1]
  const leds = [
    ['led-verde', 'LED verde', 0, 'D25', 'GPIO 25', '#22D07B'],
    ['led-amarelo', 'LED amarelo', 1, 'D32', 'GPIO 32', '#FFD23F'],
    ['led-vermelho', 'LED vermelho', 2, 'D33', 'GPIO 33', '#FF3D2E'],
  ]
  const descerPelaColuna = (k, zFim) => [
    B(xCol - 1.2, m.cy - 4 + k * 0.9, m.zC0 + 4, 'portico'),
    B(xCol - 1.5 + k * 1.1, m.cy, m.zC0 - 20, 'portico'),
    B(xCol - 1.5 + k * 1.1, m.cy, m.zTopoTampa - 9, 'portico'),
    B(xCol - 2 + k * 1.1, m.cy + 3, zFim, 'meio'),
  ]
  for (const [id, nome, k, alvo, rotulo, cor] of leds) {
    const lx = LEDS_X[k]
    const [fx, fy] = furo(alvo)
    const xFim = fx + 2.54 * (RESISTOR.ate + 1)
    fio(id, `${nome} (perna longa)`, `${nome} · perna longa (+)`, `resistor 220 Ω → ESP32 · ${rotulo}`, cor, [
      B(lx + 0.6, m.yFrente + 8, m.ledZ, 'portico'), B(lx + 3, m.yFrente + 11, m.zC0 + 5, 'portico'),
      ...descerPelaColuna(k, zb + 24),
      ...noProto([xFim, fy]),
    ])
  }
  fio('gnd-leds', 'GND dos LEDs', 'LEDs · 3 pernas curtas (−) juntas', 'trilho GND (−)', '#3B3B3B', [
    B(LEDS_X[1], m.yFrente + 8, m.ledZ - 2, 'portico'), B(LEDS_X[1] + 6, m.yFrente + 11, m.zC0 + 3, 'portico'),
    ...descerPelaColuna(3, zb + 20),
    ...noProto([TRILHO_GND_X, PORTICO.y + 28]),
  ])

  // Buzzer: preso embaixo da mesa, perto do ESP32.
  const [bfx, bfy] = furo('D27')
  fio('buzzer', 'Buzzer +', 'Buzzer · perna + (longa)', 'ESP32 · GPIO 27', '#F06292', [
    P(BUZZER.x - 3.25, BUZZER.y, zT - 10, 'tampa'), P(BUZZER.x - 4, BUZZER.y, zT - 16, 'tampa'),
    P((BUZZER.x + bfx) / 2, (BUZZER.y + bfy) / 2, zb + 18, 'meio'), ...noProto([bfx, bfy]),
  ])
  fio('gnd-buzzer', 'Buzzer −', 'Buzzer · perna −', 'trilho GND (−)', '#3B3B3B', [
    P(BUZZER.x + 3.25, BUZZER.y, zT - 10, 'tampa'), P(BUZZER.x + 4, BUZZER.y, zT - 16, 'tampa'),
    P(TRILHO_GND_X - 1, BUZZER.y - 6, zb + 16, 'meio'), ...noProto([TRILHO_GND_X, BUZZER.y - 10]),
  ])

  // ESP32 → trilho GND, para os LEDs, o buzzer e o relé terem o mesmo GND.
  const [gx, gy] = furo('GND_D')
  fio('gnd-esp', 'GND do ESP32', 'ESP32 · GND', 'trilho GND (−)', '#3B3B3B', [
    ...noProto([gx, gy]).reverse(), P((gx + TRILHO_GND_X) / 2, gy - 1, zb + 7, 'base'), ...noProto([TRILHO_GND_X, gy - 2]),
  ])

  // Relé: os 3 fios saem pelo furo da parede de trás até o módulo, do lado de fora.
  const yParede = m.Le / 2
  const zFuro = p.fundo + CABO.z
  const xFuro = m.px(CABO.x)
  const rele = [
    ['rele-in', 'Relé IN', 'D26', 'ESP32 · GPIO 26', 'Relé · IN', '#4FC3F7', -1.6],
    ['rele-vcc', 'Relé VCC', 'VIN', 'ESP32 · VIN (5 V do USB)', 'Relé · VCC', '#C62828', 0],
    ['rele-gnd', 'Relé GND', null, 'trilho GND (−)', 'Relé · GND', '#3B3B3B', 1.6],
  ]
  for (const [id, nome, alvo, de, para, cor, dx] of rele) {
    const [fx, fy] = alvo ? furo(alvo) : [TRILHO_GND_X, 158]
    fio(id, nome, de, para, cor, [
      ...noProto([fx, fy]).reverse(),
      B((m.px(fx) + xFuro) / 2, yParede - 14, zFuro + 6, 'base'),
      B(xFuro + dx, yParede - 4, zFuro + dx * 0.3, 'base'),
      B(xFuro + dx, yParede + 6, zFuro + dx * 0.3, 'base'),
      B(xFuro + dx * 2.5, yParede + 26, zFuro - 4, 'base'),
      B(xFuro + dx * 3, yParede + 40, zFuro - 8, 'base'),
    ])
  }

  // Cabo USB que alimenta o ESP32 (sai por trás).
  const zUsb = p.fundo + p.usbZ
  fio('usb', 'Cabo USB', 'ESP32 · micro-USB', 'carregador ou computador', '#55595F', [
    B(m.px(p.usbX), yParede - 3, zUsb, 'base'), B(m.px(p.usbX), yParede + 10, zUsb, 'base'),
    B(m.px(p.usbX) - 4, yParede + 28, zUsb - 6, 'base'), B(m.px(p.usbX) - 12, yParede + 44, 3, 'base'),
  ], 2)

  return lista
}

/* ======================= Principal ======================= */

const CORES = {
  base: [0.2, 0.22, 0.28],          // grafite (o corpo da P-01)
  tampa: [0.66, 0.69, 0.74],        // cinza-aço (a mesa)
  portico: [1, 0.24, 0.18],         // vermelho LockMachine
  martelo: [1, 0.82, 0.25],         // amarelo do martelo, como na P-01
  cilindro: [0.5, 0.53, 0.58],      // cinza
}

/* Quanto cada peça sobe na vista explodida (mm). */
const EXPLOSAO = { base: 0, tampa: 50, portico: 95, martelo: 80, cilindro: 125 }

function pecasMontadas(p) {
  const casca = (nome, g) => marcar(colorize(CORES[nome], g), nome, { tipo: 'caixa' })
  return [
    casca('base', base(p)),
    casca('tampa', tampa(p)),
    casca('portico', portico(p)),
    casca('martelo', martelo(p)),
    casca('cilindro', cilindroHidraulico(p)),
  ]
}

/* Põe a peça na mesa da impressora: centralizada e com o ponto mais baixo em z = 0. */
function naMesa(g) {
  const [[x0, y0, z0], [x1, y1]] = measureBoundingBox(g)
  return translate([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0], g)
}

function main(params) {
  const p = Object.assign({}, padroes(), params)
  // Posição de impressão de cada peça: a face plana maior na mesa, sem suportes.
  if (p.peca === 'base') return base(p)
  if (p.peca === 'tampa') return naMesa(rotateX(Math.PI, tampa(p)))               // de cabeça para baixo
  if (p.peca === 'portico') return naMesa(rotateX(Math.PI, portico(p)))           // coroa na mesa, colunas para cima
  if (p.peca === 'martelo') return naMesa(martelo(p))                             // matriz na mesa
  if (p.peca === 'cilindro') return naMesa(rotateX(Math.PI, cilindroHidraulico(p))) // tampa do cilindro na mesa
  const tudo = [...pecasMontadas(p), ...(p.componentes ? placas(p) : [])]
  if (p.peca === 'explodida') return tudo.map((g) => translate([0, 0, EXPLOSAO[g.grupo] || 0], g))
  return tudo
}

function padroes() {
  const r = {}
  for (const d of getParameterDefinitions()) {
    if (d.type === 'group') continue
    r[d.name] = d.type === 'checkbox' ? d.checked : d.initial
  }
  return r
}

module.exports = { main, getParameterDefinitions, base, tampa, portico, martelo, cilindroHidraulico, placas, fios, pecasMontadas, medidas, padroes, CORES, EXPLOSAO }
