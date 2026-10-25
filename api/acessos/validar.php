<?php
// POST /api/acessos/validar.php — valida UID + máquina e registra a decisão.
// Quem pode chamar:
//   • leitora ESP32 cadastrada: cabeçalho X-Device-Token (origem "dispositivo")
//   • administrador logado no app: simulador claramente identificado (origem "simulador")
// Entrada:  { "rfid_uid": "04A1B2C3D4", "maquina_codigo": "P-01" }
// Saída:    { autorizado, motivo_codigo, acesso_id, data_hora, ... }
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('POST');
// Uma leitora lê no máximo alguns cartões por segundo: 120 pedidos por minuto por IP sobra.
limitar('validar', 120, 60);

$dispositivo = null;
$token = trim((string) ($_SERVER['HTTP_X_DEVICE_TOKEN'] ?? ''));
if ($token !== '') {
    $dispositivo = linha(
        'SELECT d.id, d.ativo, m.codigo AS maquina_codigo
           FROM dispositivos d LEFT JOIN maquinas m ON m.id = d.maquina_id
          WHERE d.token_hash = ?',
        [hash('sha256', $token)]
    );
    if (!$dispositivo || !(int) $dispositivo['ativo']) {
        falha(401, 'DISPOSITIVO_NAO_AUTORIZADO', 'Leitora não autorizada.');
    }
    $origem = 'dispositivo';
} else {
    exigir_login('admin');
    $origem = 'simulador';
}

$in = entrada();
$uid = normalizar_uid($in['rfid_uid'] ?? '');
// Leitora instalada em uma máquina valida sempre aquela máquina.
$codigo = $dispositivo && $dispositivo['maquina_codigo'] ? $dispositivo['maquina_codigo'] : normalizar_codigo($in['maquina_codigo'] ?? '');
$erros = [];
if (!$uid) {
    $erros['rfid_uid'] = 'UID inválido: use de 8 a 20 caracteres hexadecimais.';
}
if (!$codigo) {
    $erros['maquina_codigo'] = 'Informe o código da máquina.';
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Dados de validação inválidos.', $erros);
}

$pdo = db();
$hoje = hoje();
$quando = agora();

$pdo->beginTransaction();
$maquina = linha('SELECT * FROM maquinas WHERE codigo = ?', [$codigo]);
$operador = linha('SELECT * FROM operadores WHERE rfid_uid = ?', [$uid]);
$r = avaliar_acesso($operador, $maquina, $hoje);

consulta(
    'INSERT INTO acessos (operador_id, maquina_id, dispositivo_id, rfid_uid_mascarado, maquina_codigo, maquina_status, autorizado, motivo_codigo, origem, data_hora)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
        $operador ? (int) $operador['id'] : null,
        $maquina ? (int) $maquina['id'] : null,
        $dispositivo ? (int) $dispositivo['id'] : null,
        mascarar_uid($uid),
        $codigo,
        $maquina ? $maquina['status'] : null,
        $r['autorizado'] ? 1 : 0,
        $r['motivo_codigo'],
        $origem,
        $quando,
    ]
);
$acessoId = (int) $pdo->lastInsertId();
if ($dispositivo) {
    consulta('UPDATE dispositivos SET ultimo_contato = ? WHERE id = ?', [$quando, $dispositivo['id']]);
}
$pdo->commit();

responder(200, [
    'sucesso'  => true,
    'dados'    => [
        'autorizado'    => $r['autorizado'],
        'motivo_codigo' => $r['motivo_codigo'],
        'acesso_id'     => $acessoId,
        'data_hora'     => iso($quando),
        'origem'        => $origem,
        'detalhe'       => $r['detalhe'],
        'operador'      => $operador ? ['id' => (int) $operador['id'], 'nome' => $operador['nome'], 'matricula' => $operador['matricula']] : null,
        'maquina'       => $maquina ? ['id' => (int) $maquina['id'], 'codigo' => $maquina['codigo'], 'nome' => $maquina['nome'], 'status' => $maquina['status']] : ['codigo' => $codigo],
        'exigencias'    => $r['exigencias'],
        'liberar_segundos' => $r['autorizado'] ? 5 : 0,
    ],
    'mensagem' => $r['mensagem'],
]);
