<?php
// /api/capacitacoes/index.php — capacitações concluídas por operador.
//   POST                        registra ou renova (operador_id, treinamento_id, concluido_em, valido_ate opcional)
//   POST ?id=7&acao=remover     remove o registro
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('POST');
exigir_login('admin');
$id = param_id();

if ($id && acao() === 'remover') {
    $n = consulta('DELETE FROM operador_treinamento WHERE id = ?', [$id])->rowCount();
    if (!$n) {
        falha(404, 'NAO_ENCONTRADO', 'Capacitação não encontrada.');
    }
    ok(['id' => $id], 'Capacitação removida.');
}
if ($id) {
    falha(400, 'ACAO_INVALIDA', 'Ação desconhecida.');
}

$in = entrada();
$erros = [];
$operadorId = inteiro($in, 'operador_id', 1, PHP_INT_MAX, $erros, 'Funcionário inválido.');
$treinamentoId = inteiro($in, 'treinamento_id', 1, PHP_INT_MAX, $erros, 'Escolha o treinamento.');
$concluido = data_valida($in['concluido_em'] ?? null);
if (!$concluido) {
    $erros['concluido_em'] = 'Informe a data de conclusão.';
} elseif ($concluido > hoje()) {
    $erros['concluido_em'] = 'A conclusão não pode ser uma data futura.';
}
$validoAteInformado = trim((string) ($in['valido_ate'] ?? ''));
$validoAte = $validoAteInformado === '' ? null : data_valida($validoAteInformado);
if ($validoAteInformado !== '' && !$validoAte) {
    $erros['valido_ate'] = 'Data de vencimento inválida.';
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
}

$operador = linha('SELECT id FROM operadores WHERE id = ?', [$operadorId]);
$treinamento = linha('SELECT id, nome, validade_meses FROM treinamentos WHERE id = ?', [$treinamentoId]);
if (!$operador || !$treinamento) {
    falha(404, 'NAO_ENCONTRADO', 'Funcionário ou treinamento não encontrado.');
}
// Vencimento calculado pela validade do treinamento, ou informado manualmente.
if (!$validoAte) {
    $validoAte = somar_meses($concluido, $treinamento['validade_meses']);
}
if ($validoAte <= $concluido) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', ['valido_ate' => 'O vencimento precisa ser depois da conclusão.']);
}

consulta(
    'INSERT INTO operador_treinamento (operador_id, treinamento_id, concluido_em, valido_ate) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE concluido_em = VALUES(concluido_em), valido_ate = VALUES(valido_ate)',
    [$operadorId, $treinamentoId, $concluido, $validoAte]
);

ok(['operador_id' => $operadorId, 'treinamento_id' => $treinamentoId, 'concluido_em' => $concluido, 'valido_ate' => $validoAte],
    $treinamento['nome'] . ' registrado até ' . data_br($validoAte) . '.', 201);
