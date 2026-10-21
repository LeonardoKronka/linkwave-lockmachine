<?php
// GET /api/funcionario/painel.php — tudo o que o funcionário vê no app:
// cadastro, capacitações, máquinas que pode operar (consulta) e últimos acessos.
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('GET');
$u = exigir_login('funcionario');

$o = linha('SELECT * FROM operadores WHERE usuario_id = ?', [$u['id']]);
if (!$o) {
    falha(404, 'SEM_CADASTRO', 'Sua conta ainda não está ligada a um cadastro de funcionário. Fale com o administrador.');
}

$hoje = hoje();
$capacitacoes = capacitacoes_do_operador((int) $o['id'], $hoje);
$contagem = ['valida' => 0, 'vencendo' => 0, 'vencida' => 0];
foreach ($capacitacoes as $c) {
    $contagem[$c['situacao']]++;
}
$maquinas = maquinas_para_operador($o, $hoje);

ok([
    'operador' => [
        'id'        => (int) $o['id'],
        'nome'      => $o['nome'],
        'matricula' => $o['matricula'],
        'setor'     => $o['setor'],
        'ativo'     => (bool) (int) $o['ativo'],
        'cartao'    => $o['rfid_uid'] ? mascarar_uid($o['rfid_uid']) : null,
    ],
    'resumo' => [
        'capacitacoes'      => $contagem,
        'maquinas_liberadas'=> count(array_filter($maquinas, function ($m) { return $m['liberada']; })),
        'maquinas_total'    => count($maquinas),
    ],
    'capacitacoes' => $capacitacoes,
    'maquinas'     => $maquinas,
    'acessos'      => array_map('formatar_acesso', linhas(SQL_ACESSOS . ' WHERE a.operador_id = ? ORDER BY a.data_hora DESC, a.id DESC LIMIT 30', [(int) $o['id']])),
]);
