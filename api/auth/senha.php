<?php
// POST /api/auth/senha.php — troca a senha de quem está logado.
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('POST');
$u = exigir_login(null, true);

$in = entrada();
$atual = (string) ($in['senha_atual'] ?? '');
$nova = (string) ($in['nova_senha'] ?? '');

$registro = linha('SELECT senha_hash FROM usuarios WHERE id = ?', [$u['id']]);
if (!password_verify($atual, $registro['senha_hash'])) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', ['senha_atual' => 'A senha atual não confere.']);
}
if (!senha_forte($nova)) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', ['nova_senha' => 'Use pelo menos 8 caracteres, com letras e números.']);
}
if (password_verify($nova, $registro['senha_hash'])) {
    falha(400, 'DADOS_INVALIDOS', 'Revise os campos destacados.', ['nova_senha' => 'A nova senha precisa ser diferente da atual.']);
}

$hash = password_hash($nova, PASSWORD_DEFAULT);
consulta('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0 WHERE id = ?', [$hash, $u['id']]);

session_regenerate_id(true);
$_SESSION['hs'] = substr($hash, -12);
renovar_cookie();

$u['deve_trocar_senha'] = 0;
ok(usuario_publico($u), 'Senha alterada.');
