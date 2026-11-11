// LockMachine · caixa da leitora RFID em forma de prensa hidráulica (a P-01 do site), para impressão 3D.
// Versão 4: a resposta aparece numa torre de sinalização de verdade (HDL-T50L-3C-J, 12/24 V, com buzzer),
// ligada por um módulo de 4 relés que fica numa caixa de comando ao lado da prensa.
//
// A base da prensa guarda o protoboard montado como está (ESP32 e ligações). Em cima dela:
//   - mesa (tampa): na frente fica o posto de leitura (o MFRC522 por baixo, lido através de 1,2 mm de plástico),
//     fora da área do martelo, como o posto de comando de uma máquina de verdade;
//   - pórtico (duas colunas + coroa): o servo fica escondido dentro da coroa;
//   - tampa do mecanismo: fecha a coroa por baixo e guia o pistão;
//   - pistão: tem um rasgo em cima onde corre o pino do braço do servo (jugo escocês: o giro vira subida e descida);
//   - martelo (amarelo): encaixa na ponta do pistão;
//   - cilindro hidráulico em cima da coroa (só decoração).
// Ao lado, a caixa de comando (como a unidade de força da P-01 no site):
//   - caixa: guarda o módulo de 4 relés e a entrada de 12 V; uma passagem na lateral leva os fios até a base;
//   - tampa da caixa: a torre de sinalização é parafusada nela, e os 5 fios da torre descem pelo furo do meio.
// São 9 peças, todas impressas sem suporte. Além delas: o servo SG90 do kit, um capacitor de 470 µF, um
// pedaço de clipe de papel (o pino), o módulo de 4 relés, um conector de 12 V (P4 fêmea de painel) e uma fonte de 12 V.
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
    values: ['montada', 'explodida', 'base', 'tampa', 'portico', 'tampaMec', 'pistao', 'martelo', 'cilindro', 'comando', 'tampaComando'],
    captions: ['Prensa montada (prévia)', 'Prensa explodida (prévia)', 'Base (para imprimir)', 'Mesa (para imprimir)',
      'Pórtico (para imprimir)', 'Tampa do mecanismo (para imprimir)', 'Pistão (para imprimir)', 'Martelo (para imprimir)',
      'Cilindro (para imprimir)', 'Caixa de comando (para imprimir)', 'Tampa da caixa de comando (para imprimir)'], initial: 'montada' },
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
  { name: 'tampaEspessura', type: 'float', initial: 2.4, step: 0.1, caption: 'Espessura da mesa' },
  { name: 'sobreRfid', type: 'float', initial: 1.2, step: 0.1, caption: 'Plástico sobre o leitor RFID' },
  { name: 'encaixe', type: 'float', initial: 0.3, step: 0.05, caption: 'Folga dos encaixes' },
  { name: 'alturaColunas', type: 'float', initial: 62, step: 1, caption: 'Altura das colunas (da mesa até a coroa)' },
  { name: 'grupo5', type: 'group', caption: 'Torre de sinalização (meça o pé da sua)' },
  { name: 'torrePe', type: 'float', initial: 60, step: 0.5, caption: 'Diâmetro do pé da torre' },
  { name: 'torreFuros', type: 'float', initial: 46, step: 0.5, caption: 'Distância do centro do pé até o centro dos furos × 2' },
  { name: 'torreFuro', type: 'float', initial: 4.5, step: 0.1, caption: 'Diâmetro dos 3 furos do pé (parafuso M4)' },
  { name: 'torreFios', type: 'float', initial: 14, step: 0.5, caption: 'Furo do meio, para os 5 fios da torre' },
  { name: 'conector12v', type: 'float', initial: 11, step: 0.5, caption: 'Furo do conector P4 de 12 V' },
  { name: 'grupo4', type: 'group', caption: 'Mecanismo do martelo' },
  { name: 'manivela', type: 'float', initial: 6, step: 0.5, min: 4, max: 7, caption: 'Furo do braço do servo: distância do centro (4 a 7)' },
  { name: 'pino', type: 'float', initial: 1.2, step: 0.1, caption: 'Diâmetro do pino (clipe de papel)' },
]

/* Posições medidas a partir do canto da frente à esquerda do protoboard (vista de cima). */
// MFRC522 deitado na frente da mesa: os 60 mm ao longo da largura, conector virado para a esquerda.
const LEITOR = { largura: 39.5, comprimento: 60, x: 12, y: 3.5 }
const ANTENA = { x: LEITOR.x + LEITOR.comprimento - 22, y: LEITOR.y + LEITOR.largura / 2 } // o lado oposto ao conector
const PORTICO = { y: 84, colunasX: [10, 90], colLargura: 14, colProf: 22, coroaLargura: 104, coroaProf: 40, coroaAltura: 28, chanfro: 4 }
const MARCA = { x: 50, y: 114 }                                      // cadeado + "LockMachine", atrás das colunas
const USB = { largura: 14, altura: 15 }                              // abertura do micro-USB (cabe a capa do plugue)
// Caixa de comando, encostada na lateral direita da base e alinhada com a parede de trás.
const COMANDO = { largura: 92, comprimento: 116, vao: 6 }            // vao: entre as paredes das duas caixas (as sapatas se encostam)
const PASSAGEM = { recuo: 30, largura: 24, altura: 14, z: 26 }       // abertura lateral dos fios (recuo: do centro da caixa para a frente)
// Módulo de 4 relés (5 V): 56 × 76 mm, com os bornes de parafuso num lado comprido e os 6 pinos num lado curto.
const RELE = { largura: 56, comprimento: 76, altura: 19, apoio: 3 }
// Torre HDL-T50L-3C-J, só para a prévia (medidas aproximadas, pela foto).
const TORRE = { corpo: 50, haste: 20, alturaHaste: 95, alturaPe: 10, alturaBase: 60, gomos: [42, 52, 54], alturaTopo: 14 }
const ESP = { largura: 28.3, comprimento: 51.5, fileiras: 12.7, primeiroPino: 7 } // ESP32 DevKit de 30 pinos
const GRAVACAO = 0.5                                                 // profundidade dos desenhos gravados na mesa
const GRAVACAO_LADO = 0.6                                            // nas faces de pé

