<?php
// /api/operadores/index.php — funcionários (operadores) e seus acessos ao app.
//   GET                         lista (filtros: q, situacao=ativos|inativos)
//   GET  ?id=5                  detalhe com capacitações, máquinas e acessos
//   POST                        cadastra
//   POST ?id=5                  edita
//   POST ?id=5&acao=desativar   desativa (desativação lógica)
//   POST ?id=5&acao=ativar      reativa
//   POST ?id=5&acao=senha       gera senha provisória do app (cria o login se não existir)
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('GET', 'POST');
exigir_login('admin');
$id = param_id();
$hoje = hoje();
$limite = date('Y-m-d', strtotime('+' . DIAS_ALERTA_VENCIMENTO . ' days'));

function buscar_operador($id)
{
    $o = linha('SELECT * FROM operadores WHERE id = ?', [$id]);
    if (!$o) {
        falha(404, 'NAO_ENCONTRADO', 'Funcionário não encontrado.');
    }
    return $o;
}

function validar_operador($in)
{
    $erros = [];
    $nome = texto($in, 'nome', 'o nome', 3, 120, $erros);
    $matricula = texto($in, 'matricula', 'a matrícula', 2, 30, $erros);
    if ($matricula !== null) {
        $matricula = strtoupper($matricula);
        if (!preg_match('/^[A-Z0-9][A-Z0-9._\-]{1,29}$/', $matricula)) {
            $erros['matricula'] = 'Use letras, números, ponto ou hífen, sem espaços.';
        }
    }
    $setor = texto($in, 'setor', 'o setor', 2, 80, $erros, false);
    $uid = null;
    $uidBruto = trim((string) ($in['rfid_uid'] ?? ''));
    if ($uidBruto !== '') {
        $uid = normalizar_uid($uidBruto);
        if (!$uid) {
            $erros['rfid_uid'] = 'UID inválido: use de 8 a 20 caracteres hexadecimais (0-9 e A-F).';
        }
    }
    return [compact('nome', 'matricula', 'setor', 'uid'), $erros];
}

function erro_duplicado(PDOException $e)
{
    $chave = chave_duplicada($e);
    if ($chave === null) {
        throw $e;
    }
    if (strpos($chave, 'uid') !== false) {
        falha(409, 'DUPLICADO', 'Este cartão já está vinculado a outro funcionário.', ['rfid_uid' => 'UID já cadastrado.']);
    }
    falha(409, 'DUPLICADO', 'Já existe um cadastro com esta matrícula.', ['matricula' => 'Matrícula já cadastrada.']);
}

/* ---------- Leitura ---------- */

