-- =====================================================================
-- LockMachine · estrutura do banco de dados
-- Compatível com MySQL 5.7+ e MariaDB 10.3+ (cPanel, XAMPP ou Workbench).
--
-- Como usar:
--   cPanel ........ phpMyAdmin > selecione o banco > Importar > schema.sql
--   Workbench ..... abra este arquivo, selecione o banco (USE) e execute
-- Depois importe seed.sql para criar o administrador e os dados de teste.
--
-- ATENÇÃO: este script apaga e recria as tabelas do LockMachine.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS acessos;
DROP TABLE IF EXISTS dispositivos;
DROP TABLE IF EXISTS maquina_treinamento;
DROP TABLE IF EXISTS operador_treinamento;
DROP TABLE IF EXISTS maquinas;
DROP TABLE IF EXISTS treinamentos;
DROP TABLE IF EXISTS operadores;
DROP TABLE IF EXISTS usuarios;
SET FOREIGN_KEY_CHECKS = 1;

-- Contas que fazem login no site/app (administradores e funcionários).
CREATE TABLE usuarios (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nome              VARCHAR(120)     NOT NULL,
  login             VARCHAR(60)      NOT NULL COMMENT 'admin: nome de usuário; funcionário: matrícula',
  email             VARCHAR(160)     NULL,
  senha_hash        VARCHAR(255)     NOT NULL COMMENT 'password_hash() do PHP, nunca a senha',
  perfil            ENUM('admin','funcionario') NOT NULL DEFAULT 'funcionario',
  ativo             TINYINT(1)       NOT NULL DEFAULT 1,
  deve_trocar_senha TINYINT(1)       NOT NULL DEFAULT 1,
  falhas_login      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate     DATETIME         NULL,
  ultimo_login      DATETIME         NULL,
  criado_em         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_login (login),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Funcionários que operam máquinas (o cartão RFID fica aqui).
CREATE TABLE operadores (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id    INT UNSIGNED NULL COMMENT 'conta do app, quando o funcionário tem login',
  nome          VARCHAR(120) NOT NULL,
  matricula     VARCHAR(30)  NOT NULL,
  setor         VARCHAR(80)  NULL,
  rfid_uid      VARCHAR(20)  NULL COMMENT 'UID em hexadecimal, sem separadores',
  ativo         TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'desativação lógica preserva o histórico',
  criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_operadores_matricula (matricula),
  UNIQUE KEY uq_operadores_uid (rfid_uid),
  UNIQUE KEY uq_operadores_usuario (usuario_id),
  CONSTRAINT fk_operadores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tipos de capacitação e por quanto tempo valem.
CREATE TABLE treinamentos (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(120)      NOT NULL,
  descricao      VARCHAR(255)      NULL,
  validade_meses SMALLINT UNSIGNED NOT NULL,
  criado_em      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_treinamentos_nome (nome),
  CONSTRAINT ck_treinamentos_validade CHECK (validade_meses > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipamentos e seu estado operacional.
CREATE TABLE maquinas (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo        VARCHAR(20)  NOT NULL,
  nome          VARCHAR(120) NOT NULL,
  localizacao   VARCHAR(120) NULL,
  status        ENUM('ativa','manutencao','bloqueada','inativa') NOT NULL DEFAULT 'ativa',
  criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_maquinas_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Capacitações concluídas por operador (uma linha por treinamento; renovar atualiza as datas).
CREATE TABLE operador_treinamento (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  operador_id    INT UNSIGNED NOT NULL,
  treinamento_id INT UNSIGNED NOT NULL,
  concluido_em   DATE         NOT NULL,
  valido_ate     DATE         NOT NULL,
  criado_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_operador_treinamento (operador_id, treinamento_id),
  KEY ix_ot_valido_ate (valido_ate),
  CONSTRAINT fk_ot_operador FOREIGN KEY (operador_id) REFERENCES operadores (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ot_treinamento FOREIGN KEY (treinamento_id) REFERENCES treinamentos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Capacitações exigidas por máquina.
CREATE TABLE maquina_treinamento (
  maquina_id     INT UNSIGNED NOT NULL,
  treinamento_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (maquina_id, treinamento_id),
  CONSTRAINT fk_mt_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mt_treinamento FOREIGN KEY (treinamento_id) REFERENCES treinamentos (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leitoras RFID (ESP32) autorizadas a chamar a rota de validação.
CREATE TABLE dispositivos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(80)  NOT NULL,
  maquina_id     INT UNSIGNED NULL COMMENT 'máquina em que a leitora está instalada',
  token_hash     CHAR(64)     NOT NULL COMMENT 'SHA-256 do token; o token só aparece uma vez',
  token_final    CHAR(4)      NOT NULL COMMENT 'últimos 4 caracteres, para identificar',
  ativo          TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_contato DATETIME     NULL,
  criado_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispositivos_token (token_hash),
  CONSTRAINT fk_dispositivos_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Toda tentativa de validação, liberada ou bloqueada.
CREATE TABLE acessos (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operador_id        INT UNSIGNED    NULL,
  maquina_id         INT UNSIGNED    NULL,
  dispositivo_id     INT UNSIGNED    NULL,
  rfid_uid_mascarado VARCHAR(24)     NOT NULL,
  maquina_codigo     VARCHAR(20)     NOT NULL COMMENT 'código recebido, mesmo se a máquina não existir',
  maquina_status     VARCHAR(20)     NULL COMMENT 'estado da máquina no momento da tentativa',
  autorizado         TINYINT(1)      NOT NULL,
  motivo_codigo      VARCHAR(40)     NOT NULL,
  origem             ENUM('dispositivo','simulador') NOT NULL DEFAULT 'dispositivo',
  data_hora          DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY ix_acessos_data (data_hora),
  KEY ix_acessos_operador (operador_id, data_hora),
  KEY ix_acessos_maquina (maquina_id, data_hora),
  KEY ix_acessos_resultado (autorizado, data_hora),
  CONSTRAINT fk_acessos_operador FOREIGN KEY (operador_id) REFERENCES operadores (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_acessos_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_acessos_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