/* Mecanismo dentro da coroa (x a partir do centro da prensa; z a partir de baixo da coroa).
   Servo SG90 deitado, com o eixo apontando para +x; o pistão fica logo à direita do braço. */
const SERVO = { corpo: 22.7, largura: 11.8, comprimento: 22.2, eixoDaPonta: 5.6, abas: 32.2, abaAltura: 15.9, abaEsp: 2.5, ateBraco: 26.7 }
const MEC = {
  pistaoX: 3,             // eixo do pistão (3 mm à direita do centro, para o servo passar entre as guias das colunas)
  pistaoDy: -5,           // em relação à linha das colunas
  eixoZ: 16.5,            // altura do eixo do servo dentro da coroa
  haste: 8,               // pistão quadrado de 8 × 8 mm (não gira na guia)
  braco: 1.5,             // espessura do braço do servo
  tampa: 2.4,             // espessura da tampa do mecanismo
  guiaAte: 6,             // a guia do pistão vai até 6 mm acima de baixo da coroa
}

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
  const cy = py(PORTICO.y)
  const zC0 = zTopoTampa + p.alturaColunas
  const zC1 = zC0 + PORTICO.coroaAltura
  // Mecanismo
  const xP = MEC.pistaoX
  const yR = cy + MEC.pistaoDy
  const zs = zC0 + MEC.eixoZ
  const xBraco = xP - MEC.haste / 2 - 1          // face de cima do braço do servo (o jugo fica 1 mm à direita)
  // Caixa de comando (coordenadas da prensa): mesma altura da base, encostada à direita.
  const cmdX0 = We / 2 + COMANDO.vao
  const cmdY1 = Le / 2
  const cmd = {
    x0: cmdX0, x1: cmdX0 + COMANDO.largura, y0: cmdY1 - COMANDO.comprimento, y1: cmdY1,
    cx: cmdX0 + COMANDO.largura / 2, cy: cmdY1 - COMANDO.comprimento / 2,
  }
  cmd.yPassagem = cmd.cy - PASSAGEM.recuo
  // Módulo de relés: centrado na largura, um pouco para trás; pinos virados para a frente (−y).
  cmd.rele = { x0: cmd.cx - RELE.largura / 2, x1: cmd.cx + RELE.largura / 2, y0: cmd.cy - RELE.comprimento / 2 + 6, z0: p.fundo + RELE.apoio }
  cmd.rele.y1 = cmd.rele.y0 + RELE.comprimento
  // Postes dos 2 parafusos da tampa, em cantos opostos (longe do conector de 12 V, que fica atrás à direita).
  cmd.postes = [[cmd.x0 + 7.5, cmd.y1 - 7.5], [cmd.x1 - 7.5, cmd.y0 + 7.5]]
  return {
    cmd,
    Wi, Li, We, Le, rInt, zTopoBase, zTopoTampa,
    // Converte coordenadas do protoboard (canto da frente à esquerda) para coordenadas da caixa (centro em 0, 0).
    px, py,
    cy,                                             // linha das colunas
    colunasX: PORTICO.colunasX.map(px),
    zC0, zC1,                                       // embaixo e em cima da coroa
    zTopo: zC1 + PORTICO.chanfro,                   // topo da coroa, onde o cilindro encaixa
    yFrente: cy - PORTICO.coroaProf / 2,            // face da frente da coroa
    ledZ: zC0 + PORTICO.coroaAltura / 2,
    xP, yR, zs, xBraco,
    xServo: xBraco - MEC.braco - SERVO.ateBraco,  // fundo do servo (o braço encaixa no eixo, que termina em xBraco - braco)
    curso: 2 * p.manivela,
    zJugo: zs + p.manivela,                         // centro do rasgo do pistão com o martelo em cima
  }
}

const prisma = (forma2d, z0, z1) => translate([0, 0, z0], extrudeLinear({ height: z1 - z0 }, forma2d))
const caixaXYZ = (x0, x1, y0, y1, z0, z1) => cuboid({ size: [x1 - x0, y1 - y0, z1 - z0], center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] })

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

/* Casco com sapata: paredes de largura × comprimento centradas em (cx, cy) e uma sapata 3 mm mais larga
   embaixo, com chanfro de 45° até a parede (imprime sem suporte). */
function cascoComSapata(p, largura, comprimento, cx, cy, altura) {
  const aba = 3
  const sapataAlt = 4
  const contornoSapata = retArredondado(largura + 2 * aba, comprimento + 2 * aba, p.raio + aba, [cx, cy])
  const contorno = retArredondado(largura, comprimento, p.raio, [cx, cy])
  return union(
    prisma(contornoSapata, 0, sapataAlt),
    hull(prisma(contornoSapata, sapataAlt - 0.01, sapataAlt), prisma(contorno, sapataAlt + aba - 0.01, sapataAlt + aba)),
    prisma(contorno, 0, altura),
  )
}

/* Abertura da passagem dos fios entre a base e a caixa de comando, numa parede lateral em x. */
const passagem = (m, x, espessura) => translate([x, m.cmd.yPassagem, PASSAGEM.z],
  rotateY(Math.PI / 2, extrudeLinear({ height: espessura }, retArredondado(PASSAGEM.altura, PASSAGEM.largura, 3))))

