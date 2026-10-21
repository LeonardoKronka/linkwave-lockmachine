<?php
// GET /api/health.php — teste rápido depois do deploy: a API responde e o banco conecta?
require __DIR__ . '/lib/bootstrap.php';

exigir_metodo('GET');
$tabelas = (int) valor("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
                         AND table_name IN ('usuarios','operadores','maquinas','treinamentos','operador_treinamento','maquina_treinamento','acessos','dispositivos')");
ok([
    'api'     => 'online',
    'banco'   => 'conectado',
    'tabelas' => $tabelas . ' de 8',
    'hora'    => iso(agora()),
], $tabelas === 8 ? 'Tudo pronto.' : 'Banco conectado, mas faltam tabelas: importe database/schema.sql.');
