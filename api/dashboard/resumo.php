<?php
// GET /api/dashboard/resumo.php — indicadores e registros recentes (RF11), calculados no banco.
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/regras.php';

exigir_metodo('GET');
exigir_login('admin');

$hoje = hoje();
$amanha = date('Y-m-d', strtotime('+1 day'));
$limite = date('Y-m-d', strtotime('+' . DIAS_ALERTA_VENCIMENTO . ' days'));
$inicioSerie = date('Y-m-d', strtotime('-6 days'));

$dia = linha('SELECT COUNT(*) AS total, COALESCE(SUM(autorizado), 0) AS liberados FROM acessos WHERE data_hora >= ? AND data_hora < ?',
    [$hoje . ' 00:00:00', $amanha . ' 00:00:00']);
$ops = linha('SELECT COUNT(*) AS total, COALESCE(SUM(ativo), 0) AS ativos FROM operadores');

$statusMaquinas = ['ativa' => 0, 'manutencao' => 0, 'bloqueada' => 0, 'inativa' => 0];
foreach (linhas('SELECT status, COUNT(*) AS n FROM maquinas GROUP BY status') as $r) {
    $statusMaquinas[$r['status']] = (int) $r['n'];
}

$vencidas = (int) valor('SELECT COUNT(*) FROM operador_treinamento ot JOIN operadores o ON o.id = ot.operador_id WHERE o.ativo = 1 AND ot.valido_ate < ?', [$hoje]);
$vencendo = linhas(
    'SELECT o.id AS operador_id, o.nome AS operador, t.nome AS treinamento, ot.valido_ate
       FROM operador_treinamento ot
       JOIN operadores o ON o.id = ot.operador_id
       JOIN treinamentos t ON t.id = ot.treinamento_id
      WHERE o.ativo = 1 AND ot.valido_ate <= ?
      ORDER BY ot.valido_ate
      LIMIT 8',
    [$limite]
);

// Série dos últimos 7 dias (dias sem tentativas aparecem com zero).
$porDia = [];
foreach (linhas('SELECT DATE(data_hora) AS dia, SUM(autorizado) AS liberados, SUM(1 - autorizado) AS bloqueados
                   FROM acessos WHERE data_hora >= ? GROUP BY DATE(data_hora)', [$inicioSerie . ' 00:00:00']) as $r) {
    $porDia[$r['dia']] = $r;
}
$serie = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $serie[] = [
        'dia'        => $d,
        'liberados'  => isset($porDia[$d]) ? (int) $porDia[$d]['liberados'] : 0,
        'bloqueados' => isset($porDia[$d]) ? (int) $porDia[$d]['bloqueados'] : 0,
    ];
}

$motivos = array_map(function ($r) {
    return ['motivo_codigo' => $r['motivo_codigo'], 'total' => (int) $r['n']];
}, linhas('SELECT motivo_codigo, COUNT(*) AS n FROM acessos WHERE autorizado = 0 AND data_hora >= ? GROUP BY motivo_codigo ORDER BY n DESC',
    [date('Y-m-d', strtotime('-30 days')) . ' 00:00:00']));

ok([
    'hoje'          => ['tentativas' => (int) $dia['total'], 'liberados' => (int) $dia['liberados'], 'bloqueados' => (int) $dia['total'] - (int) $dia['liberados']],
    'operadores'    => ['total' => (int) $ops['total'], 'ativos' => (int) $ops['ativos']],
    'maquinas'      => $statusMaquinas,
    'capacitacoes'  => [
        'vencidas'      => $vencidas,
        'proximas'      => array_map(function ($v) use ($hoje) {
            $s = situacao_capacitacao($v['valido_ate'], $hoje);
            return ['operador_id' => (int) $v['operador_id'], 'operador' => $v['operador'], 'treinamento' => $v['treinamento'],
                    'valido_ate' => $v['valido_ate'], 'situacao' => $s['situacao'], 'dias' => $s['dias']];
        }, $vencendo),
    ],
    'serie_7_dias'  => $serie,
    'motivos_30_dias' => $motivos,
    'recentes'      => array_map('formatar_acesso', linhas(SQL_ACESSOS . ' ORDER BY a.data_hora DESC, a.id DESC LIMIT 8')),
    'lista_maquinas'=> array_map(function ($m) {
        return ['id' => (int) $m['id'], 'codigo' => $m['codigo'], 'nome' => $m['nome'], 'status' => $m['status']];
    }, linhas('SELECT id, codigo, nome, status FROM maquinas ORDER BY codigo')),
    'gerado_em'     => iso(agora()),
]);