function base(p) {
  const m = medidas(p)
  const casca = cascoComSapata(p, m.We, m.Le, 0, 0, m.zTopoBase)
  const vazio = prisma(retArredondado(m.Wi, m.Li, m.rInt), p.fundo, m.zTopoBase + 1)

  // Parede de trás: abertura do micro-USB, alinhada com o conector do ESP32.
  const usb = cuboid({ size: [USB.largura, p.parede * 4, USB.altura], center: [m.px(p.usbX), m.Le / 2 - p.parede / 2, p.fundo + p.usbZ] })
  // Parede da direita: passagem dos fios até a caixa de comando (os 6 fios do módulo de relés).
  const cabo = passagem(m, m.We / 2 - p.parede * 2, p.parede * 4)

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

  // Berço do leitor RFID (deitado, 60 mm na largura): rebaixo por baixo (sobra 1,2 mm em cima) + cantoneiras.
  // As cantoneiras descem 7 mm para a placa caber dos dois jeitos: costas na mesa (pinos para baixo)
  // ou componentes virados para a mesa; o cristal tem uns 4 mm.
  const lw = LEITOR.comprimento + 0.6
  const lc = LEITOR.largura + 0.6
  const lx = m.px(LEITOR.x + LEITOR.comprimento / 2)
  const ly = m.py(LEITOR.y + LEITOR.largura / 2)
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

  // Encaixe das colunas: furo retangular + gola por baixo, onde entra o pino oco da coluna (os fios passam por ele).
  const furoW = 10.6 + 2 * 0.2
  const furoL = 18.6 + 2 * 0.2
  const golas = prisma(union(m.colunasX.map((x) => retArredondado(furoW + 4, furoL + 4, 2.5, [x, m.cy]))), z0 - 5.6, z0)
  const furosColuna = prisma(union(m.colunasX.map((x) => retArredondado(furoW, furoL, 1.7, [x, m.cy]))), z0 - 6, z1 + 1)

  // Ventilação sobre o ESP32.
  const ventilacao = prisma(union([-10, -5, 0, 5, 10].map((dx) =>
    retArredondado(2.4, 30, 1.2, [m.px(p.usbX) + dx, m.py(140)]))), z0 - 1, z1 + 1)

  // Desenhos gravados: o posto de leitura na frente, a chapa embaixo do martelo, a marca e os parafusos.
  const ax = m.px(ANTENA.x)
  const mx = m.px(MARCA.x)
  const my = m.py(MARCA.y)
  const ex = m.We / 2 - 8
  const ey = m.Le / 2 - 8
  const gravacoes = union(
    moldura(66, 37, 4, 0.8, [m.px(50), ly]),
    iconeCartao(ax, ly + 3),
    texto('APROXIME AQUI', { largura: 42, altura: 5, traco: 0.8, x: ax, cy: ly - 12.5 }),
    // chapa sendo prensada + dois rasgos em T da mesa
    moldura(44, 30, 2, 0.8, [m.xP, m.yR]),
    traco([[m.xP - 28, m.yR - 19], [m.xP + 28, m.yR - 19]], 0.8),
    traco([[m.xP - 28, m.yR + 19], [m.xP + 28, m.yR + 19]], 0.8),
    iconeCadeado(mx - 36, my - 0.7),
    texto('LockMachine', { largura: 66, altura: 9, traco: 1.2, x: mx - 23.5, cy: my + 4.5, alinhar: 'esquerda' }),
    texto('por LinkWave', { largura: 44, altura: 8, traco: 0.8, x: mx - 23.5, cy: my - 7.5, alinhar: 'esquerda' }),
    parafuso(-ex, -ey), parafuso(ex, -ey), parafuso(-ex, ey), parafuso(ex, ey),
  )
  const gravado = prisma(gravacoes, z1 - GRAVACAO, z1 + 1)

  return subtract(union(placa, saia, berco, golas), rebaixoRfid, furosColuna, ventilacao, gravado)
}

/* ======================= Pórtico (colunas + coroa com o servo) ======================= */

/* Contorno da tampa do mecanismo (o rebaixo embaixo da coroa onde ela encaixa). */
const contornoTampaMec = (m, folga = 0) => [
  -30.8 + folga, m.xP + 6.5 - folga, m.cy - 16.4 + folga, m.cy + 17.4 - folga,
]

