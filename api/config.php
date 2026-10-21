<?php
// Configuração da API do LockMachine.
// NÃO coloque a senha do banco aqui: copie config.local.exemplo.php para
// config.local.php e preencha com os dados do banco criado no cPanel.

$config = [
    'db_host'     => 'localhost',
    'db_port'     => 3306,
    'db_name'     => '',
    'db_user'     => '',
    'db_pass'     => '',
    'timezone'    => 'America/Sao_Paulo',
    'sessao_dias' => 7,      // por quantos dias o login fica salvo no app
    'debug'       => false,  // true mostra o erro técnico na resposta (só para testes)
];

if (is_file(__DIR__ . '/config.local.php')) {
    $local = require __DIR__ . '/config.local.php';
    if (is_array($local)) {
        $config = array_merge($config, $local);
    }
}

return $config;
