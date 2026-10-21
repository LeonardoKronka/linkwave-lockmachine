<?php
// /api/treinamentos/index.php — tipos de capacitação e validade.
//   GET                       lista com uso em máquinas e operadores
//   POST                      cadastra (nome, descricao, validade_meses)
//   POST ?id=3                edita
//   POST ?id=3&acao=excluir   exclui, se não estiver em uso
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('GET', 'POST');
exigir_login('admin');
$id = param_id();

if (metodo() === 'GET') {
    $hoje = hoje();
    $itens = linhas(
        'SELECT t.*,
                (SELECT COUNT(*) FROM maquina_treinamento mt WHERE mt.treinamento_id = t.id) AS maquinas,
                (SELECT COUNT(*) FROM operador_treinamento ot WHERE ot.treinamento_id = t.id) AS operadores,
                (SELECT COUNT(*) FROM operador_treinamento ot WHERE ot.treinamento_id = t.id AND ot.valido_ate < ?) AS vencidas
           FROM treinamentos t ORDER BY t.nome',
        [$hoje]
    );
    ok(array_map(function ($t) {
        return [
            'id'             => (int) $t['id'],
            'nome'           => $t['nome'],
            'descricao'      => $t['descricao'],
            'validade_meses' => (int) $t['validade_meses'],
            'maquinas'       => (int) $t['maquinas'],
            'operadores'     => (int) $t['operadores'],
            'vencidas'       => (int) $t['vencidas'],
        ];
    }, $itens));
}

if ($id && acao() === 'excluir') {
    try {
        $n = consulta('DELETE FROM treinamentos WHERE id = ?', [$id])->rowCount();
    } catch (PDOException $e) {
        if (em_uso($e)) {
            falha(409, 'EM_USO', 'Este treinamento está vinculado a máquinas ou funcionários e não pode ser excluído.');
        }
        throw $e;
    }
    if (!$n) {
        falha(404, 'NAO_ENCONTRADO', 'Treinamento não encontrado.');
    }
    ok(['id' => $id], 'Treinamento excluído.');
}
if ($id && acao() !== '') {
    falha(400, 'ACAO_INVALIDA', 'Ação desconhecida.');
}

$in = entrada();
$erros = [];
$nome = texto($in, 'nome', 'o nome', 3, 120, $erros);
$descricao = texto($in, 'descricao', 'a descrição', 3, 255, $erros, false);
$validade = inteiro($in, 'validade_meses', 1, 120, $erros, 'Informe a validade em meses (de 1 a 120).');
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
}

try {
    if ($id) {
        $n = consulta('UPDATE treinamentos SET nome = ?, descricao = ?, validade_meses = ? WHERE id = ?', [$nome, $descricao, $validade, $id]);
        if (!linha('SELECT id FROM treinamentos WHERE id = ?', [$id])) {
            falha(404, 'NAO_ENCONTRADO', 'Treinamento não encontrado.');
        }
        ok(['id' => $id], 'Treinamento atualizado.');
    }
    consulta('INSERT INTO treinamentos (nome, descricao, validade_meses) VALUES (?, ?, ?)', [$nome, $descricao, $validade]);
    ok(['id' => (int) db()->lastInsertId()], 'Treinamento cadastrado.', 201);
} catch (PDOException $e) {
    if (chave_duplicada($e)) {
        falha(409, 'DUPLICADO', 'Já existe um treinamento com este nome.', ['nome' => 'Nome já cadastrado.']);
    }
    throw $e;
}
