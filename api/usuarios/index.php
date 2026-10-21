<?php
// /api/usuarios/index.php — contas de administrador.
//   GET                          lista administradores
//   POST                         cria (nome, login, email, senha opcional)
//   POST ?id=2&acao=desativar    desativa (não vale para a própria conta nem para o último admin ativo)
//   POST ?id=2&acao=ativar       reativa
//   POST ?id=2&acao=senha        gera senha provisória
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('GET', 'POST');
$eu = exigir_login('admin');
$id = param_id();

if (metodo() === 'GET') {
    ok(array_map(function ($u) use ($eu) {
        return [
            'id'           => (int) $u['id'],
            'nome'         => $u['nome'],
            'login'        => $u['login'],
            'email'        => $u['email'],
            'ativo'        => (bool) (int) $u['ativo'],
            'ultimo_login' => iso($u['ultimo_login']),
            'eu'           => (int) $u['id'] === (int) $eu['id'],
        ];
    }, linhas("SELECT id, nome, login, email, ativo, ultimo_login FROM usuarios WHERE perfil = 'admin' ORDER BY nome")));
}

if ($id) {
    $alvo = linha("SELECT id, ativo FROM usuarios WHERE id = ? AND perfil = 'admin'", [$id]);
    if (!$alvo) {
        falha(404, 'NAO_ENCONTRADO', 'Administrador não encontrado.');
    }
    if (acao() === 'desativar') {
        if ((int) $id === (int) $eu['id']) {
            falha(409, 'PROPRIA_CONTA', 'Você não pode desativar a sua própria conta.');
        }
        consulta('UPDATE usuarios SET ativo = 0 WHERE id = ?', [$id]);
        ok(['id' => $id], 'Administrador desativado.');
    }
    if (acao() === 'ativar') {
        consulta('UPDATE usuarios SET ativo = 1 WHERE id = ?', [$id]);
        ok(['id' => $id], 'Administrador reativado.');
    }
    if (acao() === 'senha') {
        $senha = gerar_senha();
        consulta('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 1, falhas_login = 0, bloqueado_ate = NULL WHERE id = ?',
            [password_hash($senha, PASSWORD_DEFAULT), $id]);
        ok(['senha_provisoria' => $senha], 'Senha provisória gerada.');
    }
    falha(400, 'ACAO_INVALIDA', 'Ação desconhecida.');
}

$in = entrada();
$erros = [];
$nome = texto($in, 'nome', 'o nome', 3, 120, $erros);
$login = strtolower(trim((string) ($in['login'] ?? '')));
if (!preg_match('/^[a-z0-9][a-z0-9._\-]{2,59}$/', $login)) {
    $erros['login'] = 'Use de 3 a 60 letras minúsculas, números, ponto ou hífen.';
}
$email = trim((string) ($in['email'] ?? ''));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $erros['email'] = 'E-mail inválido.';
}
$senha = (string) ($in['senha'] ?? '');
if ($senha !== '' && !senha_forte($senha)) {
    $erros['senha'] = 'Use pelo menos 8 caracteres, com letras e números.';
}
if ($erros) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', $erros);
}
$gerada = null;
if ($senha === '') {
    $senha = $gerada = gerar_senha();
}
try {
    consulta("INSERT INTO usuarios (nome, login, email, senha_hash, perfil, deve_trocar_senha) VALUES (?, ?, ?, ?, 'admin', 1)",
        [$nome, $login, $email !== '' ? $email : null, password_hash($senha, PASSWORD_DEFAULT)]);
} catch (PDOException $e) {
    $chave = chave_duplicada($e);
    if ($chave) {
        $campo = strpos($chave, 'email') !== false ? 'email' : 'login';
        falha(409, 'DUPLICADO', 'Já existe uma conta com este ' . ($campo === 'email' ? 'e-mail' : 'login') . '.', [$campo => 'Já cadastrado.']);
    }
    throw $e;
}
ok(['id' => (int) db()->lastInsertId(), 'login' => $login, 'senha_provisoria' => $gerada], 'Administrador criado.', 201);
