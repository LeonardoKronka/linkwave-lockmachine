<?php
// POST /api/auth/login.php — valida credenciais e cria a sessão.
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('POST');
exigir_cabecalho_app();

$in = entrada();
$login = trim((string) ($in['login'] ?? ''));
$senha = (string) ($in['senha'] ?? '');
if ($login === '' || $senha === '') {
    falha(400, 'DADOS_INVALIDOS', 'Informe login e senha.');
}

$u = linha(
    'SELECT u.*, o.id AS operador_id
       FROM usuarios u LEFT JOIN operadores o ON o.usuario_id = u.id
      WHERE u.login = ? OR (u.email IS NOT NULL AND u.email = ?)
      LIMIT 1',
    [$login, $login]
);

if ($u && $u['bloqueado_ate'] && $u['bloqueado_ate'] > agora()) {
    falha(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas seguidas. Aguarde 5 minutos e tente de novo.');
}

// Hash fictício quando o login não existe: o tempo de resposta não revela contas.
$hash = $u ? $u['senha_hash'] : '$2y$10$lGd13Dm4v8svv5kuHFLB2erWl3pWBL9D6LzzSCZg4DyStDzOkcxY2';
$senhaConfere = password_verify($senha, $hash);

if (!$u || !$senhaConfere || !(int) $u['ativo']) {
    if ($u && !$senhaConfere) {
        $falhas = (int) $u['falhas_login'] + 1;
        $bloqueio = $falhas >= 5 ? date('Y-m-d H:i:s', time() + 300) : null;
        consulta('UPDATE usuarios SET falhas_login = ?, bloqueado_ate = ? WHERE id = ?', [$falhas >= 5 ? 0 : $falhas, $bloqueio, $u['id']]);
    }
    falha(401, 'CREDENCIAIS_INVALIDAS', 'Login ou senha inválidos.');
}

if (password_needs_rehash($u['senha_hash'], PASSWORD_DEFAULT)) {
    $u['senha_hash'] = password_hash($senha, PASSWORD_DEFAULT);
    consulta('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [$u['senha_hash'], $u['id']]);
}
consulta('UPDATE usuarios SET falhas_login = 0, bloqueado_ate = NULL, ultimo_login = ? WHERE id = ?', [agora(), $u['id']]);

iniciar_sessao();
session_regenerate_id(true);
$_SESSION['uid'] = (int) $u['id'];
$_SESSION['hs'] = substr($u['senha_hash'], -12);
renovar_cookie();

ok(usuario_publico($u), 'Bem-vindo(a), ' . strtok($u['nome'], ' ') . '!');
