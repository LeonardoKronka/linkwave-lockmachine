<?php
// POST /api/auth/logout.php — encerra e invalida a sessão.
require __DIR__ . '/../lib/bootstrap.php';

exigir_metodo('POST');
exigir_cabecalho_app();
encerrar_sessao();
responder(204);
