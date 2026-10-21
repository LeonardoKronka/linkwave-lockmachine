-- =====================================================================
-- LockMachine · dados iniciais e de demonstração
-- Importe DEPOIS de schema.sql. As datas são calculadas a partir do dia
-- da importação, então sempre haverá capacitações válidas, vencendo e vencidas.
--
-- Contas criadas (troca de senha obrigatória no primeiro acesso):
--   Administrador ..... login: admin     senha: LockMachine@2026
--   Funcionários ...... login: matrícula senha: Senha@123
--                       (OP-1042, OP-1077, OP-1103; OP-0988 está desativado)
--
-- Todos os funcionários, cartões e acessos abaixo são FICTÍCIOS.
-- Para começar com o banco vazio, importe só o bloco "Administrador".
-- =====================================================================

SET NAMES utf8mb4;

-- ---------- Administrador ----------
INSERT INTO usuarios (id, nome, login, email, senha_hash, perfil, ativo, deve_trocar_senha) VALUES
  (1, 'Administrador', 'admin', NULL, '$2y$10$Qj2m7688fJq7/TNtEt2EUeFU4M6SAEZjKboVjHbDuD05gTh.W1g4G', 'admin', 1, 1);

-- ---------- Contas de funcionários (login = matrícula) ----------
INSERT INTO usuarios (id, nome, login, email, senha_hash, perfil, ativo, deve_trocar_senha) VALUES
  (2, 'Ana Ribeiro',    'OP-1042', NULL, '$2y$10$lGd13Dm4v8svv5kuHFLB2erWl3pWBL9D6LzzSCZg4DyStDzOkcxY2', 'funcionario', 1, 1),
  (3, 'Bruno Teixeira', 'OP-1077', NULL, '$2y$10$lGd13Dm4v8svv5kuHFLB2erWl3pWBL9D6LzzSCZg4DyStDzOkcxY2', 'funcionario', 1, 1),
  (4, 'Carla Mendes',   'OP-0988', NULL, '$2y$10$lGd13Dm4v8svv5kuHFLB2erWl3pWBL9D6LzzSCZg4DyStDzOkcxY2', 'funcionario', 0, 1),
  (5, 'Diego Martins',  'OP-1103', NULL, '$2y$10$lGd13Dm4v8svv5kuHFLB2erWl3pWBL9D6LzzSCZg4DyStDzOkcxY2', 'funcionario', 1, 1);

-- ---------- Operadores ----------
INSERT INTO operadores (id, usuario_id, nome, matricula, setor, rfid_uid, ativo) VALUES
  (1, 2,    'Ana Ribeiro',    'OP-1042', 'Usinagem',    '04A1B2C3D4', 1),
  (2, 3,    'Bruno Teixeira', 'OP-1077', 'Estamparia',  '04B7E1A290', 1),
  (3, 4,    'Carla Mendes',   'OP-0988', 'Usinagem',    '04C93F0B11', 0),
  (4, 5,    'Diego Martins',  'OP-1103', 'Manutenção',  '04D52A7E3C', 1),
  (5, NULL, 'Elisa Prado',    'OP-1120', 'Estamparia',  NULL,         1);

-- ---------- Treinamentos ----------
INSERT INTO treinamentos (id, nome, descricao, validade_meses) VALUES
  (1, 'NR-12 — fundamentos',      'Princípios de segurança no trabalho em máquinas e equipamentos.', 12),
  (2, 'Operação de prensa',       'Operação da prensa hidráulica e seus dispositivos de proteção.', 24),
  (3, 'Operação de fresadora',    'Preparação, operação e limpeza segura da fresadora.', 24),
  (4, 'Operação de torno CNC',    'Operação do torno CNC, troca de ferramentas e parada de emergência.', 24),
  (5, 'Esmerilhamento seguro',    'Uso do esmeril de bancada, ajuste de apoio e inspeção do rebolo.', 12);

