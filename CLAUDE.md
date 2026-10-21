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

## Situação em 20/10/2026

Pronto e testado localmente (PHP 8.2 + MariaDB 10.11): site, simulador do site, banco, todas as rotas da API
(login com troca obrigatória de senha, bloqueio após 5 tentativas, cadastros, capacitações, validação com os
6 motivos, token da leitora, histórico com filtros, dashboard) e o app nas duas interfaces, em celular e desktop.

Falta:
1. **Publicar no cPanel do professor**: é o próximo passo. Siga `docs/DEPLOY_CPANEL.md` junto com o usuário,
   um passo de cada vez, pedindo para ele contar o que aparece na tela.
2. **Gerar o APK** no PWABuilder depois do deploy (precisa de HTTPS) e subir `downloads/lockmachine.apk`
   e `.well-known/assetlinks.json`. O botão de download do site se ativa sozinho quando o APK existe.
3. Compilar e testar o firmware (não foi compilado: a máquina original não tinha Arduino IDE).
4. Fotos e contatos dos integrantes: o usuário vai enviar. Hoje os crachás mostram iniciais.
5. Executar os casos de teste (CT/TNF) e registrar evidências EV-XX.

## Regras que valem para qualquer alteração

- **Honestidade (exigência do professor)**: o produto continua "MVP em desenvolvimento" até os testes e evidências.
  Não invente números, clientes ou resultados. Dados de demonstração são rotulados como fictícios.
  O LockMachine não substitui NR-12, análise de risco, proteções físicas nem intertravamentos.
- **Visual "chunky"**: bordas grossas de 3px em `#11131F`, cantos arredondados, sombra sólida para baixo
  (`0 6px 0`), fonte Archivo (títulos em `font-stretch: 125%`, peso 900, maiúsculas) e Martian Mono só para código e dados.
  Cores: cobalto `#2F45FF` (LinkWave), vermelho `#FF3D2E` (LockMachine), amarelo `#FFD23F`, verde `#22D07B`, fundo `#E9ECF2`.
- Sem etapa de build: nada de npm ou bundler. Tudo precisa abrir direto no navegador e rodar no cPanel.
- API: toda escrita é `POST` (hospedagens compartilhadas bloqueiam PUT e DELETE) e exige o cabeçalho
  `X-Requested-With: LockMachine`. Use `?id=` e `&acao=` na URL. Mantenha compatível com PHP 7.4.
- Caminhos sempre relativos (o site pode ficar em subpasta do domínio).
- `api/config.local.php` tem a senha do banco: nunca versionar (já está no `.gitignore`).

## Rodar localmente

Precisa de PHP com `pdo_mysql` e de MySQL/MariaDB (o XAMPP do SENAI serve):
importe `database/schema.sql` e `database/seed.sql`, copie `api/config.local.exemplo.php` para
`api/config.local.php`, preencha, e rode `php -S localhost:8080` na raiz do projeto.

Contas do seed (troca de senha obrigatória no primeiro acesso): `admin` / `LockMachine@2026`;
funcionários entram com a matrícula (ex.: `OP-1042`) e `Senha@123`.
