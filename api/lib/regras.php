<?php
// LockMachine · regra de validação de acesso (seção 4.7 do TCC).
// A ordem importa: a primeira condição que falhar define o motivo registrado.

const MOTIVOS = [
    'AUTORIZADO'           => 'Todas as condições cadastrais foram atendidas.',
    'CARTAO_DESCONHECIDO'  => 'UID não associado a operador.',
    'OPERADOR_INATIVO'     => 'Cadastro do operador desativado.',
    'MAQUINA_INDISPONIVEL' => 'Máquina bloqueada, inativa ou em manutenção.',
    'TREINAMENTO_AUSENTE'  => 'Operador não possui uma capacitação exigida.',
    'TREINAMENTO_VENCIDO'  => 'Capacitação encontrada, porém fora da validade.',
    'SERVICO_INDISPONIVEL' => 'Não foi possível concluir a validação com segurança.',
];

const DIAS_ALERTA_VENCIMENTO = 30;

function resultado($autorizado, $motivo, $detalhe, $exigencias = [])
{
    return [
        'autorizado'    => $autorizado,
        'motivo_codigo' => $motivo,
        'mensagem'      => MOTIVOS[$motivo],
        'detalhe'       => $detalhe,
        'exigencias'    => $exigencias,
    ];
}

// $operador e $maquina são linhas do banco (ou null quando não encontrados).
function avaliar_acesso($operador, $maquina, $hoje)
{
    if (!$operador) {
        return resultado(false, 'CARTAO_DESCONHECIDO', 'O cartão lido não está associado a nenhum operador.');
    }
    if (!(int) $operador['ativo']) {
        return resultado(false, 'OPERADOR_INATIVO', 'O cadastro de ' . $operador['nome'] . ' está desativado.');
    }
    if (!$maquina) {
        return resultado(false, 'MAQUINA_INDISPONIVEL', 'Máquina não cadastrada.');
    }
    if ($maquina['status'] !== 'ativa') {
        return resultado(false, 'MAQUINA_INDISPONIVEL', $maquina['codigo'] . ' está com status "' . rotulo_status_maquina($maquina['status']) . '".');
    }

    $exigencias = linhas(
        'SELECT t.id, t.nome, ot.valido_ate
           FROM maquina_treinamento mt
           JOIN treinamentos t ON t.id = mt.treinamento_id
           LEFT JOIN operador_treinamento ot ON ot.treinamento_id = t.id AND ot.operador_id = ?
          WHERE mt.maquina_id = ?
          ORDER BY t.nome',
        [(int) $operador['id'], (int) $maquina['id']]
    );
    $lista = array_map(function ($e) use ($hoje) {
        return [
            'treinamento_id' => (int) $e['id'],
            'nome'           => $e['nome'],
            'valido_ate'     => $e['valido_ate'],
            'situacao'       => $e['valido_ate'] === null ? 'ausente' : ($e['valido_ate'] < $hoje ? 'vencida' : 'valida'),
        ];
    }, $exigencias);

    $ausentes = array_values(array_filter($lista, function ($e) { return $e['situacao'] === 'ausente'; }));
    if ($ausentes) {
        return resultado(false, 'TREINAMENTO_AUSENTE', 'Falta: ' . implode(', ', array_column($ausentes, 'nome')) . '.', $lista);
    }
    $vencidas = array_values(array_filter($lista, function ($e) { return $e['situacao'] === 'vencida'; }));
    if ($vencidas) {
        return resultado(false, 'TREINAMENTO_VENCIDO', $vencidas[0]['nome'] . ' venceu em ' . data_br($vencidas[0]['valido_ate']) . '.', $lista);
    }
    return resultado(true, 'AUTORIZADO', $lista ? 'Capacitações exigidas em dia.' : 'Esta máquina não exige capacitações cadastradas.', $lista);
}

function situacao_capacitacao($validoAte, $hoje)
{
    $dias = (int) floor((strtotime($validoAte) - strtotime($hoje)) / 86400);
    if ($dias < 0) {
        return ['situacao' => 'vencida', 'dias' => $dias];
    }
    return ['situacao' => $dias <= DIAS_ALERTA_VENCIMENTO ? 'vencendo' : 'valida', 'dias' => $dias];
}

function rotulo_status_maquina($status)
{
    $r = ['ativa' => 'ativa', 'manutencao' => 'em manutenção', 'bloqueada' => 'bloqueada', 'inativa' => 'inativa'];
    return $r[$status] ?? $status;
}

function capacitacoes_do_operador($operadorId, $hoje)
{
    $itens = linhas(
        'SELECT ot.id, ot.treinamento_id, t.nome, t.validade_meses, ot.concluido_em, ot.valido_ate
           FROM operador_treinamento ot
           JOIN treinamentos t ON t.id = ot.treinamento_id
          WHERE ot.operador_id = ?
          ORDER BY ot.valido_ate',
        [$operadorId]
    );
    return array_map(function ($c) use ($hoje) {
        $s = situacao_capacitacao($c['valido_ate'], $hoje);
        return [
            'id'             => (int) $c['id'],
            'treinamento_id' => (int) $c['treinamento_id'],
            'nome'           => $c['nome'],
            'validade_meses' => (int) $c['validade_meses'],
            'concluido_em'   => $c['concluido_em'],
            'valido_ate'     => $c['valido_ate'],
            'situacao'       => $s['situacao'],
            'dias'           => $s['dias'],
        ];
    }, $itens);
}

// Situação de cada máquina para um operador (consulta, não registra acesso).
function maquinas_para_operador($operador, $hoje)
{
    $maquinas = linhas("SELECT * FROM maquinas WHERE status <> 'inativa' ORDER BY codigo");
    return array_map(function ($m) use ($operador, $hoje) {
        $r = avaliar_acesso($operador, $m, $hoje);
        return [
            'id'            => (int) $m['id'],
            'codigo'        => $m['codigo'],
            'nome'          => $m['nome'],
            'localizacao'   => $m['localizacao'],
            'status'        => $m['status'],
            'liberada'      => $r['autorizado'],
            'motivo_codigo' => $r['motivo_codigo'],
            'detalhe'       => $r['detalhe'],
            'exigencias'    => $r['exigencias'],
        ];
    }, $maquinas);
}

function formatar_acesso($a)
{
    return [
        'id'             => (int) $a['id'],
        'data_hora'      => iso($a['data_hora']),
        'autorizado'     => (bool) (int) $a['autorizado'],
        'motivo_codigo'  => $a['motivo_codigo'],
        'maquina_codigo' => $a['maquina_codigo'],
        'maquina_nome'   => $a['maquina_nome'] ?? null,
        'operador_id'    => isset($a['operador_id']) ? ($a['operador_id'] !== null ? (int) $a['operador_id'] : null) : null,
        'operador_nome'  => $a['operador_nome'] ?? null,
        'uid'            => $a['rfid_uid_mascarado'],
        'origem'         => $a['origem'],
    ];
}

const SQL_ACESSOS = 'SELECT a.id, a.data_hora, a.autorizado, a.motivo_codigo, a.maquina_codigo, a.rfid_uid_mascarado, a.origem,
                            a.operador_id, o.nome AS operador_nome, m.nome AS maquina_nome
                       FROM acessos a
                  LEFT JOIN operadores o ON o.id = a.operador_id
                  LEFT JOIN maquinas m ON m.id = a.maquina_id';
