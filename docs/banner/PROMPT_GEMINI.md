# Versão alternativa do banner no Gemini

O arquivo para a gráfica é o PDF vetorial desta pasta. O Gemini serve para gerar outra proposta visual, com três limites:

1. **Logos**: gerador de imagem não reproduz o símbolo "Encaixe" nem o cadeado do LockMachine. Os prompts pedem espaços
   vazios, e as logos entram depois, por cima, a partir dos arquivos oficiais com fundo transparente:
   `assets/brand/linkwave-horizontal-escuro.png` (2500 × 480 px) e `assets/brand/lockmachine-horizontal-escuro.png` (3232 × 480 px).
2. **QR code**: o Gemini não gera QR que funcione. Cole por cima o `qr-lockmachine-app.png` desta pasta.
3. **Resolução**: para 70 × 90 cm a 150 dpi, a imagem final precisa de 4134 × 5315 px. O Gemini entrega bem menos, então amplie
   (upscale) antes de exportar o PDF e confira cada texto, letra por letra, com acentos.

Use o **prompt 1** para pedir o banner completo. Se os textos saírem com erro, use o **prompt 2**: ele pede só a arte, sem texto,
e você monta os textos, as logos e o QR no Canva ou no PowerPoint.

## Prompt 1: banner completo

```text
Crie a arte de um banner vertical para impressão, com 70 cm de largura por 90 cm de altura (proporção 7:9; se não for possível, use 4:5). É o banner da mesa de apresentação de um Trabalho de Conclusão de Curso de tecnologia.

IMPORTANTE SOBRE AS LOGOS: não desenhe nenhum logotipo, símbolo de marca ou ícone de empresa. As duas logos (LinkWave e LockMachine) serão aplicadas depois, por cima da imagem, a partir dos arquivos oficiais. No lugar delas, deixe áreas vazias com o fundo liso, sem nenhum desenho.

Estilo visual: "chão de fábrica à noite". Fundo quase preto (#06070A), cinematográfico e minimalista, com linhas divisórias finas e discretas. A luz vem só de fontes reais: uma torre de sinalização industrial e um leve brilho azul-cobalto (#2F45FF) no canto superior esquerdo. Objetos físicos (cartão RFID, leitora, etiqueta) são claros, quase brancos. Cores da marca: cobalto #2F45FF, vermelho #FF3D2E, amarelo #FFD23F, verde #22D07B. Tipografia sem serifa, larga e pesada (como Archivo ExtraBold expandida), títulos em frase normal (não tudo em maiúsculas), texto claro #ECEEF4 e texto secundário cinza #A6ACC0. Fonte monoespaçada só nos dados técnicos.

Composição, de cima para baixo, com margem larga em volta (pelo menos 7% da largura):
1. Topo à esquerda: área vazia retangular e horizontal, com cerca de metade da largura do banner, para a logo da LinkWave. Topo à direita: uma pílula escura com contorno fino, um ponto amarelo aceso e o texto "MVP em desenvolvimento".
2. Logo abaixo, em texto pequeno cinza: "TCC · Técnico em Desenvolvimento de Sistemas · SENAI Mococa · 2026". Depois, uma linha fina horizontal.
3. Área vazia retangular e horizontal, com cerca de metade da largura, para a logo do LockMachine.
4. Título grande, em duas linhas, alinhado à esquerda: "Sem capacitação válida, sem acesso." A palavra "válida" fica em letras escuras sobre uma etiqueta de papel clara, levemente inclinada.
5. Abaixo do título, em cinza: "O cartão RFID identifica. O servidor confere:"
6. Lista com três itens, cada um com um círculo verde com visto: "Cadastro ativo", "Máquina disponível", "Capacitações na validade".
7. Em cinza: "Toda tentativa fica registrada com o motivo."
8. Ocupando a coluna da direita, ao lado dos itens 3 a 7: uma torre de sinalização industrial vista de frente, com três módulos de lente estriada (vermelho em cima, âmbar no meio, verde embaixo), tampa escura com furos de buzzer e base escura. Só o módulo verde está aceso, iluminando o fundo com um brilho verde suave. Embaixo da torre, uma pílula com ponto verde e o texto "Liberado".
9. Seção "Como funciona": quatro etapas em linha, ligadas por setas tracejadas finas. Cada etapa tem um desenho simples, o nome e um dado técnico em fonte monoespaçada:
   - um cartão RFID branco: "Cartão RFID", "13,56 MHz";
   - uma leitora branca com símbolo de aproximação e três LEDs (verde aceso): "Leitora", "ESP32 + MFRC522";
   - um cilindro de banco de dados escuro com o símbolo </>: "Servidor", "API PHP + MySQL";
   - um celular com um aplicativo claro: "App", "Web e Android".
10. Faixa de baixo, à esquerda: um quadrado branco vazio, sem nada dentro, para o QR code, que será aplicado depois. Ao lado: "Baixe o app", "Aponte a câmera do celular." e, logo abaixo, em fonte monoespaçada, "somoslinkwave.com.br".
11. Faixa de baixo, à direita: o título "Feito pela LinkWave" e os nomes, cada um com o papel em cinza ao lado: "Leonardo Kronka Rodrigues · Product Owner · Full-stack", "Cauê Henrique de Oliveira · Scrum Master · Back-end", "Evelyn Caporali Escanavaque · Front-end", "João Victor Monteiro Gamero · Banco de dados", "Gabriel Miranda · Documentação".
12. Por último, uma linha pequena: "Orientação: Prof. Leonardo Oliveira Casellato, Prof. Ricardo Akira Harada e Prof. Wellinton Cardoso Teodoro".

Visual minimalista, com bastante respiro entre as seções e pouco texto. Escreva todos os textos exatamente como estão entre aspas, em português do Brasil, com todos os acentos, sem inventar palavras, números ou dados. Não inclua pessoas, fotos de pessoas, emojis, logotipos de outras empresas ou instituições, texto em degradê, efeito de vidro, neon em todas as bordas nem sombras duras sem desfoque. Imagem nítida, em alta resolução, pronta para impressão.
```