function portico(p) {
  const m = medidas(p)
  const zL = m.zTopoTampa
  const { cy, zC0, zC1, zTopo, yFrente, ledZ, xP, yR, zs } = m
  const solidos = []
  const vazios = []

  for (const cx of m.colunasX) {
    const s = Math.sign(cx)
    solidos.push(prisma(retArredondado(PORTICO.colLargura, PORTICO.colProf, 2.5, [cx, cy]), zL, zC0 + 0.01))
    // Pino oco que entra na gola da mesa.
    solidos.push(prisma(retArredondado(10.6, 18.6, 1.5, [cx, cy]), zL - 8, zL + 0.01))
    // Guias na face de dentro (como as da P-01).
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

  // Mecanismo: tudo abre para baixo, para o servo e o pistão entrarem por baixo, e a tampa do mecanismo fecha.
  const [tx0, tx1, ty0, ty1] = contornoTampaMec(m)
  const zM = zC0 + MEC.tampa - 0.01
  const xs = m.xServo
  vazios.push(caixaXYZ(tx0, tx1, ty0, ty1, zC0 - 1, zC0 + MEC.tampa))                                   // rebaixo da tampa
  vazios.push(caixaXYZ(xs - 0.3, xs + SERVO.corpo + 0.3, yR - SERVO.eixoDaPonta - 0.3,
    yR - SERVO.eixoDaPonta + SERVO.comprimento + 0.3, zM, zs + SERVO.largura / 2 + 0.2))               // corpo do servo
  const xAba = xs + SERVO.abaAltura
  vazios.push(caixaXYZ(xAba - 0.3, xAba + SERVO.abaEsp + 0.6, yR - SERVO.eixoDaPonta - 5.3,
    yR - SERVO.eixoDaPonta - 5 + SERVO.abas + 0.3, zM, zs + SERVO.largura / 2 + 0.2))                  // abas do servo
  vazios.push(caixaXYZ(xs + SERVO.corpo - 0.1, m.xBraco - MEC.braco + 0.2, yR - 6.3, yR + 10, zM, zs + 6.3)) // engrenagem e eixo
  const folgaJugo = 3.1 + 0.8
  vazios.push(caixaXYZ(m.xBraco - MEC.braco - 0.5, tx1 - 0.3, yR - 10.5, yR + 10.5, zM, m.zJugo + folgaJugo)) // braço e pistão
  vazios.push(caixaXYZ(-44, xs, cy - 6, cy + 6, zM, zC0 + 10))                                          // cabo do servo até a coluna esquerda

  // Placa de identificação gravada no meio da frente da coroa (a torre de sinalização fica na caixa de comando).
  vazios.push(gravarFrente(union(
    moldura(54, 15, 2.5, 0.8, [0, ledZ]),
    texto('LockMachine', { largura: 46, altura: 8.5, traco: 1.1, x: 0, cy: ledZ }),
  ), yFrente, GRAVACAO_LADO))

  // Furo do pino do cilindro (em cima).
  vazios.push(cilindroZ(4.2, zTopo - 4, zTopo + 0.01, 0, cy))

  return subtract(union(solidos), ...vazios)
}

/* ======================= Tampa do mecanismo (fecha a coroa por baixo e guia o pistão) ======================= */

function tampaMecanismo(p) {
  const m = medidas(p)
  const { zC0, xP, yR, zs } = m
  const [x0, x1, y0, y1] = contornoTampaMec(m, 0.2)
  const placa = caixaXYZ(x0, x1, y0, y1, zC0, zC0 + MEC.tampa)
  const lado = MEC.haste + 3
  const bucha = prisma(retArredondado(lado, lado, 1.5, [xP, yR]), zC0 + MEC.tampa - 0.01, zC0 + MEC.guiaAte)
  // Calço que segura o servo por baixo (fica entre as abas).
  const xs = m.xServo
  const calco = caixaXYZ(xs + 2, xs + SERVO.abaAltura - 1.5, yR - 4, yR + 12, zC0 + MEC.tampa - 0.01, zs - SERVO.largura / 2 - 0.2)
  const guia = caixaXYZ(xP - MEC.haste / 2 - 0.25, xP + MEC.haste / 2 + 0.25, yR - MEC.haste / 2 - 0.25, yR + MEC.haste / 2 + 0.25, zC0 - 1, zC0 + MEC.guiaAte + 1)
  return subtract(union(placa, bucha, calco), guia)
}

/* ======================= Pistão (jugo escocês) e martelo ======================= */

/* Pistão na posição de cima (o pino do braço no ponto mais alto). */
function pistao(p) {
  const m = medidas(p)
  const { xP, yR, zC0, zJugo } = m
  const h = MEC.haste
  const rasgoAlt = p.pino + 0.6
  const meioJugo = rasgoAlt / 2 + 2.2
  const jugo = caixaXYZ(xP - h / 2, xP + h / 2, yR - 10, yR + 10, zJugo - meioJugo, zJugo + meioJugo)
  const rasgo = caixaXYZ(xP - h, xP + h, yR - (p.manivela + 1.4), yR + (p.manivela + 1.4), zJugo - rasgoAlt / 2, zJugo + rasgoAlt / 2)
  const haste = caixaXYZ(xP - h / 2, xP + h / 2, yR - h / 2, yR + h / 2, zC0 - 9, zJugo - meioJugo + 0.01)
  return subtract(union(jugo, haste), rasgo)
}

function martelo(p) {
  const m = medidas(p)
  const { xP, yR, zC0 } = m
  const colar = prisma(retArredondado(13, 13, 1.5, [xP, yR]), zC0 - 7, zC0 - 1)
  // Transição de 45° do colar até a matriz (imprime em pé, com a matriz na mesa, sem suporte).
  const cone = hull(prisma(retArredondado(13, 13, 1.5, [xP, yR]), zC0 - 7.01, zC0 - 7),
    prisma(retArredondado(36, 22, 2, [xP, yR]), zC0 - 18, zC0 - 17.99))
  const matriz = prisma(retArredondado(38, 24, 2, [xP, yR]), zC0 - 24, zC0 - 17.98)
  const encaixe = caixaXYZ(xP - MEC.haste / 2 - 0.2, xP + MEC.haste / 2 + 0.2, yR - MEC.haste / 2 - 0.2, yR + MEC.haste / 2 + 0.2, zC0 - 9.2, zC0)
  const faixa = gravarFrente(listras(xP, zC0 - 21, 34, 4.4, 4), yR - 12, 0.5)
  return subtract(union(colar, cone, matriz), encaixe, faixa)
}

/* ======================= Cilindro hidráulico (em cima da coroa) ======================= */

function cilindroHidraulico(p) {
  const m = medidas(p)
  const { cy, zTopo } = m
  const pino = cilindroZ(4, zTopo - 3.5, zTopo + 0.01, 0, cy)
  const flangeBaixo = prisma(retArredondado(24, 24, 2.5, [0, cy]), zTopo, zTopo + 3)
  const corpo = cilindroZ(10, zTopo + 3 - 0.01, zTopo + 23 + 0.01, 0, cy)
  const flangeCima = prisma(retArredondado(23, 23, 2.5, [0, cy]), zTopo + 23, zTopo + 26)
  const tirantes = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) tirantes.push(cilindroZ(1.4, zTopo + 3 - 0.01, zTopo + 23 + 0.01, sx * 9.2, cy + sy * 9.2, 16))
  // Aro da tampa do cilindro: só um sulco, para continuar plano na mesa da impressora.
  const sulco = prisma(anel(6.5, 5.7, [0, cy]), zTopo + 25.5, zTopo + 26.01)
  return subtract(union(pino, flangeBaixo, corpo, flangeCima, ...tirantes), sulco)
}

/* ======================= Caixa de comando (módulo de relés + entrada de 12 V) ======================= */

