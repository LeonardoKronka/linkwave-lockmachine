# LinkWave · LockMachine — contexto para o Claude

Responda sempre em **português do Brasil**. O usuário é o Leonardo Kronka Rodrigues, Product Owner e full-stack
da equipe LinkWave (TCC do Técnico em Desenvolvimento de Sistemas, SENAI Mococa, 2026).

## O que é o projeto

- **LinkWave**: a marca da equipe (5 integrantes). Site institucional em `index.html`.
- **LockMachine**: o produto do TCC. O cartão RFID do operador é conferido no servidor: cadastro ativo, máquina
  disponível e capacitações exigidas dentro da validade. Toda tentativa é registrada com o motivo.
- Documento de referência: `Documentacao_TCC_LockMachine_Corrigida_Professor.docx.pdf` (fica com o usuário).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `index.html`, `lockmachine.html`, `assets/` | Site (HTML/CSS/JS puro, GSAP 3.14 e fontes hospedados em `assets/`) |
| `app/` | App PWA: administrador e funcionário. É o mesmo app que vira APK pelo PWABuilder |
| `api/` | PHP 7.4+ com PDO, sessão em cookie HttpOnly, JSON no formato do Apêndice B do TCC |
| `database/` | `schema.sql` (8 tabelas) e `seed.sql` (admin + dados fictícios) |
| `firmware/` | Sketch do ESP32 + MFRC522 (Arduino IDE) |
| `docs/DEPLOY_CPANEL.md` | Guia de publicação no cPanel, APK, Workbench e leitora |
| `deploy/` | `linkwave-site.zip` pronto para o cPanel e `gerar-zip.ps1` para refazer o zip |
| `.github/workflows/` | `publicar-cpanel.yml`: publica o site no cPanel a cada push na `main` |

## Situação em 25/10/2026

