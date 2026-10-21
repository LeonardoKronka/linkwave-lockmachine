<?php
// /api/dispositivos/index.php — leitoras ESP32 autorizadas a validar acessos.
//   GET                          lista
//   POST                         cadastra (nome, maquina_id) e devolve o token UMA vez
//   POST ?id=1&acao=novo_token   gera outro token (o anterior deixa de funcionar)
//   POST ?id=1&acao=revogar      bloqueia a leitora
//   POST ?id=1&acao=ativar       libera de novo
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('GET', 'POST');
exigir_login('admin');
$id = param_id();

function novo_token()
{
    $token = 'lm_' . bin2hex(random_bytes(20));
    return [$token, hash('sha256', $token), substr($token, -4)];
}

if (metodo() === 'GET') {
    ok(array_map(function ($d) {
        return [
            'id'             => (int) $d['id'],
            'nome'           => $d['nome'],
            'maquina_id'     => $d['maquina_id'] !== null ? (int) $d['maquina_id'] : null,
            'maquina_codigo' => $d['maquina_codigo'],
            'token_final'    => $d['token_final'],
            'ativo'          => (bool) (int) $d['ativo'],
            'ultimo_contato' => iso($d['ultimo_contato']),
        ];
    }, linhas('SELECT d.*, m.codigo AS maquina_codigo FROM dispositivos d LEFT JOIN maquinas m ON m.id = d.maquina_id ORDER BY d.nome')));
}

if ($id) {
    if (!linha('SELECT id FROM dispositivos WHERE id = ?', [$id])) {
        falha(404, 'NAO_ENCONTRADO', 'Leitora não encontrada.');
    }
    switch (acao()) {
        case 'novo_token':
            list($token, $hash, $final) = novo_token();
            consulta('UPDATE dispositivos SET token_hash = ?, token_final = ? WHERE id = ?', [$hash, $final, $id]);
            ok(['id' => $id, 'token' => $token], 'Novo token gerado. Atualize o firmware da leitora.');
        case 'revogar':
        case 'ativar':
            consulta('UPDATE dispositivos SET ativo = ? WHERE id = ?', [acao() === 'ativar' ? 1 : 0, $id]);
            ok(['id' => $id], acao() === 'ativar' ? 'Leitora liberada.' : 'Leitora bloqueada.');
    }
    falha(400, 'ACAO_INVALIDA', 'Ação desconhecida.');
}

$in = entrada();
$erros = [];
$nome = texto($in, 'nome', 'o nome da leitora', 2, 80, $erros);
$maquinaId = null;
if (isset($in['maquina_id']) && $in['maquina_id'] !== '' && $in['maquina_id'] !== null) {
    $maquinaId = inteiro($in, 'maquina_id', 1, PHP_INT_MAX, $erros, 'Máquina inválida.');
    if ($maquinaId && !linha('SELECT id FROM maquinas WHERE id = ?', [$maquinaId])) {
        $erros['maquina_id'] = 'Máquina não encontrada.';
    }
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
}

list($token, $hash, $final) = novo_token();
consulta('INSERT INTO dispositivos (nome, maquina_id, token_hash, token_final) VALUES (?, ?, ?, ?)', [$nome, $maquinaId, $hash, $final]);
ok(['id' => (int) db()->lastInsertId(), 'token' => $token], 'Leitora cadastrada. Copie o token agora: ele não será mostrado de novo.', 201);
