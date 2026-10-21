<?php
// GET /api/acessos/index.php — histórico de tentativas com filtros (RF12).
//   ?de=2026-10-01&ate=2026-10-31&operador_id=1&maquina_id=2&resultado=liberado|bloqueado&origem=dispositivo|simulador&pagina=1
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('GET');
exigir_login('admin');

$where = [];
$params = [];
$erros = [];

foreach (['de' => '>=', 'ate' => '<'] as $campo => $op) {
    $v = trim((string) ($_GET[$campo] ?? ''));
    if ($v === '') {
        continue;
    }
    $d = data_valida($v);
    if (!$d) {
        $erros[$campo] = 'Data inválida.';
        continue;
    }
    $where[] = "a.data_hora $op ?";
    $params[] = $campo === 'ate' ? date('Y-m-d', strtotime($d . ' +1 day')) . ' 00:00:00' : $d . ' 00:00:00';
}
foreach (['operador_id' => 'a.operador_id', 'maquina_id' => 'a.maquina_id'] as $campo => $coluna) {
    $v = param_id($campo);
    if ($v) {
        $where[] = "$coluna = ?";
        $params[] = $v;
    }
}
$resultado = (string) ($_GET['resultado'] ?? '');
if ($resultado === 'liberado' || $resultado === 'bloqueado') {
    $where[] = 'a.autorizado = ?';
    $params[] = $resultado === 'liberado' ? 1 : 0;
}
$origem = (string) ($_GET['origem'] ?? '');
if ($origem === 'dispositivo' || $origem === 'simulador') {
    $where[] = 'a.origem = ?';
    $params[] = $origem;
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os filtros.', $erros);
}

$filtro = $where ? ' WHERE ' . implode(' AND ', $where) : '';
$porPagina = 25;
$pagina = max(1, (int) ($_GET['pagina'] ?? 1));
$totais = linha('SELECT COUNT(*) AS total, COALESCE(SUM(a.autorizado), 0) AS liberados FROM acessos a' . $filtro, $params);
$total = (int) $totais['total'];
$offset = ($pagina - 1) * $porPagina;

$itens = linhas(SQL_ACESSOS . $filtro . " ORDER BY a.data_hora DESC, a.id DESC LIMIT $porPagina OFFSET $offset", $params);

ok([
    'itens'     => array_map('formatar_acesso', $itens),
    'total'     => $total,
    'liberados' => (int) $totais['liberados'],
    'bloqueados'=> $total - (int) $totais['liberados'],
    'pagina'    => $pagina,
    'paginas'   => max(1, (int) ceil($total / $porPagina)),
]);