function caixaComando(p) {
  const m = medidas(p)
  const c = m.cmd
  const W = COMANDO.largura
  const L = COMANDO.comprimento
  const casca = subtract(
    cascoComSapata(p, W, L, c.cx, c.cy, m.zTopoBase),
    prisma(retArredondado(W - 2 * p.parede, L - 2 * p.parede, m.rInt, [c.cx, c.cy]), p.fundo, m.zTopoBase + 1),
  )
  // Postes dos 2 parafusos da tampa (M3 autoatarraxante, furo-guia de 2,5 mm): a torre faz alavanca, então a
  // tampa vai parafusada.
  const postes = c.postes.map(([x, y]) => cilindroZ(4.5, p.fundo - 0.01, m.zTopoBase, x, y))
  const guias = c.postes.map(([x, y]) => cilindroZ(1.25, p.fundo + 4, m.zTopoBase + 1, x, y, 16))
  // Berço do módulo de relés: cantoneiras de 10 mm nos cantos e apoios de 3 mm (as soldas de baixo ficam no ar).
  const r = c.rele
  const folga = 0.4
  const cantos = []
  const apoios = []
  for (const [x, sx] of [[r.x0 - folga, -1], [r.x1 + folga, 1]]) {
    for (const [y, sy] of [[r.y0 - folga, -1], [r.y1 + folga, 1]]) {
      cantos.push(rectangle({ size: [1.6, 9], center: [x + sx * 0.8, y - sy * 3.7] }))
      cantos.push(rectangle({ size: [9, 1.6], center: [x - sx * 3.7, y + sy * 0.8] }))
      apoios.push(rectangle({ size: [5, 5], center: [x - sx * 2.5, y - sy * 2.5] }))
    }
  }
  const berco = union(prisma(union(cantos), p.fundo - 0.01, p.fundo + 10), prisma(union(apoios), p.fundo - 0.01, r.z0))
  // Parede da esquerda: passagem dos fios que vêm da base. Parede de trás: conector P4 de 12 V.
  const cabo = passagem(m, c.x0 - p.parede * 2, p.parede * 4)
  const conector = cilindroY(p.conector12v / 2, p.parede * 4, [c.x1 - 13, c.y1 - p.parede / 2, p.fundo + 20])
  // Frente: rebaixo para a unha e a faixa zebrada, iguais aos da base.
  const unha = cuboid({ size: [18, p.parede * 4, 2.4], center: [c.cx, c.y0 + p.parede / 2, m.zTopoBase - 1.2] })
  const faixa = gravarFrente(listras(c.cx, p.fundo + 34, 60, 7), c.y0, GRAVACAO_LADO)
  return subtract(union(casca, ...postes, berco), ...guias, cabo, conector, unha, faixa)
}

/* Tampa da caixa de comando: a torre de sinalização é parafusada nela (3 parafusos M4 no pé). */
function tampaComando(p) {
  const m = medidas(p)
  const c = m.cmd
  const W = COMANDO.largura
  const L = COMANDO.comprimento
  const z0 = m.zTopoBase
  const z1 = m.zTopoTampa
  const placa = prisma(retArredondado(W, L, p.raio, [c.cx, c.cy]), z0, z1)
  const saiaEsp = 1.6
  const Wi = W - 2 * p.parede - 2 * p.encaixe
  const Li = L - 2 * p.parede - 2 * p.encaixe
  const saia = subtract(
    prisma(subtract(
      retArredondado(Wi, Li, m.rInt - p.encaixe, [c.cx, c.cy]),
      retArredondado(Wi - 2 * saiaEsp, Li - 2 * saiaEsp, m.rInt - p.encaixe - saiaEsp, [c.cx, c.cy]),
    ), z0 - 5, z0),
    ...c.postes.map(([x, y]) => cilindroZ(5.2, z0 - 6, z0 + 0.01, x, y)),     // a saia desvia dos postes
  )
  const parafusos = c.postes.map(([x, y]) => cilindroZ(1.7, z0 - 1, z1 + 1, x, y, 16))
  // Torre: rebaixo de 1 mm do tamanho do pé (centraliza), furo do meio para os fios e os 3 furos do pé.
  const rebaixo = cilindroZ(p.torrePe / 2 + 0.4, z1 - 1, z1 + 1, c.cx, c.cy, 96)
  const fiosTorre = cilindroZ(p.torreFios / 2, z0 - 1, z1 + 1, c.cx, c.cy)
  const furosPe = [0, 1, 2].map((i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3
    return cilindroZ(p.torreFuro / 2, z0 - 1, z1 + 1, c.cx + (p.torreFuros / 2) * Math.cos(a), c.cy + (p.torreFuros / 2) * Math.sin(a), 24)
  })
  // Gravações: identificação na frente e "12 V" perto do conector.
  const gravacoes = union(
    texto('P-01 COMANDO', { largura: 58, altura: 6, traco: 0.9, x: c.cx, cy: c.y0 + 10 }),
    texto('12 V', { largura: 16, altura: 6, traco: 0.9, x: c.x1 - 13, cy: c.y1 - 22 }),
  )
  const gravado = prisma(gravacoes, z1 - GRAVACAO, z1 + 1)
  return subtract(union(placa, saia), parafusos, rebaixo, fiosTorre, ...furosPe, gravado)
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
  VIN: ['dir', 0], GND_D: ['dir', 1], D13: ['dir', 2], D27: ['dir', 5], D26: ['dir', 6], D25: ['dir', 7], D33: ['dir', 8], D32: ['dir', 9],
}
const TRILHO_GND_X = 95.8   // trilho azul (−) da borda direita do protoboard grande
const TRILHO_5V_X = 98.3    // trilho vermelho (+), ligado no VIN: alimenta o servo e o módulo de relés
const CAPACITOR_Y = 100

/* Módulo de relés: centro de cada relé (k = 0 a 3) ao longo do comprimento, e os 6 pinos na ponta da frente. */
const PINOS_RELE = ['GND', 'IN1', 'IN2', 'IN3', 'IN4', 'VCC']
const yRele = (m, k) => m.cmd.rele.y0 + 12 + k * 17.5
const pinoRele = (m, i) => [m.cmd.rele.x0 + RELE.largura / 2 - 6.35 + i * 2.54, m.cmd.rele.y0 + 3]
// Bornes de cada relé (parafusos ao longo de y): NO na frente, COM no meio, NC atrás.
const borne = (m, k, nome) => [m.cmd.rele.x1 - 4.75, yRele(m, k) + { NO: -5, COM: 0, NC: 5 }[nome]]

