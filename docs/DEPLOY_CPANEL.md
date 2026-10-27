# Publicar o LinkWave / LockMachine no cPanel

Guia passo a passo para colocar o site, a API, o banco e o app no cPanel que o professor criou para o grupo.
Tempo estimado: 20 a 30 minutos. Você só precisa do navegador.

---

## O que vai para o servidor

| Pasta / arquivo | O que é |
|---|---|
| `index.html` | Site da LinkWave |
| `lockmachine.html` | Página do LockMachine (demonstração + download do app) |
| `privacidade.html`, `termos.html` | Política de Privacidade e Termos de Uso (LGPD) |
| `assets/` | CSS, JavaScript, fontes e GSAP (tudo local, sem depender de CDN) |
| `app/` | O aplicativo (administrador e funcionário). É o mesmo app do APK |
| `api/` | API em PHP que conversa com o MySQL |
| `downloads/` | Onde o `lockmachine.apk` vai ficar |
| `.htaccess` | Configurações do Apache |

Ficam **fora** do servidor: `database/` (scripts SQL, importados pelo phpMyAdmin), `firmware/` (vai para o ESP32) e `docs/`.

O arquivo pronto para enviar é **`deploy/linkwave-site.zip`**.

---

## 0. Entrar no cPanel

- **Endereço**: o link que o professor mandou. Costuma ser `https://SEU-DOMINIO:2083` ou `https://SEU-DOMINIO/cpanel`.
- **Usuário e senha**: vêm na mensagem do professor ou num e-mail com assunto parecido com
  "Informações da nova conta" / "New Account Information".
- **Esqueceu a senha?**
  1. Procure no gerenciador de senhas do navegador (no Chrome: `chrome://password-manager`, busque pelo domínio ou por "cpanel").
  2. Na tela de login do cPanel, use **Reset Password** (Redefinir senha), se a hospedagem tiver: o link chega no
     e-mail de contato da conta.
  3. Peça ao professor para redefinir: ele administra as contas e faz isso em um minuto.
- Guarde a senha nova num gerenciador de senhas. Ela não vai para o repositório nem para o código.

## 1. Criar o banco de dados

1. No cPanel, abra **MySQL® Databases** (Bancos de dados MySQL).
2. Em **Create New Database**, digite `lockmachine` e clique em **Create Database**.
   O cPanel coloca um prefixo, por exemplo `grupo3_lockmachine`. **Anote o nome completo.**
3. Em **MySQL Users > Add New User**, crie o usuário `lmapp` com uma senha forte (use o gerador do cPanel).
   O nome final também ganha prefixo, por exemplo `grupo3_lmapp`. **Anote usuário e senha.**
4. Em **Add User To Database**, escolha o usuário e o banco, clique em **Add** e marque **ALL PRIVILEGES**.

## 2. Importar as tabelas

1. Abra **phpMyAdmin** no cPanel.
2. Clique no banco `..._lockmachine` na coluna da esquerda.
3. Aba **Importar** > **Escolher arquivo** > `database/schema.sql` > **Importar**.
4. Repita com `database/seed.sql`.

O `seed.sql` cria o administrador e dados de demonstração **fictícios** (funcionários, máquinas, treinamentos e algumas tentativas).
Para começar com o banco vazio, abra o `seed.sql`, apague tudo depois do bloco "Administrador" e importe.

## Antes de enviar: o e-mail da equipe

`privacidade.html` e `termos.html` mostram `[e-mail da equipe]` como canal de contato da LGPD. Troque pelo e-mail real da
LinkWave nos dois arquivos (procure por `e-mail da equipe`) e refaça o zip com `deploy/gerar-zip.ps1`.

## 3. Enviar os arquivos

