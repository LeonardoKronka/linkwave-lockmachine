# DESIGN.md · LinkWave e LockMachine

Como o projeto é desenhado. Leia antes de mexer em qualquer tela. O sistema completo (tokens, componentes com
prévia, logos e ícones) está no design system: https://claude.ai/artifact/Xj7upFJDECzTw9jEn7M6Yd (privado; compartilhe
pelo menu Share para a equipe ver).

## Dois mundos, uma marca

| Superfície | Tema | Cena real | Arquivos |
|---|---|---|---|
| Site (`index.html`, `lockmachine.html`, `privacidade.html`, `termos.html`) | escuro | chão de fábrica à noite: piso de epóxi, painéis com pintura eletrostática, luz só de fontes reais | `assets/css/styles.css`, `assets/js/scene-*.js` |
| App (`app/`) | claro | bancada de trabalho: uso diário, legível sob luz de escritório e no celular | `app/app.css` |

As duas abrem do mesmo véu escuro (`#06070A`) e passam uma para a outra sem corte.

## Regras verificáveis

- Duas famílias de fonte, nunca mais: Archivo (tudo) e Martian Mono (só dados: UID, códigos, motivos, horários).
- Títulos em frase normal, peso 800, `font-stretch: 106%`, `letter-spacing` entre -0.034em e -0.012em. Maiúsculas só em rótulos de até 3 palavras.
- Texto corrido com 4.5:1 de contraste ou mais nos dois temas; legenda (`--text-3`) nunca em parágrafo.
- No site, cor de luz só onde existe fonte de luz: torre (verde, âmbar, vermelho), LED da leitora, luz azul da LinkWave. Degradê radial de seção no máximo a 30%.
- Peças físicas (cartão RFID, etiqueta de bloqueio, crachá) são claras também no site escuro.
- Sombras sempre com deslocamento e desfoque (`--shadow-1`, `--shadow-2`), desfoque de no máximo 32 px (sombras maiores travavam a rolagem). Proibido: sombra sólida sem desfoque, borda de 3px, texto em degradê, vidro decorativo, rótulo acima de título, emoji.
- O que se mexe com a rolagem ou balança (placas, etiqueta, crachás, passos, fragmentos, celulares, onda) tem `will-change: transform`: desliza na GPU em vez de ser redesenhado a cada quadro.
- Toda cor de estado vem com palavra ou ícone ("Liberado", "Bloqueado", "Vencendo").
- Animação: `expo.out` para entrar, `expo.inOut`/`power3.inOut` para deslocar; `bounce` proibido; `elastic`/`back` só em objetos físicos.
- Foco visível em todo controle: 2px em `--yellow` (site) ou `--red` (app), com 3px de folga.
- Nenhum script inline, CDN ou fonte de fora (a CSP do `.htaccess` bloqueia).

## Referências e o que não queremos

- Quer: a sensação de produto do vídeo de motion (notebook escuro sobre piso espelhado), o painel minimalista com entradas em
  sequência (vídeo 6), o site do amigo (syncsentrix.com.br) na fluidez da abertura.
- Não quer: cara de template de SaaS (título à esquerda, print à direita, fileira de cards iguais), preto com neon em todas as
  bordas, o visual "chunky" antigo de bordas grossas e sombras sólidas, números inventados.

## Peças com assinatura

- **Abertura**: a marca é montada em CSS no primeiro quadro, voa até o logo da barra e abre um furo no véu (`main.js`). No app, o cadeado faz o mesmo (`app.js`, `abrirApp`).
- **Cenas 3D** (`scene-kit.js`): piso espelhado com desfoque, ambiente de estúdio para reflexos, lâmpadas de galpão ao fundo.
  - Início (`scene-home.js`): o símbolo Encaixe em alumínio anodizado; as metades travam quando o véu abre e seguem o ponteiro.
  - LockMachine (`scene-lm.js`): prensa hidráulica P-01 de duas colunas (cilindro com tirantes, haste cromada, martelo
    amarelo com matriz, mesa com rasgos em T, cortina de luz, tela de proteção, manômetro, plaqueta), unidade hidráulica com
    motor azul e mangueiras, e o posto bimanual à frente: botões bimanuais, emergência, leitora e torre de sinalização com
    lentes estriadas. Liberado: a torre fica verde, os botões acendem e a prensa faz o ciclo (manômetro sobe, a peça sai
    estampada). Bloqueado: a torre pisca em vermelho e a prensa não se move. A linha de verdito sob o título acompanha e uma
    nota avisa que é ilustração com dados fictícios (Ana, Bruno), os mesmos do simulador.
  - Piso: espelho com desfoque de 5 amostras que esmaece com a distância do objeto (como epóxi), em meia resolução.
  - Pausam fora da tela; com movimento reduzido mostram um quadro parado; sem WebGL o site mostra a versão plana.
- **Torre em miniatura** no app (`.lamp-tower`): status de cada máquina como a torre dela.

## Verificar antes de entregar

1. Abrir a página no navegador, tirar print e listar três coisas erradas antes de corrigir.
2. Conferir em 360, 390, 768, 1024 e 1440 px: sem rolagem horizontal, título sem quebrar palavra.
3. Console sem erro (o 404 de `downloads/lockmachine.apk` é esperado até o APK existir).
4. Desempenho: carregar e rolar a página medindo quadros (Long Animation Frames no console ou o painel Performance).
   Referência na RTX 4060 do PO: depois do 1º carregamento da sessão, nenhuma trava acima de ~50 ms na rolagem.
