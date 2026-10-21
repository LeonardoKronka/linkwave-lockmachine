<?php
// /api/maquinas/index.php — máquinas, status e capacitações exigidas.
//   GET              lista
//   GET  ?id=2       detalhe com últimos acessos
//   POST             cadastra (codigo, nome, localizacao, status, exigencias: [ids])
//   POST ?id=2       edita
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('GET', 'POST');
exigir_login('admin');
$id = param_id();
const STATUS_MAQUINA = ['ativa', 'manutencao', 'bloqueada', 'inativa'];

function exigencias_por_maquina()
{
    $mapa = [];
    foreach (linhas('SELECT mt.maquina_id, t.id, t.nome FROM maquina_treinamento mt JOIN treinamentos t ON t.id = mt.treinamento_id ORDER BY t.nome') as $r) {
        $mapa[(int) $r['maquina_id']][] = ['id' => (int) $r['id'], 'nome' => $r['nome']];
    }
    return $mapa;
}

function formatar_maquina($m, $exigencias)
{
    return [
        'id'            => (int) $m['id'],
        'codigo'        => $m['codigo'],
        'nome'          => $m['nome'],
        'localizacao'   => $m['localizacao'],
        'status'        => $m['status'],
        'exigencias'    => $exigencias[(int) $m['id']] ?? [],
        'acessos_hoje'  => isset($m['acessos_hoje']) ? (int) $m['acessos_hoje'] : null,
        'ultimo_acesso' => isset($m['ultimo_acesso']) ? iso($m['ultimo_acesso']) : null,
    ];
}

if (metodo() === 'GET') {
    $exig = exigencias_por_maquina();
    if ($id) {
        $m = linha('SELECT * FROM maquinas WHERE id = ?', [$id]);
        if (!$m) {
            falha(404, 'NAO_ENCONTRADO', 'Máquina não encontrada.');
        }
        $dados = formatar_maquina($m, $exig);
        $dados['acessos'] = array_map('formatar_acesso', linhas(SQL_ACESSOS . ' WHERE a.maquina_id = ? ORDER BY a.data_hora DESC, a.id DESC LIMIT 10', [$id]));
        ok($dados);
    }
    $inicio = hoje() . ' 00:00:00';
    $itens = linhas(
        'SELECT m.*,
                (SELECT COUNT(*) FROM acessos a WHERE a.maquina_id = m.id AND a.data_hora >= ?) AS acessos_hoje,
                (SELECT MAX(a.data_hora) FROM acessos a WHERE a.maquina_id = m.id) AS ultimo_acesso
           FROM maquinas m ORDER BY m.codigo',
        [$inicio]
    );
    ok(array_map(function ($m) use ($exig) { return formatar_maquina($m, $exig); }, $itens));
}

$in = entrada();
$erros = [];
$codigo = normalizar_codigo($in['codigo'] ?? '');
if (!$codigo) {
    $erros['codigo'] = 'Use até 20 letras, números ou hífen (ex.: P-01).';
}
$nome = texto($in, 'nome', 'o nome', 2, 120, $erros);
$local = texto($in, 'localizacao', 'a localização', 2, 120, $erros, false);
$status = (string) ($in['status'] ?? 'ativa');
if (!in_array($status, STATUS_MAQUINA, true)) {
    $erros['status'] = 'Status inválido.';
}
$exigencias = [];
foreach ((array) ($in['exigencias'] ?? []) as $t) {
    if (!is_numeric($t) || (int) $t < 1) {
        $erros['exigencias'] = 'Treinamento inválido na lista.';
        break;
    }
    $exigencias[(int) $t] = true;
}
$exigencias = array_keys($exigencias);
if (!$erros && $exigencias) {
    $marcadores = implode(',', array_fill(0, count($exigencias), '?'));
    if ((int) valor("SELECT COUNT(*) FROM treinamentos WHERE id IN ($marcadores)", $exigencias) !== count($exigencias)) {
        $erros['exigencias'] = 'Um dos treinamentos não existe mais.';
    }
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
}

$pdo = db();
try {
    $pdo->beginTransaction();
    if ($id) {
        if (!linha('SELECT id FROM maquinas WHERE id = ? FOR UPDATE', [$id])) {
            $pdo->rollBack();
            falha(404, 'NAO_ENCONTRADO', 'Máquina não encontrada.');
        }
        consulta('UPDATE maquinas SET codigo = ?, nome = ?, localizacao = ?, status = ? WHERE id = ?', [$codigo, $nome, $local, $status, $id]);
        consulta('DELETE FROM maquina_treinamento WHERE maquina_id = ?', [$id]);
        $maquinaId = $id;
    } else {
        consulta('INSERT INTO maquinas (codigo, nome, localizacao, status) VALUES (?, ?, ?, ?)', [$codigo, $nome, $local, $status]);
        $maquinaId = (int) $pdo->lastInsertId();
    }
    foreach ($exigencias as $t) {
        consulta('INSERT INTO maquina_treinamento (maquina_id, treinamento_id) VALUES (?, ?)', [$maquinaId, $t]);
    }
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if (chave_duplicada($e)) {
        falha(409, 'DUPLICADO', 'Já existe uma máquina com este código.', ['codigo' => 'Código já cadastrado.']);
    }
    throw $e;
}

ok(['id' => $maquinaId], $id ? 'Máquina atualizada.' : 'Máquina cadastrada.', $id ? 200 : 201);
