# Banner da apresentação do TCC (70 × 90 cm)

Banner da mesa, minimalista: LinkWave no topo, LockMachine em destaque, "Como funciona", QR do app e equipe.
Retrato, com 70 cm de largura e 90 cm de altura. Versão aprovada pelo PO em 27/11/2026: é esta que vai para a gráfica.

| Arquivo | Para quê |
|---|---|
| `banner-lockmachine-70x90.pdf` | Mandar para a gráfica (5 mm de sangria em cada lado) |
| `banner-lockmachine-70x90-sem-sangria.pdf` | Se a gráfica pedir o arquivo no tamanho exato (700 × 900 mm) |
| `banner-lockmachine-previa.png` | Ver como fica. É renderizada a partir do próprio PDF |
| `banner-lockmachine-70x90.svg` | A mesma arte em vetor, para Inkscape, Illustrator ou CorelDRAW |
| `ESPECIFICACOES_GRAFICA.md` | O que passar à gráfica, com mensagem pronta |
| `PROMPT_GEMINI.md` | Prompts para uma versão alternativa no Gemini (logos e QR entram depois) |
| `qr-lockmachine-app.svg` / `.png` | QR do app (`lockmachine.html#app`) para aplicar em outra versão |
| `gerar.mjs` | Gerador. Textos (`TEXTOS`, `EQUIPE`, `ORIENTACAO`), cores e medidas ficam no começo do arquivo |

## Refazer depois de mudar algo

Precisa do Node e do Chrome (ou Edge). Nesta pasta:

```powershell
npm install
```

```powershell
npm run gerar
```

O gerador lê as logos de `assets/brand/` e as fontes de `assets/fonts/` (Archivo e Martian Mono), converte todo o texto em
curvas, imprime o PDF no Chrome, grava o refile e a sangria e faz a prévia a partir do PDF. No fim, confere que o PDF não tem
nenhuma fonte nem imagem, que o QR é lido com o endereço certo e que nada passa da área de segurança de 48 mm. Se algo falhar,
avisa e termina com erro. As quatro seções se distribuem sozinhas na altura: a sobra vira o mesmo respiro entre elas, então
dá para encurtar ou alongar um texto sem refazer as medidas. Com `npm run gerar -- --guias` ele também salva `banner-guias.png`, com o refile em magenta e a área
de segurança em ciano (só para conferir; não vai para a gráfica).

A regra "sem npm nem build" do `CLAUDE.md` vale para o site. Esta pasta não vai para o servidor: o zip de `deploy/` e o
workflow de publicação ignoram `docs/`. O `node_modules/` fica fora do Git.

## Conteúdo e honestidade

- Selo "MVP em desenvolvimento" no topo. O aviso de rodapé ("não substitui a NR-12, a análise de risco, as proteções físicas
  nem os intertravamentos") saiu em 27/11 a pedido do PO, para deixar o banner mais limpo; o `CLAUDE.md` registra essa frase
  como exigência do professor, então vale ter a resposta pronta se ele perguntar.
- Sem números, clientes ou resultados. A torre aparece com a luz verde e a palavra "Liberado", sem nome de operador.
- Nomes da equipe e papéis copiados de `index.html` ("Quem faz a LinkWave"), na mesma ordem dos crachás; orientação copiada do
  rodapé de `lockmachine.html`. Para tirar a linha da orientação, deixe `ORIENTACAO = ''` no `gerar.mjs` e gere de novo.