function placas(p) {
  const m = medidas(p)
  const f = p.fundo
  const zb = f + 9.5
  const caixa = (x, y, w, l, z0, h, cor, grupo) =>
    marcar(colorize(cor, cuboid({ size: [w, l, h], center: [m.px(x + w / 2), m.py(y + l / 2), z0 + h / 2] })), grupo)
  const meio = p.protoLargura / 2
  const topoEsp = p.protoComprimento + p.sobraEsp
  const lista = [
    caixa(meio, 0, p.protoLargura - meio, p.protoComprimento, f, 9.5, [0.93, 0.93, 0.9], 'base'),          // protoboard grande
    caixa(0, p.protoComprimento / 2, meio, p.protoComprimento / 2, f, 9.5, [0.93, 0.93, 0.9], 'base'),      // protoboard pequeno
    caixa(p.usbX - ESP.largura / 2, topoEsp - ESP.comprimento, ESP.largura, ESP.comprimento, f + 12, 1.6, [0.1, 0.1, 0.12], 'base'), // ESP32
    caixa(p.usbX - 9, topoEsp - 33, 18, 25.5, f + 13.6, 3.2, [0.72, 0.72, 0.74], 'base'),                   // módulo WROOM
    caixa(p.usbX - 4, topoEsp - 5, 8, 5, f + 13.6, 2.8, [0.75, 0.75, 0.78], 'base'),                       // micro-USB
    caixa(LEITOR.x, LEITOR.y, LEITOR.comprimento, LEITOR.largura, m.zTopoBase - 0.4 - 1.6, 1.6, [0.12, 0.3, 0.75], 'tampa'), // MFRC522
    // Capacitor de 470 µF em pé entre os trilhos (+ e −), perto de onde chega o fio do servo.
    marcar(colorize([0.12, 0.16, 0.35], cilindroZ(4, zb + 1.5, zb + 14, m.px((TRILHO_GND_X + TRILHO_5V_X) / 2), m.py(CAPACITOR_Y), 24)), 'base'),
  ]

  // Módulo de 4 relés na caixa de comando: placa azul, 4 relés, bornes de parafuso e os 6 pinos.
  const c = m.cmd
  const rl = c.rele
  const zPlaca = rl.z0 + 1.6
  const azulRele = [0.12, 0.3, 0.75]
  lista.push(marcar(colorize(azulRele, caixaXYZ(rl.x0, rl.x1, rl.y0, rl.y1, rl.z0, zPlaca)), 'comando'))
  for (let k = 0; k < 4; k++) {
    const y = yRele(m, k)
    lista.push(marcar(colorize([0.18, 0.45, 0.9], caixaXYZ(rl.x0 + 14, rl.x0 + 33, y - 7.5, y + 7.5, zPlaca, zPlaca + 15.5)), 'comando'))
    lista.push(marcar(colorize([0.16, 0.36, 0.78], caixaXYZ(rl.x1 - 9, rl.x1 - 0.5, y - 7.5, y + 7.5, zPlaca, zPlaca + 10)), 'comando'))
    for (const dy of [-5, 0, 5]) lista.push(marcar(colorize([0.75, 0.76, 0.78], cilindroZ(1.4, zPlaca + 10, zPlaca + 10.6, rl.x1 - 4.75, y + dy, 12)), 'comando'))
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = pinoRele(m, i)
    lista.push(marcar(colorize([0.85, 0.7, 0.3], caixaXYZ(x - 0.32, x + 0.32, y - 0.32, y + 0.32, zPlaca, zPlaca + 8.5)), 'comando'))
  }
  // Conector P4 de 12 V na parede de trás (corpo por dentro).
  lista.push(marcar(colorize([0.08, 0.08, 0.09], cilindroY(4.5, 14, [c.x1 - 13, c.y1 - p.parede - 7, p.fundo + 20], 24)), 'comando'))

  // Torre de sinalização HDL-T50L-3C-J parafusada na tampa da caixa de comando.
  const coresTorre = [[0.13, 0.82, 0.48], [1, 0.75, 0.15], [1, 0.22, 0.16]]
  const nomesTorre = ['verde', 'amarelo', 'vermelho']
  const branco = [0.93, 0.93, 0.92]
  let z = m.zTopoTampa
  const peca = (raio, altura, cor, extra) => {
    const g = marcar(colorize(cor, cilindroZ(raio, z, z + altura, c.cx, c.cy, 64)), 'torre', extra)
    z += altura
    return g
  }
  lista.push(peca(p.torrePe / 2, TORRE.alturaPe, branco))
  lista.push(peca(TORRE.haste / 2, TORRE.alturaHaste, [0.72, 0.74, 0.77]))
  lista.push(peca(TORRE.corpo / 2, TORRE.alturaBase, branco))
  TORRE.gomos.forEach((h, i) => lista.push(peca(TORRE.corpo / 2, h, coresTorre[i], { brilho: true, led: nomesTorre[i] })))
  lista.push(peca(TORRE.corpo / 2 - 3, TORRE.alturaTopo, branco))
  // Servo SG90 (azul) deitado na coroa, com o eixo para a direita.
  const xs = m.xServo
  const y0 = m.yR - SERVO.eixoDaPonta
  const azulServo = [0.16, 0.34, 0.85]
  lista.push(marcar(colorize(azulServo, union(
    caixaXYZ(xs, xs + SERVO.corpo, y0, y0 + SERVO.comprimento, m.zs - SERVO.largura / 2, m.zs + SERVO.largura / 2),
    caixaXYZ(xs + SERVO.abaAltura, xs + SERVO.abaAltura + SERVO.abaEsp, y0 - 5, y0 - 5 + SERVO.abas, m.zs - SERVO.largura / 2, m.zs + SERVO.largura / 2),
    cilindroX(5.6, 2.2, [xs + SERVO.corpo + 1.1, m.yR, m.zs], 32),
  )), 'servo'))
  lista.push(marcar(colorize([0.95, 0.95, 0.95], cilindroX(2.2, 1.9, [m.xBraco - MEC.braco - 0.95, m.yR, m.zs], 24)), 'servo')) // eixo
  // Braço do servo (cortado logo depois do furo usado) e o pino de clipe, que giram juntos.
  const xb0 = m.xBraco - MEC.braco
  const bracoForma = hull(circle({ radius: 3.2, center: [0, 0], segments: 24 }), circle({ radius: 2, center: [p.manivela + 1.6, 0], segments: 24 }))
  // rotateY(−90°) leva o braço (desenhado ao longo de +x) para +z e a espessura para −x.
  const braco = translate([m.xBraco, m.yR, m.zs], rotateY(-Math.PI / 2, extrudeLinear({ height: MEC.braco }, bracoForma)))
  lista.push(marcar(colorize([0.97, 0.97, 0.95], braco), 'manivela'))
  lista.push(marcar(colorize([0.78, 0.8, 0.84], cilindroX(p.pino / 2, m.xP + MEC.haste / 2 + 1.5 - xb0, [(xb0 + m.xP + MEC.haste / 2 + 1.5) / 2, m.yR, m.zs + p.manivela], 12)), 'manivela'))
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

  // Leitor RFID: os 8 pinos ficam na ponta esquerda da placa (deitada), apontando para baixo.
  const xPinoRfid = LEITOR.x + 2.5
  const yPinoRfid = (k) => LEITOR.y + LEITOR.largura / 2 + 8.89 - 2.54 * k
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
    const y = yPinoRfid(k)
    const [fx, fy] = furo(alvo)
    fio(id, `Leitor ${pino}`, `Leitor RFID · ${pino}`, `ESP32 · ${rotulo}`, cor, [
      P(xPinoRfid, y, zT - 8, 'tampa'), P(xPinoRfid - 0.5, y + 1, zT - 14, 'tampa'),
      P(18 + k * 1.2, 70, zb + 24 - k, 'meio'),
      P(fx - 6 + k * 0.5, fy - 12, zb + 14, 'base'),
      ...noProto([fx, fy]),
    ])
  }

  // Módulo de relés: 6 fios do protoboard até os pinos, passando pela abertura lateral entre as duas caixas.
  const c = m.cmd
  const zPinos = c.rele.z0 + 1.6 + 8.5
  const sinaisRele = [
    ['rele-in1', 'IN1', 'D27', 'ESP32 · GPIO 27', 'luz verde', '#22D07B'],
    ['rele-in2', 'IN2', 'D26', 'ESP32 · GPIO 26', 'luz amarela', '#FFD23F'],
    ['rele-in3', 'IN3', 'D25', 'ESP32 · GPIO 25', 'luz vermelha', '#FF7043'],
    ['rele-in4', 'IN4', 'D33', 'ESP32 · GPIO 33', 'buzzer da torre', '#9C4DCC'],
    ['rele-vcc', 'VCC', null, 'trilho + (5 V do VIN)', '', '#E53935'],
    ['rele-gnd', 'GND', null, 'trilho GND (−)', '', '#3B3B3B'],
  ]
  sinaisRele.forEach(([id, pinoNome, alvo, de, funcao, cor], k) => {
    const origem = alvo ? furo(alvo) : pinoNome === 'VCC' ? [TRILHO_5V_X, 92 - k] : [TRILHO_GND_X, 90 - k]
    const [px, py] = pinoRele(m, PINOS_RELE.indexOf(pinoNome))
    const dz = (k - 2.5) * 1.4
    fio(id, `Relé ${pinoNome}`, de, `módulo de relés · ${pinoNome}${funcao ? ` (${funcao})` : ''}`, cor, [
      ...noProto(origem).reverse(),
      B(m.We / 2 - 9, c.yPassagem + (k - 2.5) * 1.6, PASSAGEM.z + dz, 'base'),
      B(c.x0 + 6, c.yPassagem + (k - 2.5) * 1.6, PASSAGEM.z + dz, 'comando'),
      B(px, py - 10, zPinos + 10, 'comando'),
      B(px, py, zPinos, 'comando'),
    ])
  })

  // Torre: os 5 fios descem pela haste, passam pelo furo do meio da tampa e vão aos bornes dos relés.
  const zBorne = c.rele.z0 + 1.6 + 10.6
  const fiosTorre = [
    ['torre-verde', 'fio verde', 0, '#22D07B', 'NO1 (relé 1)'],
    ['torre-amarelo', 'fio amarelo', 1, '#FFD23F', 'NO2 (relé 2)'],
    ['torre-vermelho', 'fio vermelho', 2, '#E53935', 'NO3 (relé 3)'],
    ['torre-roxo', 'fio roxo (buzzer)', 3, '#8E44AD', 'NO4 (relé 4)'],
  ]
  for (const [id, nome, k, cor, para] of fiosTorre) {
    const [bx, by] = borne(m, k, 'NO')
    fio(id, `Torre · ${nome}`, `Torre · ${nome}`, `borne ${para}`, cor, [
      B(c.cx + (k - 1.5) * 1.6, c.cy, m.zTopoTampa + 3, 'torre'),
      B(c.cx + (k - 1.5) * 1.6, c.cy, m.zTopoBase - 6, 'tampaComando'),
      B(bx - 8, by - 4, zBorne + 10, 'comando'),
      B(bx, by, zBorne, 'comando'),
    ])
  }
  const conector = [c.x1 - 13, c.y1 - p.parede - 14, p.fundo + 20]
  fio('torre-preto', 'Torre · fio preto (comum)', 'Torre · fio preto (comum, −)', 'conector de 12 V · − (negativo)', '#2B2B2B', [
    B(c.cx + 3.5, c.cy, m.zTopoTampa + 3, 'torre'),
    B(c.cx + 3.5, c.cy, m.zTopoBase - 6, 'tampaComando'),
    B(conector[0] - 3, conector[1] - 6, conector[2] + 10, 'comando'),
    B(conector[0] - 1.5, conector[1], conector[2], 'comando'),
  ])
  const [c1x, c1y] = borne(m, 0, 'COM')
  fio('fonte-mais', 'Fonte 12 V +', 'conector de 12 V · + (positivo)', 'borne COM1 (relé 1)', '#C62828', [
    B(conector[0] + 1.5, conector[1], conector[2], 'comando'),
    B(conector[0] + 1, conector[1] - 14, conector[2] + 8, 'comando'),
    B(c1x + 6, c1y + 8, zBorne + 8, 'comando'),
    B(c1x, c1y, zBorne, 'comando'),
  ])
  for (let k = 0; k < 3; k++) {
    const [ax, ay] = borne(m, k, 'COM')
    const [bx, by] = borne(m, k + 1, 'COM')
    fio(`ponte-com${k + 1}`, `Ponte COM${k + 1} → COM${k + 2}`, `borne COM${k + 1}`, `borne COM${k + 2} (12 V +)`, '#C62828', [
      B(ax, ay, zBorne, 'comando'), B(ax + 3, ay + 2, zBorne + 5, 'comando'), B(bx + 3, by - 2, zBorne + 5, 'comando'), B(bx, by, zBorne, 'comando'),
    ], 0.6)
  }
  fio('fonte-12v', 'Fonte de 12 V', 'fonte de 12 V (da tomada)', 'conector de 12 V da caixa', '#2B2B2B', [
    B(conector[0], c.y1 + 2, conector[2], 'comando'), B(conector[0], c.y1 + 16, conector[2], 'comando'),
    B(conector[0] + 6, c.y1 + 34, conector[2] - 8, 'comando'), B(conector[0] + 14, c.y1 + 48, 3, 'comando'),
  ], 2)

  // Servo: o cabo de 3 fios desce pela coluna esquerda.
  const xColE = m.colunasX[0]
  const [sfx, sfy] = furo('D13')
  const saidaServo = (k) => [B(m.xServo - 0.5, m.yR + 2 + k * 1.3, m.zs - 3, 'servo'), B(m.xServo - 5, m.cy + k * 1.3 - 1.3, m.zC0 + 6, 'portico')]
  const servo = [
    ['servo-sinal', 'Servo · sinal', 'Servo · fio laranja (sinal)', 'ESP32 · GPIO 13', '#FB8C00', 0, [sfx, sfy]],
    ['servo-5v', 'Servo · 5 V', 'Servo · fio vermelho (5 V)', 'trilho + (5 V do VIN)', '#E53935', 1, [TRILHO_5V_X, CAPACITOR_Y - 6]],
    ['servo-gnd', 'Servo · GND', 'Servo · fio marrom (GND)', 'trilho GND (−)', '#6D4C41', 2, [TRILHO_GND_X, CAPACITOR_Y - 8]],
  ]
  for (const [id, nome, de, para, cor, k, alvoServo] of servo) {
    fio(id, nome, de, para, cor, [
      ...saidaServo(k),
      B(xColE + 1.5 - k * 1.1, m.cy, m.zC0 - 20, 'portico'),
      B(xColE + 1.5 - k * 1.1, m.cy, m.zTopoTampa - 9, 'portico'),
      B(xColE + 4 + k * 2, m.cy + 8, zb + 26, 'meio'),
      P((PORTICO.colunasX[0] + alvoServo[0]) / 2, (PORTICO.y + alvoServo[1]) / 2 + 6, zb + 18, 'base'),
      ...noProto(alvoServo),
    ])
  }
  const [vx, vy] = furo('VIN')
  fio('vin-trilho', 'VIN → trilho +', 'ESP32 · VIN (5 V do USB)', 'trilho + (servo e capacitor)', '#C62828', [
    ...noProto([vx + 2.54 * 2, vy]).reverse(), P((vx + TRILHO_5V_X) / 2, vy - 1, zb + 8, 'base'), ...noProto([TRILHO_5V_X, vy - 3]),
  ])

  // ESP32 → trilho GND, para o servo e o módulo de relés terem o mesmo GND.
  const [gx, gy] = furo('GND_D')
  fio('gnd-esp', 'GND do ESP32', 'ESP32 · GND', 'trilho GND (−)', '#3B3B3B', [
    ...noProto([gx, gy]).reverse(), P((gx + TRILHO_GND_X) / 2, gy - 1, zb + 7, 'base'), ...noProto([TRILHO_GND_X, gy - 2]),
  ])

  // Cabo USB que alimenta o ESP32 (sai por trás).
  const yParede = m.Le / 2
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
  tampaMec: [1, 0.24, 0.18],        // mesma cor do pórtico
  pistao: [0.5, 0.53, 0.58],        // cinza (a haste)
  martelo: [1, 0.82, 0.25],         // amarelo do martelo, como na P-01
  cilindro: [0.5, 0.53, 0.58],      // cinza
  comando: [0.2, 0.22, 0.28],       // grafite, igual à base
  tampaComando: [0.66, 0.69, 0.74], // cinza-aço, igual à mesa
}