Pronto e testado localmente (PHP 8.2 + MariaDB 10.11): site, simulador do site, banco, todas as rotas da API
(login com troca obrigatória de senha, bloqueio após 5 tentativas, cadastros, capacitações, validação com os
6 motivos, token da leitora, histórico com filtros, dashboard) e o app nas duas interfaces, em celular e desktop.
Em 25/10: logo nova (Encaixe), abertura animada no site e no app, títulos em frase normal, transições entre
páginas e entre site e app, limite por IP na API e cabeçalhos de segurança (CSP/HSTS) no `.htaccess`.
Depois, no mesmo dia: site redesenhado no tema escuro cinematográfico com cenas 3D (three.js) e reflexos, painel do
app claro e minimalista, Política de Privacidade e Termos (LGPD), kit da marca em `assets/brand/`, design system
publicado (https://claude.ai/artifact/Xj7upFJDECzTw9jEn7M6Yd) e roteiro de entrevistas em `docs/VALIDACAO_ENTREVISTAS.md`.
À noite: passada de desempenho (travas no carregamento e na rolagem medidas e reduzidas), reflexo da logo visível em
1920×1080 e cena do LockMachine refeita (prensa hidráulica P-01 com posto bimanual, leitora e torre de sinalização).
Regras visuais detalhadas: `DESIGN.md` (leia antes de mexer no visual). Uma sessão separada faz o vídeo em `video/`.

Falta:
0. Trocar `[e-mail da equipe]` em `privacidade.html` e `termos.html` pelo e-mail real da LinkWave.
1. **Publicar no cPanel do professor**: é o próximo passo. Siga `docs/DEPLOY_CPANEL.md` junto com o usuário,
   um passo de cada vez, pedindo para ele contar o que aparece na tela. Em 26/10 ele não lembrava a senha do cPanel
   (seção 0 do guia): recupera com o professor na aula de quarta, 28/10, e volta com endereço e senha. Ele escolheu a
   publicação automática: `.github/workflows/publicar-cpanel.yml` envia por FTPS a cada push na `main`, depois que as
   variáveis `FTP_SERVIDOR`/`FTP_USUARIO`/`SITE_URL` e o segredo `FTP_SENHA` existirem no GitHub. O roteiro do dia está
   no topo de `docs/DEPLOY_CPANEL.md`; depois de cada envio, confira o resumo com `gh run view`.
   Senhas e credenciais quem digita é sempre o usuário (no cPanel e no GitHub), nunca o Claude.
2. **Gerar o APK** no PWABuilder depois do deploy (precisa de HTTPS) e subir `downloads/lockmachine.apk`
   e `.well-known/assetlinks.json`. O botão de download do site se ativa sozinho quando o APK existe.
3. Compilar e testar o firmware (não foi compilado: a máquina original não tinha Arduino IDE).
4. Fotos e contatos dos integrantes: o usuário vai enviar. Hoje os crachás mostram iniciais.
5. Executar os casos de teste (CT/TNF) e registrar evidências EV-XX.

## Regras que valem para qualquer alteração

- **Honestidade (exigência do professor)**: o produto continua "MVP em desenvolvimento" até os testes e evidências.
  Não invente números, clientes ou resultados. Dados de demonstração são rotulados como fictícios.
  O LockMachine não substitui NR-12, análise de risco, proteções físicas nem intertravamentos.
- **Visual (desde 25/10, ver `DESIGN.md`)**: o site é o chão de fábrica à noite (fundo `#06070A`, painéis foscos com
  linha de 1px, luz só de fontes reais: torre verde/âmbar/vermelha, LED, luz azul da LinkWave; peças físicas claras) e
  o app é claro e minimalista (fundo `#F4F5F8`, cards brancos com sombra suave, vermelho como destaque do item ativo).
  O visual "chunky" antigo (bordas de 3px, sombra sólida) foi aposentado. Fonte Archivo: títulos em **frase normal**
  (peso 800, `font-stretch: 106%`); maiúsculas só em rótulos pequenos, selos e pílulas. Martian Mono só para dados.
  Cores de marca: cobalto `#2F45FF` (LinkWave), vermelho `#FF3D2E` (LockMachine), amarelo `#FFD23F`, verde `#22D07B`.
- **3D**: `assets/js/scene-kit.js` (palco, piso espelhado, economia de bateria) + `scene-home.js` e `scene-lm.js`,
  módulos ES com three.js r170 em `assets/vendor/three/` (imports relativos, sem import map, por causa da CSP).
  Sem WebGL, com WebGL sem placa de vídeo (SwiftShader) ou com erro, a página volta para a versão plana
  (`.has-scene` só existe com a cena viva). Desempenho (medido, não mexa sem medir de novo):
  - o ambiente de reflexos é a imagem `assets/img/env-room.png` (gerada por `docs/ferramentas/bake-env.mjs`);
    gerar no navegador travava a abertura por ~0,3 s;
  - sombreadores compilam em paralelo (`compileParallel`) e texturas sobem uma por tarefa antes do 1º quadro;
  - `addFloor` vem depois da geometria (o 1º uso do WebGL espera a placa de vídeo inicializar);
  - detalhes pequenos ficam na camada `DETAIL` (o espelho do piso não os desenha);
  - a cena desenha no `gsap.ticker` e lê a rolagem pelo ScrollTrigger (nada de `getBoundingClientRect` por quadro);
  - nunca mude o número de luzes com `visible` (recompila tudo): use `intensity`;
  - elementos que se mexem com a rolagem ou balançam têm `will-change: transform` (final do `styles.css`) e as
    sombras com desfoque ficam em até 32 px: sombras grandes eram o maior custo de desenho na rolagem.
- **Marcas**: LinkWave = "Encaixe" (círculo dividido por uma onda em S: metade cobalto, metade amarela, contorno
  e S em tinta), em `assets/img/favicon.svg` e no SVG `.mark` das páginas. LockMachine = cadeado no quadrado
  vermelho (`.mark-lm` no app).
- **Movimento**: `expo.out` para entradas e `power3.inOut`/`expo.inOut` para deslocamentos; nada de `bounce`.
  `elastic`/`back` só em coisas físicas (cartão, carimbo, cadeado abrindo). Uma animação puxa a outra:
  - Abertura (site e app): a marca é montada em CSS no primeiro quadro, o JS espera as animações CSS terminarem
    (classe `is-built` desliga o CSS) e então a marca voa até o logo da tela enquanto um furo abre no véu.
  - Entre páginas do site: o furo fecha no clique e `sessionStorage['lw:transicao']` faz a próxima página
    continuar do logo montado. Site → app usa `data-wipe="app"` (só fecha o véu; o app monta o cadeado).
  - No app, entradas esperam `quandoAberto()` para não tocar escondidas atrás da abertura.
  - `gsap.matchMedia()` com objeto de condições só roda se alguma bater: inclua sempre a condição do celular.
  - Evite `invalidateOnRefresh` em `fromTo` com `stagger` (o estado inicial se perde); prefira valores em `%`.
- Sem etapa de build: nada de npm ou bundler. Tudo precisa abrir direto no navegador e rodar no cPanel.
- API: toda escrita é `POST` (hospedagens compartilhadas bloqueiam PUT e DELETE) e exige o cabeçalho
  `X-Requested-With: LockMachine`. Use `?id=` e `&acao=` na URL. Mantenha compatível com PHP 7.4.
- Caminhos sempre relativos (o site pode ficar em subpasta do domínio).
- **Segurança**: o `.htaccess` manda uma CSP que só aceita arquivos do próprio domínio. Nada de `<script>` inline,
  `onclick=` ou CDN; script novo vai em arquivo dentro de `assets/` ou `app/`. Rotas sensíveis usam
  `limitar()`/`bloqueado_por_erros()` de `api/lib/bootstrap.php` (contadores em `api/storage/limites`).
- `api/config.local.php` tem a senha do banco: nunca versionar (já está no `.gitignore`).

## Rodar localmente

Precisa de PHP com `pdo_mysql` e de MySQL/MariaDB (o XAMPP do SENAI serve):
importe `database/schema.sql` e `database/seed.sql`, copie `api/config.local.exemplo.php` para
`api/config.local.php`, preencha, e rode `php -S localhost:8080` na raiz do projeto.

Contas do seed (troca de senha obrigatória no primeiro acesso): `admin` / `LockMachine@2026`;
funcionários entram com a matrícula (ex.: `OP-1042`) e `Senha@123`.