## Prompt 2: só a arte, sem texto

```text
Crie uma imagem vertical para o fundo de um banner impresso de 70 cm de largura por 90 cm de altura (proporção 7:9; se não for possível, use 4:5), sem nenhum texto, letra, número, logotipo ou marca.

Estilo "chão de fábrica à noite": fundo quase preto (#06070A), cinematográfico e minimalista, com um leve brilho azul-cobalto (#2F45FF) vindo do canto superior esquerdo. Na coluna da direita, entre 15% e 55% da altura, uma torre de sinalização industrial vista de frente, com três módulos de lente estriada (vermelho em cima, âmbar no meio, verde embaixo), tampa escura com furos de buzzer e base escura. Só o módulo verde está aceso, iluminando o fundo ao redor com um brilho verde suave. Um piso escuro e discreto reflete a luz verde embaixo da torre.

Deixe todo o resto do banner com o fundo escuro liso e limpo: o lado esquerdo e a metade de baixo vão receber textos, logos e um QR code depois. Sem pessoas, sem emojis, sem neon nas bordas, sem efeito de vidro, sem sombras duras. Imagem nítida, em alta resolução, para impressão.
```

## Depois de gerar

1. Aplique as logos oficiais nas áreas vazias (arquivos `*-horizontal-escuro.png` de `assets/brand/`, sem esticar).
2. Aplique o `qr-lockmachine-app.png` no quadrado branco e teste com o celular.
3. Confira todos os textos com os do PDF vetorial. O selo "MVP em desenvolvimento" é obrigatório (exigência de
   honestidade do professor).
4. Amplie a imagem para 4134 × 5315 px ou mais e exporte em PDF no tamanho 70 × 90 cm.