if (metodo() === 'GET') {
    if ($id) {
        $o = buscar_operador($id);
        $login = $o['usuario_id']
            ? linha('SELECT login, ativo, deve_trocar_senha, ultimo_login FROM usuarios WHERE id = ?', [$o['usuario_id']])
            : null;
        $acessos = linhas(SQL_ACESSOS . ' WHERE a.operador_id = ? ORDER BY a.data_hora DESC, a.id DESC LIMIT 12', [$id]);
        ok([
            'id'           => (int) $o['id'],
            'nome'         => $o['nome'],
            'matricula'    => $o['matricula'],
            'setor'        => $o['setor'],
            'rfid_uid'     => $o['rfid_uid'],
            'ativo'        => (bool) (int) $o['ativo'],
            'criado_em'    => iso($o['criado_em']),
            'app'          => $login ? [
                'login'             => $login['login'],
                'ativo'             => (bool) (int) $login['ativo'],
                'senha_provisoria'  => (bool) (int) $login['deve_trocar_senha'],
                'ultimo_login'      => iso($login['ultimo_login']),
            ] : null,
            'capacitacoes' => capacitacoes_do_operador($id, $hoje),
            'maquinas'     => maquinas_para_operador($o, $hoje),
            'acessos'      => array_map('formatar_acesso', $acessos),
        ]);
    }

    $q = trim((string) ($_GET['q'] ?? ''));
    $situacao = (string) ($_GET['situacao'] ?? '');
    $sql = 'SELECT o.id, o.nome, o.matricula, o.setor, o.rfid_uid, o.ativo, o.usuario_id,
                   (SELECT COUNT(*) FROM operador_treinamento ot WHERE ot.operador_id = o.id) AS capacitacoes,
                   (SELECT COUNT(*) FROM operador_treinamento ot WHERE ot.operador_id = o.id AND ot.valido_ate < ?) AS vencidas,
                   (SELECT COUNT(*) FROM operador_treinamento ot WHERE ot.operador_id = o.id AND ot.valido_ate >= ? AND ot.valido_ate <= ?) AS vencendo,
                   (SELECT MAX(a.data_hora) FROM acessos a WHERE a.operador_id = o.id) AS ultimo_acesso
              FROM operadores o WHERE 1 = 1';
    $params = [$hoje, $hoje, $limite];
    if ($q !== '') {
        $sql .= ' AND (o.nome LIKE ? OR o.matricula LIKE ? OR o.setor LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }
    if ($situacao === 'ativos') {
        $sql .= ' AND o.ativo = 1';
    } elseif ($situacao === 'inativos') {
        $sql .= ' AND o.ativo = 0';
    }
    $sql .= ' ORDER BY o.ativo DESC, o.nome';

    $itens = array_map(function ($o) {
        return [
            'id'            => (int) $o['id'],
            'nome'          => $o['nome'],
            'matricula'     => $o['matricula'],
            'setor'         => $o['setor'],
            'tem_cartao'    => $o['rfid_uid'] !== null,
            'uid'           => $o['rfid_uid'] ? mascarar_uid($o['rfid_uid']) : null,
            'ativo'         => (bool) (int) $o['ativo'],
            'tem_login'     => $o['usuario_id'] !== null,
            'capacitacoes'  => (int) $o['capacitacoes'],
            'vencidas'      => (int) $o['vencidas'],
            'vencendo'      => (int) $o['vencendo'],
            'ultimo_acesso' => iso($o['ultimo_acesso']),
        ];
    }, linhas($sql, $params));
    ok($itens);
}

/* ---------- Escrita ---------- */

$pdo = db();
$in = entrada();

// Cadastro
if (!$id) {
    list($d, $erros) = validar_operador($in);
    $criarLogin = !empty($in['criar_login']);
    $senha = (string) ($in['senha'] ?? '');
    if ($criarLogin && $senha !== '' && !senha_forte($senha)) {
        $erros['senha'] = 'Use pelo menos 8 caracteres, com letras e números.';
    }
    if ($erros) {
        falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
    }

    $senhaGerada = null;
    try {
        $pdo->beginTransaction();
        $usuarioId = null;
        if ($criarLogin) {
            if ($senha === '') {
                $senha = $senhaGerada = gerar_senha();
            }
            consulta(
                "INSERT INTO usuarios (nome, login, senha_hash, perfil, deve_trocar_senha) VALUES (?, ?, ?, 'funcionario', 1)",
                [$d['nome'], $d['matricula'], password_hash($senha, PASSWORD_DEFAULT)]
            );
            $usuarioId = (int) $pdo->lastInsertId();
        }
        consulta(
            'INSERT INTO operadores (usuario_id, nome, matricula, setor, rfid_uid) VALUES (?, ?, ?, ?, ?)',
            [$usuarioId, $d['nome'], $d['matricula'], $d['setor'], $d['uid']]
        );
        $novo = (int) $pdo->lastInsertId();
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        erro_duplicado($e);
    }
    ok(['id' => $novo, 'login' => $criarLogin ? $d['matricula'] : null, 'senha_provisoria' => $senhaGerada], 'Funcionário cadastrado.', 201);
}

$o = buscar_operador($id);
$acao = acao();

// Edição
if ($acao === '') {
    list($d, $erros) = validar_operador($in);
    if ($erros) {
        falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
    }
    try {
        $pdo->beginTransaction();
        consulta(
            'UPDATE operadores SET nome = ?, matricula = ?, setor = ?, rfid_uid = ? WHERE id = ?',
            [$d['nome'], $d['matricula'], $d['setor'], $d['uid'], $id]
        );
        if ($o['usuario_id']) {
            consulta('UPDATE usuarios SET nome = ?, login = ? WHERE id = ?', [$d['nome'], $d['matricula'], $o['usuario_id']]);
        }
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        erro_duplicado($e);
    }
    ok(['id' => $id], 'Cadastro atualizado.');
}

if ($acao === 'desativar' || $acao === 'ativar') {
    $ativo = $acao === 'ativar' ? 1 : 0;
    $pdo->beginTransaction();
    consulta('UPDATE operadores SET ativo = ? WHERE id = ?', [$ativo, $id]);
    if ($o['usuario_id']) {
        consulta('UPDATE usuarios SET ativo = ? WHERE id = ?', [$ativo, $o['usuario_id']]);
    }
    $pdo->commit();
    ok(['id' => $id, 'ativo' => (bool) $ativo], $ativo ? 'Funcionário reativado.' : 'Funcionário desativado. O histórico foi preservado.');
}

if ($acao === 'senha') {
    $senha = gerar_senha();
    $hash = password_hash($senha, PASSWORD_DEFAULT);
    try {
        if ($o['usuario_id']) {
            consulta('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 1, falhas_login = 0, bloqueado_ate = NULL WHERE id = ?', [$hash, $o['usuario_id']]);
        } else {
            $pdo->beginTransaction();
            consulta(
                "INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo, deve_trocar_senha) VALUES (?, ?, ?, 'funcionario', ?, 1)",
                [$o['nome'], $o['matricula'], $hash, (int) $o['ativo']]
            );
            consulta('UPDATE operadores SET usuario_id = ? WHERE id = ?', [(int) $pdo->lastInsertId(), $id]);
            $pdo->commit();
        }
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (chave_duplicada($e)) {
            falha(409, 'DUPLICADO', 'Já existe uma conta com este login (a matrícula).');
        }
        throw $e;
    }
    ok(['login' => $o['matricula'], 'senha_provisoria' => $senha], 'Senha provisória gerada. Ela será trocada no primeiro acesso.');
}

falha(400, 'ACAO_INVALIDA', 'Ação desconhecida.');