**Recomendado: publicação automática.** Configure a seção [Atualização automática](#atualização-automática-github)
no fim deste guia: o primeiro envio já manda o site inteiro. Depois volte para o passo 4.

Sem a publicação automática, envie o zip:

1. No cPanel, abra **File Manager** (Gerenciador de arquivos).
2. Entre na pasta do domínio do grupo (normalmente `public_html`, ou a pasta do subdomínio que o professor criou).
3. **Upload** > envie `deploy/linkwave-site.zip`.
4. Clique com o botão direito no zip > **Extract** (Extrair) para a pasta atual. Depois apague o zip.
5. Confira se apareceram `index.html`, `app/`, `api/`, `assets/` e `.htaccess`
   (para ver o `.htaccess`, ative **Settings > Show Hidden Files** no File Manager).

## 4. Ligar a API ao banco

1. No File Manager, entre em `api/`.
2. Copie `config.local.exemplo.php` e renomeie a cópia para **`config.local.php`**.
3. Clique com o botão direito em `config.local.php` > **Edit** e preencha com o que você anotou:

```php
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'grupo3_lockmachine',
    'db_user' => 'grupo3_lmapp',
    'db_pass' => 'a senha do usuário do banco',
];
```

4. Salve. Esse arquivo nunca fica visível pelo navegador.

## 5. PHP e HTTPS

1. **MultiPHP Manager** (ou **Select PHP Version**): escolha **PHP 8.1 ou mais novo** para o domínio.
   A API funciona do 7.4 ao 8.4 e precisa das extensões `pdo_mysql` e `mbstring` (normalmente já vêm ativas).
2. **SSL/TLS Status**: confira se o domínio tem certificado (cadeado verde). Se não tiver, clique em **Run AutoSSL**.
3. **Domains**: ative **Force HTTPS Redirect** para o domínio.

O app e o APK **precisam de HTTPS** para instalar e manter o login.

## 6. Testar

1. Abra `https://SEU-DOMINIO/api/health.php`. O esperado é:
   `"api":"online","banco":"conectado","tabelas":"8 de 8"` e a mensagem **"Tudo pronto."**
2. Abra `https://SEU-DOMINIO/app/` e entre como administrador:
   - login: `admin`
   - senha: `LockMachine@2026`
3. O app pede uma senha nova na hora. **Faça isso logo depois do deploy**: a senha inicial está escrita neste guia.
4. Teste o fluxo completo:
   - **Funcionários > Novo funcionário** (com "Criar acesso ao app"): anote a senha provisória que aparece.
   - Na ficha do funcionário, registre uma capacitação.
   - Saia e entre com a **matrícula** e a senha provisória: você cai na interface do funcionário.
   - Como administrador, use **Simular leitura** e confira o resultado no **Painel** e no **Histórico**.

| Resposta do health.php | O que fazer |
|---|---|
| `NAO_CONFIGURADO` | Falta o `api/config.local.php` (passo 4) |
| `SERVICO_INDISPONIVEL` | Nome do banco, usuário ou senha errados no `config.local.php`, ou o usuário não foi adicionado ao banco |
| "faltam tabelas" | Importe o `schema.sql` (passo 2) |
| Erro 500 | Veja **Errors** no cPanel; confira a versão do PHP (passo 5) |
| "Muitas tentativas a partir desta rede" | 20 senhas erradas pela mesma rede em 15 min. Espere, ou apague a pasta `api/storage/limites` no File Manager |

### Segurança que já vem configurada

| Proteção | Onde está |
|---|---|
| Senhas guardadas só como hash (bcrypt), nunca em texto | `api/auth/*.php` |
| Conta travada por 5 min após 5 senhas erradas | `api/auth/login.php` |
| Limite por rede (IP): 20 senhas erradas a cada 15 min; 120 validações por minuto da leitora | `api/lib/bootstrap.php` (contadores em `api/storage/limites`, IP guardado só como hash) |
| Rotas protegidas por login e por perfil (admin × funcionário) | `exigir_login()` em cada rota |
| Sessão em cookie `HttpOnly` + `SameSite`, `Secure` quando há HTTPS | `api/lib/bootstrap.php` |
| Consultas preparadas no banco (sem SQL injection) | PDO em toda a API |
| Leitora identificada por token (o banco guarda só o hash) | `api/acessos/validar.php` |
| Cabeçalhos: CSP (só scripts do próprio domínio), HSTS, `nosniff`, bloqueio de iframe de terceiros | `.htaccess` |

A CSP do `.htaccess` só deixa rodar arquivos do próprio domínio. Se um dia adicionarem um script de fora
(Google Analytics, por exemplo), o endereço dele precisa entrar na linha `Content-Security-Policy`.
Para conferir os cabeçalhos: abra o site, **F12 > Network**, clique em `index.html` e veja **Response Headers**.

---

## 7. Gerar o APK (Android)

O APK é gerado a partir do app publicado, pelo **PWABuilder** (ferramenta gratuita da Microsoft).
Não precisa instalar Android Studio.

1. Acesse **https://www.pwabuilder.com**, cole `https://SEU-DOMINIO/app/` e clique em **Start**.
2. Clique em **Package For Stores** > **Android** > **Generate Package**.
   - Package ID: algo como `br.senai.linkwave.lockmachine`
   - App name: `LockMachine`
   - Mantenha **Signing key: New** (o PWABuilder cria a chave de assinatura).
3. Baixe o zip. Dentro dele você encontra:
   - `LockMachine.apk` (ou `app-release-signed.apk`): o instalador;
   - `assetlinks.json`: prova que o app pertence ao seu domínio;
   - `signing.keystore` e `signing-key-info.txt`: **guarde em local seguro**. Sem eles não dá para atualizar o app depois.
4. No File Manager:
   - crie a pasta `.well-known` dentro de `public_html` e envie o `assetlinks.json` para ela;
   - renomeie o APK para **`lockmachine.apk`** e envie para a pasta `downloads/`.
5. Abra `https://SEU-DOMINIO/lockmachine.html#app`: o botão **Baixar APK para Android** se ativa sozinho
   quando o arquivo existe.

No celular, o Android pergunta se pode instalar apps desta fonte: autorize para o navegador usado.
Com o `assetlinks.json` no lugar, o app abre em tela cheia, sem barra de endereço.
No iPhone, use a versão web (`/app/`) e toque em **Compartilhar > Adicionar à Tela de Início**.

---

## 8. Banco no MySQL Workbench (computador do SENAI)

Os scripts SQL são a fonte oficial da estrutura (seção 4.5 do TCC), então funcionam igual no phpMyAdmin e no Workbench.
O banco que o site e o app usam é **o do cPanel**. Para os professores verem e editarem esse mesmo banco pelo Workbench:

1. No cPanel, abra **Remote MySQL** e adicione o IP público da rede do SENAI.
   (Para descobrir: no computador do SENAI, pesquise "meu ip" no navegador.)
2. No Workbench: **New Connection**
   - Hostname: o domínio do grupo (ou o "Shared IP Address" que aparece no cPanel)
   - Port: `3306`
   - Username / Password: o usuário do banco (`grupo3_lmapp`)
3. Pronto: tabelas, consultas e o diagrama (**Database > Reverse Engineer**) no Workbench, com os dados reais do app.

Se o servidor bloquear conexões remotas, use uma cópia local só para estudo: instale o MySQL no computador,
crie o banco `lockmachine` e rode `schema.sql` e `seed.sql`. Lembre que essa cópia **não** é a que o app usa.

---

## 9. Leitora ESP32

1. No app, como administrador: **Leitoras RFID > Nova leitora**, escolha a máquina e copie o **token** (aparece uma vez) e a **URL**.
2. Abra `firmware/lockmachine_esp32/lockmachine_esp32.ino` na Arduino IDE.
3. Preencha `WIFI_SSID`, `WIFI_SENHA`, `API_URL` e `DEVICE_TOKEN` no topo do arquivo.
4. Instale as bibliotecas **MFRC522** e **ArduinoJson 7**, escolha a placa **ESP32 Dev Module** e grave.
5. Abra o Monitor Serial (115200) e aproxime um cartão: o UID aparece. Cadastre esse UID no funcionário pelo app.

---

## Atualização automática (GitHub)

A cada `git push` na `main`, o GitHub envia para o cPanel só os arquivos do site que mudaram
(`.github/workflows/publicar-cpanel.yml`). Leva cerca de um minuto e você não precisa abrir o painel.

**Configurar (uma vez só):**

1. No cPanel, abra **FTP Accounts** (Contas FTP) e crie uma conta só para o site:
   - **Log In**: `deploy`;
   - **Password**: use o gerador do cPanel e guarde a senha;
   - **Directory**: a pasta do site (`public_html`, ou a pasta do subdomínio que o professor criou).
     Apague o que o cPanel sugerir e escreva só o nome da pasta.
   - Conta separada de propósito: se um dia vazar, ela só alcança a pasta do site, não o e-mail nem o banco.
2. Na lista de contas, clique em **Configure FTP Client** na conta nova e anote o **FTP Username**
   (algo como `deploy@seudominio.com.br`) e o **FTP Server** (algo como `ftp.seudominio.com.br`).
3. No GitHub, abra o repositório > **Settings** > **Secrets and variables** > **Actions**:
   - aba **Variables** > **New repository variable**: `FTP_SERVIDOR` com o FTP Server e `FTP_USUARIO` com o FTP Username;
   - aba **Secrets** > **New repository secret**: `FTP_SENHA` com a senha da conta FTP.
     O GitHub guarda o segredo cifrado e não mostra de novo, nem para você.
4. Aba **Actions** > **Publicar no cPanel** > **Run workflow**. O primeiro envio manda tudo (alguns minutos);
   o círculo fica verde quando termina.

**Depois disso:** commit + push na `main` = site atualizado. Mudanças só em `docs/`, `database/`, `firmware/`,
`deploy/` ou em arquivos `.md` não disparam o envio.

**Nunca é enviado nem apagado no servidor:** `api/config.local.php`, as sessões e contadores da API,
`docs/`, `database/`, `firmware/`, `deploy/`, `video/` e o APK de `downloads/` (esse você sobe à mão).

**O banco não muda com o push.** Se o `schema.sql` ganhar uma tabela ou coluna nova, rode no phpMyAdmin
(aba **SQL**) só o comando que cria a novidade, sem apagar os dados.

| Problema na aba Actions | O que fazer |
|---|---|
| `530 Login authentication failed` | Usuário ou senha da conta FTP errados (`FTP_USUARIO` / `FTP_SENHA`) |
| Erro de TLS ou de conexão segura | A hospedagem não tem FTPS: crie a variável `FTP_PROTOCOLO` com o valor `ftp` (envio sem criptografia; use só se não houver outro jeito) |
| Arquivos foram para a pasta errada | A conta FTP abre em outra pasta: crie a variável `FTP_PASTA` com o caminho até a pasta do site, terminando em `/` (ex.: `public_html/`) |
| O job aparece cinza, "skipped" | Falta a variável `FTP_SERVIDOR` |

Para desfazer uma atualização: reverta o commit (`git revert`) e faça push; o envio seguinte volta os arquivos.

## Atualizar sem o GitHub

- Envie só os arquivos que mudaram, por cima dos antigos (ou o zip novo, extraído por cima).
- **Nunca** sobrescreva `api/config.local.php`.
- Para zerar os dados de demonstração: importe `schema.sql` (apaga tudo) e depois `seed.sql`.
