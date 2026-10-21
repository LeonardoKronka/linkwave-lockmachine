<?php
// Copie este arquivo para "config.local.php" (na mesma pasta) e preencha.
// No cPanel: MySQL Databases mostra o nome do banco e do usuário,
// que sempre começam com o seu usuário do cPanel (ex.: grupo3_lockmachine).

return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'USUARIOCPANEL_lockmachine',
    'db_user' => 'USUARIOCPANEL_lmapp',
    'db_pass' => 'COLOQUE_A_SENHA_DO_USUARIO_DO_BANCO',
];
