# LinkWave · LockMachine

TCC do curso Técnico em Desenvolvimento de Sistemas — SENAI Mococa, 2026.

- **Site** (`index.html`, `lockmachine.html`): apresentação da equipe e do produto, com simulador de demonstração.
- **App** (`app/`): painel do administrador e área do funcionário. Instala como app (PWA) e vira o APK.
- **API** (`api/`): PHP + PDO, sessão com cookie HttpOnly, respostas JSON no formato do Apêndice B.
- **Banco** (`database/`): `schema.sql` (8 tabelas) e `seed.sql` (admin + dados fictícios).
- **Leitora** (`firmware/`): ESP32 + MFRC522, chama `POST /api/acessos/validar.php` com token.

Publicação no cPanel, geração do APK e Workbench: **[docs/DEPLOY_CPANEL.md](docs/DEPLOY_CPANEL.md)**.

## Rotas da API

| Método | Rota | Quem |
|---|---|---|
| POST | `api/auth/login.php`, `logout.php`, `senha.php` · GET `me.php` | Todos |
| GET | `api/dashboard/resumo.php` | Admin |
| GET · POST | `api/operadores/index.php` (`?id=`, `&acao=desativar\|ativar\|senha`) | Admin |
| POST | `api/capacitacoes/index.php` (`?id=&acao=remover`) | Admin |
| GET · POST | `api/maquinas/index.php`, `api/treinamentos/index.php` | Admin |
| GET | `api/acessos/index.php` (filtros: `de`, `ate`, `operador_id`, `maquina_id`, `resultado`, `origem`) | Admin |
| POST | `api/acessos/validar.php` | Leitora (`X-Device-Token`) ou admin (simulador) |
| GET · POST | `api/dispositivos/index.php`, `api/usuarios/index.php` | Admin |
| GET | `api/funcionario/painel.php` | Funcionário |
| GET | `api/health.php` | Público (teste de deploy) |

Todas as escritas exigem o cabeçalho `X-Requested-With: LockMachine` (o app já envia).

## Rodar no computador

Precisa de PHP 7.4+ com `pdo_mysql` e de um MySQL/MariaDB (o XAMPP serve):

1. Crie o banco `lockmachine` e importe `database/schema.sql` e `database/seed.sql`.
2. Copie `api/config.local.exemplo.php` para `api/config.local.php` e preencha.
3. Na pasta do projeto: `php -S localhost:8080`
4. Abra `http://localhost:8080` (site) e `http://localhost:8080/app/` (app).

Login inicial: `admin` / `LockMachine@2026` (troca obrigatória no primeiro acesso).
Funcionários do seed: matrícula (ex.: `OP-1042`) / `Senha@123`.