/* Quanto cada peça sobe na vista explodida (mm). */
const EXPLOSAO = {
  base: 0, tampa: 50, martelo: 45, pistao: 70, tampaMec: 95, servo: 108, manivela: 108, portico: 135, cilindro: 165,
  comando: 0, tampaComando: 50, torre: 80,
}

function pecasMontadas(p) {
  const casca = (nome, g) => marcar(colorize(CORES[nome], g), nome, { tipo: 'caixa' })
  return [
    casca('base', base(p)),
    casca('tampa', tampa(p)),
    casca('portico', portico(p)),
    casca('tampaMec', tampaMecanismo(p)),
    casca('pistao', pistao(p)),
    casca('martelo', martelo(p)),
    casca('cilindro', cilindroHidraulico(p)),
    casca('comando', caixaComando(p)),
    casca('tampaComando', tampaComando(p)),
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
  if (p.peca === 'tampa') return naMesa(rotateX(Math.PI, tampa(p)))                 // de cabeça para baixo
  if (p.peca === 'portico') return naMesa(rotateX(Math.PI, portico(p)))             // coroa na mesa, colunas para cima
  if (p.peca === 'tampaMec') return naMesa(tampaMecanismo(p))                       // placa na mesa, bucha para cima
  if (p.peca === 'pistao') return naMesa(rotateY(-Math.PI / 2, pistao(p)))          // deitado de lado: o rasgo fica em pé
  if (p.peca === 'martelo') return naMesa(martelo(p))                               // matriz na mesa
  if (p.peca === 'cilindro') return naMesa(rotateX(Math.PI, cilindroHidraulico(p))) // tampa do cilindro na mesa
  if (p.peca === 'comando') return naMesa(caixaComando(p))                          // em pé, como a base
  if (p.peca === 'tampaComando') return naMesa(rotateX(Math.PI, tampaComando(p)))   // de cabeça para baixo
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

module.exports = {
  main, getParameterDefinitions, base, tampa, portico, tampaMecanismo, pistao, martelo, cilindroHidraulico,
  caixaComando, tampaComando, placas, fios, pecasMontadas, medidas, padroes, CORES, EXPLOSAO, TORRE,
}