-- ---------- Máquinas ----------
INSERT INTO maquinas (id, codigo, nome, localizacao, status) VALUES
  (1, 'P-01', 'Prensa hidráulica',   'Laboratório de estamparia', 'ativa'),
  (2, 'T-02', 'Torno CNC',           'Laboratório de usinagem',   'manutencao'),
  (3, 'F-03', 'Fresadora',           'Laboratório de usinagem',   'ativa'),
  (4, 'E-05', 'Esmeril de bancada',  'Oficina de manutenção',     'ativa');

-- ---------- Capacitações exigidas por máquina ----------
INSERT INTO maquina_treinamento (maquina_id, treinamento_id) VALUES
  (1, 1), (1, 2),
  (2, 1), (2, 4),
  (3, 1), (3, 3),
  (4, 1), (4, 5);

-- ---------- Capacitações dos operadores ----------
INSERT INTO operador_treinamento (operador_id, treinamento_id, concluido_em, valido_ate) VALUES
  (1, 1, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 214 DAY), INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 214 DAY)),
  (1, 2, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 461 DAY), INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 461 DAY)),
  (1, 4, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 305 DAY), INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 305 DAY)),
  (2, 1, DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 61 DAY), INTERVAL 12 MONTH),  DATE_SUB(CURDATE(), INTERVAL 61 DAY)),
  (2, 2, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 270 DAY), INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 270 DAY)),
  (2, 3, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 332 DAY), INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 332 DAY)),
  (3, 1, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 150 DAY), INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 150 DAY)),
  (3, 3, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 240 DAY), INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 240 DAY)),
  (4, 1, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 20 DAY),  INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
  (4, 3, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 25 DAY),  INTERVAL 24 MONTH), DATE_ADD(CURDATE(), INTERVAL 25 DAY)),
  (4, 5, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 90 DAY),  INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
  (5, 1, DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 300 DAY), INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 300 DAY));

-- ---------- Histórico de demonstração (origem: simulador) ----------
INSERT INTO acessos (operador_id, maquina_id, rfid_uid_mascarado, maquina_codigo, maquina_status, autorizado, motivo_codigo, origem, data_hora) VALUES
  (1,    1, '04A1••••D4', 'P-01', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 6 DAY) + INTERVAL 8 HOUR),
  (2,    1, '04B7••••90', 'P-01', 'ativa',      0, 'TREINAMENTO_VENCIDO',   'simulador', DATE_SUB(NOW(), INTERVAL 6 DAY) + INTERVAL 9 HOUR),
  (4,    3, '04D5••••3C', 'F-03', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 5 DAY) + INTERVAL 7 HOUR),
  (1,    3, '04A1••••D4', 'F-03', 'ativa',      0, 'TREINAMENTO_AUSENTE',   'simulador', DATE_SUB(NOW(), INTERVAL 5 DAY) + INTERVAL 10 HOUR),
  (NULL, 1, '04FF••••AE', 'P-01', 'ativa',      0, 'CARTAO_DESCONHECIDO',   'simulador', DATE_SUB(NOW(), INTERVAL 4 DAY) + INTERVAL 8 HOUR),
  (1,    1, '04A1••••D4', 'P-01', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 4 DAY) + INTERVAL 11 HOUR),
  (4,    4, '04D5••••3C', 'E-05', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 9 HOUR),
  (1,    2, '04A1••••D4', 'T-02', 'manutencao', 0, 'MAQUINA_INDISPONIVEL',  'simulador', DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 13 HOUR),
  (3,    3, '04C9••••11', 'F-03', 'ativa',      0, 'OPERADOR_INATIVO',      'simulador', DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 8 HOUR),
  (2,    3, '04B7••••90', 'F-03', 'ativa',      0, 'TREINAMENTO_VENCIDO',   'simulador', DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 10 HOUR),
  (4,    3, '04D5••••3C', 'F-03', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 9 HOUR),
  (1,    1, '04A1••••D4', 'P-01', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 14 HOUR),
  (2,    1, '04B7••••90', 'P-01', 'ativa',      0, 'TREINAMENTO_VENCIDO',   'simulador', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (1,    1, '04A1••••D4', 'P-01', 'ativa',      1, 'AUTORIZADO',            'simulador', DATE_SUB(NOW(), INTERVAL 2 HOUR));
