<?php
// LockMachine · núcleo da API: configuração, banco, sessão, respostas JSON e validações.
// Compatível com PHP 7.4 a 8.4.

$GLOBALS['LM'] = require __DIR__ . '/../config.php';
date_default_timezone_set($GLOBALS['LM']['timezone']);
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');
// A API só devolve JSON: nada dela pode ser executado nem aberto dentro de outro site.
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('X-Frame-Options: DENY');

set_error_handler(function ($severidade, $mensagem, $arquivo, $linha) {
    if (!(error_reporting() & $severidade)) {
        return false;
    }
    throw new ErrorException($mensagem, 0, $severidade, $arquivo, $linha);
});

set_exception_handler(function ($e) {
    error_log('[LockMachine] ' . get_class($e) . ': ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
    $extra = !empty($GLOBALS['LM']['debug']) ? ['detalhe' => $e->getMessage()] : [];
    if ($e instanceof PDOException) {
        responder(503, ['sucesso' => false, 'codigo' => 'SERVICO_INDISPONIVEL',
            'mensagem' => 'Banco de dados indisponível. Tente novamente em instantes.'] + $extra);
    }
    responder(500, ['sucesso' => false, 'codigo' => 'ERRO_INTERNO',
        'mensagem' => 'Erro interno no servidor. O detalhe ficou registrado no log.'] + $extra);
});

/* ---------- Respostas (formato do Apêndice B) ---------- */

function responder($status, $corpo = null)
{
    if (!headers_sent()) {
        http_response_code($status);
    }
    if ($status !== 204 && $corpo !== null) {
        echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function ok($dados = null, $mensagem = null, $status = 200)
{
    $corpo = ['sucesso' => true];
    if ($dados !== null) {
        $corpo['dados'] = $dados;
    }
    if ($mensagem !== null) {
        $corpo['mensagem'] = $mensagem;
    }
    responder($status, $corpo);
}

function falha($status, $codigo, $mensagem, $erros = null)
{
    $corpo = ['sucesso' => false, 'codigo' => $codigo, 'mensagem' => $mensagem];
    if ($erros) {
        $corpo['erros'] = $erros;
    }
    responder($status, $corpo);
}

/* ---------- Banco ---------- */

function db()
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $c = $GLOBALS['LM'];
    if ($c['db_name'] === '' || $c['db_user'] === '') {
        falha(503, 'NAO_CONFIGURADO', 'A API ainda não foi configurada: crie api/config.local.php com os dados do banco.');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['db_host'], (int) $c['db_port'], $c['db_name']);
    $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // O banco passa a usar o mesmo fuso do PHP (NOW() e CURDATE() batem com a API).
    $pdo->exec("SET time_zone = '" . date('P') . "'");
    return $pdo;
}

function consulta($sql, $params = [])
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function linha($sql, $params = [])
{
    $r = consulta($sql, $params)->fetch();
    return $r ?: null;
}

function linhas($sql, $params = [])
{
    return consulta($sql, $params)->fetchAll();
}

function valor($sql, $params = [])
{
    return consulta($sql, $params)->fetchColumn();
}

// Violação de UNIQUE: devolve o nome da chave (ex.: uq_operadores_matricula) ou null.
function chave_duplicada(PDOException $e)
{
    $info = $e->errorInfo;
    if (!is_array($info) || (int) ($info[1] ?? 0) !== 1062) {
        return null;
    }
    return preg_match("/for key '([^']+)'/", $info[2] ?? '', $m) ? preg_replace('/^.*\./', '', $m[1]) : 'desconhecida';
}

function em_uso(PDOException $e)
{
    $info = $e->errorInfo;
    return is_array($info) && in_array((int) ($info[1] ?? 0), [1451, 1217], true);
}

/* ---------- Requisição ---------- */

function metodo()
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function exigir_metodo(...$permitidos)
{
    if (!in_array(metodo(), $permitidos, true)) {
        header('Allow: ' . implode(', ', $permitidos));
        falha(405, 'METODO_NAO_PERMITIDO', 'Método não permitido nesta rota.');
    }
}

function entrada()
{
    static $dados = null;
    if ($dados !== null) {
        return $dados;
    }
    $bruto = file_get_contents('php://input');
    if ($bruto === false || trim($bruto) === '') {
        return $dados = ($_POST ?: []);
    }
    $json = json_decode($bruto, true);
    if (!is_array($json)) {
        falha(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
    }
    return $dados = $json;
}

function param_id($nome = 'id')
{
    $v = $_GET[$nome] ?? null;
    if ($v === null || $v === '') {
        return null;
    }
    if (!ctype_digit((string) $v)) {
        falha(400, 'DADOS_INVALIDOS', 'Identificador inválido.');
    }
    return (int) $v;
}

function acao()
{
    return (string) ($_GET['acao'] ?? '');
}

// Escritas vindas do app precisam deste cabeçalho (bloqueia formulários de outros sites).
function exigir_cabecalho_app()
{
    if (metodo() !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'LockMachine') {
        falha(403, 'ORIGEM_INVALIDA', 'Requisição recusada.');
    }
}

/* ---------- Limite por IP (sem banco: um arquivo pequeno por IP e por rota) ---------- */

// REMOTE_ADDR é o único endereço que o cliente não consegue forjar por cabeçalho.
function ip_cliente()
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

// Lê (e, se pedido, soma 1) o contador do IP numa janela fixa de $janela segundos.
// O IP é guardado como hash, então a pasta não vira uma lista de endereços.
function contador_ip($grupo, $janela, $somar)
{
    $pasta = __DIR__ . '/../storage/limites';
    if (!is_dir($pasta)) {
        @mkdir($pasta, 0700, true);
    }
    if (!is_dir($pasta) || !is_writable($pasta)) {
        return [0, 0]; // sem onde guardar: o serviço continua funcionando
    }
    $agora = time();
    if (random_int(1, 200) === 1) {
        foreach (glob($pasta . '/*.json') ?: [] as $velho) {
            if (@filemtime($velho) < $agora - 86400) {
                @unlink($velho);
            }
        }
    }
    $f = @fopen($pasta . '/' . $grupo . '-' . hash('sha256', ip_cliente()) . '.json', 'c+');
    if (!$f) {
        return [0, 0];
    }
    flock($f, LOCK_EX);
    $d = json_decode((string) stream_get_contents($f), true);
    if (!is_array($d) || (int) ($d['inicio'] ?? 0) + $janela <= $agora) {
        $d = ['inicio' => $agora, 'n' => 0];
    }
    if ($somar) {
        $d['n']++;
        ftruncate($f, 0);
        rewind($f);
        fwrite($f, json_encode($d));
        fflush($f);
    }
    flock($f, LOCK_UN);
    fclose($f);
    return [(int) $d['n'], max(1, (int) $d['inicio'] + $janela - $agora)];
}

function recusar_por_limite($espera)
{
    header('Retry-After: ' . $espera);
    falha(429, 'MUITAS_REQUISICOES', 'Muitas tentativas a partir desta rede. Aguarde ' . (int) ceil($espera / 60) . ' min e tente de novo.');
}

// Conta todo pedido (ex.: validação da leitora).
function limitar($grupo, $maximo, $janela)
{
    list($n, $espera) = contador_ip($grupo, $janela, true);
    if ($n > $maximo) {
        recusar_por_limite($espera);
    }
}

// Conta só os erros (ex.: senha errada), para não travar uma sala inteira atrás do mesmo IP.
function bloqueado_por_erros($grupo, $maximo, $janela)
{
    list($n, $espera) = contador_ip($grupo, $janela, false);
    if ($n >= $maximo) {
        recusar_por_limite($espera);
    }
}

function registrar_erro($grupo, $janela)
{
    contador_ip($grupo, $janela, true);
}

/* ---------- Sessão (cookie HttpOnly, SameSite=Lax) ---------- */

function caminho_base()
{
    $script = $_SERVER['SCRIPT_NAME'] ?? '/';
    $pos = strpos($script, '/api/');
    return $pos === false ? '/' : substr($script, 0, $pos + 1);
}

function em_https()
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function parametros_cookie($duracao)
{
    return [
        'expires'  => $duracao > 0 ? time() + $duracao : 0,
        'path'     => caminho_base(),
        'secure'   => em_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function iniciar_sessao()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $segundos = max(1, (int) $GLOBALS['LM']['sessao_dias']) * 86400;
    // Pasta própria: a limpeza automática do servidor não derruba o login do app.
    $pasta = __DIR__ . '/../storage/sessoes';
    if (!is_dir($pasta)) {
        @mkdir($pasta, 0700, true);
    }
    if (is_dir($pasta) && is_writable($pasta)) {
        session_save_path($pasta);
    }
    ini_set('session.gc_maxlifetime', (string) $segundos);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('LMSESSAO');
    $p = parametros_cookie($segundos);
    session_set_cookie_params([
        'lifetime' => $segundos,
        'path'     => $p['path'],
        'secure'   => $p['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function renovar_cookie()
{
    $segundos = max(1, (int) $GLOBALS['LM']['sessao_dias']) * 86400;
    setcookie(session_name(), session_id(), parametros_cookie($segundos));
}

function encerrar_sessao()
{
    iniciar_sessao();
    $_SESSION = [];
    setcookie(session_name(), '', ['expires' => time() - 3600] + parametros_cookie(0));
    session_destroy();
}

function usuario_atual()
{
    static $usuario = false;
    if ($usuario !== false) {
        return $usuario;
    }
    iniciar_sessao();
    $id = $_SESSION['uid'] ?? null;
    if (!$id) {
        return $usuario = null;
    }
    $u = linha(
        'SELECT u.id, u.nome, u.login, u.email, u.perfil, u.ativo, u.deve_trocar_senha, u.senha_hash, o.id AS operador_id
           FROM usuarios u LEFT JOIN operadores o ON o.usuario_id = u.id
          WHERE u.id = ?',
        [$id]
    );
    // Conta desativada ou senha trocada em outro aparelho encerram a sessão.
    if (!$u || !(int) $u['ativo'] || ($_SESSION['hs'] ?? '') !== substr($u['senha_hash'], -12)) {
        encerrar_sessao();
        return $usuario = null;
    }
    renovar_cookie();
    unset($u['senha_hash']);
    return $usuario = $u;
}

function exigir_login($perfil = null, $aceitarSenhaProvisoria = false)
{
    exigir_cabecalho_app();
    $u = usuario_atual();
    if (!$u) {
        falha(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');
    }
    if (!$aceitarSenhaProvisoria && (int) $u['deve_trocar_senha']) {
        falha(403, 'TROCA_DE_SENHA', 'Troque a senha provisória para continuar.');
    }
    if ($perfil !== null && $u['perfil'] !== $perfil) {
        falha(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a esta área.');
    }
    return $u;
}

function usuario_publico($u)
{
    return [
        'id'                => (int) $u['id'],
        'nome'              => $u['nome'],
        'login'             => $u['login'],
        'email'             => $u['email'],
        'perfil'            => $u['perfil'],
        'deve_trocar_senha' => (bool) (int) $u['deve_trocar_senha'],
        'operador_id'       => $u['operador_id'] !== null ? (int) $u['operador_id'] : null,
    ];
}

/* ---------- Validação ---------- */

function texto($in, $campo, $rotulo, $min, $max, &$erros, $obrigatorio = true)
{
    $v = isset($in[$campo]) && !is_array($in[$campo]) ? trim(preg_replace('/\s+/u', ' ', (string) $in[$campo])) : '';
    if ($v === '') {
        if ($obrigatorio) {
            $erros[$campo] = 'Informe ' . $rotulo . '.';
        }
        return null;
    }
    $n = mb_strlen($v);
    if ($n < $min || $n > $max) {
        $erros[$campo] = sprintf('Use entre %d e %d caracteres.', $min, $max);
    }
    return $v;
}

function inteiro($in, $campo, $min, $max, &$erros, $mensagem)
{
    $v = $in[$campo] ?? null;
    if (is_int($v) || (is_string($v) && ctype_digit($v))) {
        $v = (int) $v;
        if ($v >= $min && $v <= $max) {
            return $v;
        }
    }
    $erros[$campo] = $mensagem;
    return null;
}

function data_valida($v)
{
    if (!is_string($v)) {
        return null;
    }
    $d = DateTime::createFromFormat('!Y-m-d', $v);
    return $d && $d->format('Y-m-d') === $v ? $v : null;
}

function normalizar_uid($v)
{
    $s = strtoupper(preg_replace('/[\s:\-]/', '', (string) $v));
    return preg_match('/^[0-9A-F]{8,20}$/', $s) ? $s : null;
}

function mascarar_uid($uid)
{
    return strlen($uid) <= 6 ? $uid : substr($uid, 0, 4) . '••••' . substr($uid, -2);
}

function normalizar_codigo($v)
{
    $s = strtoupper(trim((string) $v));
    return preg_match('/^[A-Z0-9][A-Z0-9\-]{0,19}$/', $s) ? $s : null;
}

function senha_forte($s)
{
    return mb_strlen($s) >= 8 && mb_strlen($s) <= 72 && preg_match('/[A-Za-z]/', $s) && preg_match('/\d/', $s);
}

function gerar_senha()
{
    $letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    $digitos = '23456789';
    $s = '';
    for ($i = 0; $i < 6; $i++) {
        $s .= $letras[random_int(0, strlen($letras) - 1)];
    }
    for ($i = 0; $i < 3; $i++) {
        $s .= $digitos[random_int(0, strlen($digitos) - 1)];
    }
    return $s . '@';
}

/* ---------- Datas ---------- */

function hoje()
{
    return date('Y-m-d');
}

function agora()
{
    return date('Y-m-d H:i:s');
}

function iso($dataHora)
{
    return $dataHora ? (new DateTime($dataHora))->format(DATE_ATOM) : null;
}

function data_br($data)
{
    return $data ? date('d/m/Y', strtotime($data)) : null;
}

function somar_meses($data, $meses)
{
    $d = new DateTime($data);
    $d->modify('+' . (int) $meses . ' months');
    return $d->format('Y-m-d');
}
