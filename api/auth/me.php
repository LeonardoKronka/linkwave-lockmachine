<?php
// GET /api/auth/me.php — devolve quem está logado (ou 401).
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('GET');
$u = exigir_login(null, true);
ok(usuario_publico($u));
