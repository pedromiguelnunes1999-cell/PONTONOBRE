<?php
/**
 * Envio autenticado de pedidos de orçamento via SMTP Domínios.pt / mailbox.pt.
 * Remetente = geral@pontonobreeventos.pt → entrega fiável no mesmo servidor de email.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
    'https://pontonobreeventos.pt',
    'https://www.pontonobreeventos.pt',
    'http://localhost',
    'http://127.0.0.1',
];

if ($origin !== '' && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido.']);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'API de email não configurada (falta api/config.php).',
    ]);
    exit;
}

/** @var array{smtp_host:string,smtp_port:int,smtp_user:string,smtp_pass:string,to:string,from_name:string} $config */
$config = require $configFile;

$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);

if (!is_array($data)) {
    $data = $_POST;
}

if (!empty($data['botcheck'])) {
    echo json_encode(['success' => true, 'message' => 'ok']);
    exit;
}

$nome = trim((string) ($data['name'] ?? $data['nome'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$telefone = trim((string) ($data['telefone'] ?? ''));
$mensagem = trim((string) ($data['message'] ?? ''));
$assunto = trim((string) ($data['subject'] ?? 'Novo pedido de orçamento - Ponto Nobre Eventos'));

if ($mensagem === '') {
    $linhas = [];
    foreach ($data as $chave => $valor) {
        if (in_array($chave, ['botcheck', 'access_key', 'subject', 'from_name', 'replyto'], true)) {
            continue;
        }
        if (is_scalar($valor)) {
            $linhas[] = $chave . ': ' . $valor;
        }
    }
    $mensagem = implode("\n", $linhas);
}

if ($nome === '' && $email === '' && $telefone === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Pedido incompleto.']);
    exit;
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'E-mail do cliente inválido.']);
    exit;
}

$to = $config['to'] ?? 'geral@pontonobreeventos.pt';
$from = $config['smtp_user'];
$fromName = $config['from_name'] ?? 'Website Ponto Nobre';

$bodyText = $mensagem;
$bodyHtml = '<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">'
    . htmlspecialchars($mensagem, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
    . '</pre>';

$boundary = 'bnd_' . bin2hex(random_bytes(8));
$headers = [
    'Date: ' . date('r'),
    'From: ' . encode_address($from, $fromName),
    'To: ' . $to,
    'Reply-To: ' . ($email !== '' ? $email : $from),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'X-Mailer: PontoNobre-Form/1.0',
];

$mime = '--' . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
    . quoted_printable_encode($bodyText) . "\r\n"
    . '--' . $boundary . "\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
    . quoted_printable_encode($bodyHtml) . "\r\n"
    . '--' . $boundary . "--\r\n";

try {
    smtp_send(
        $config['smtp_host'],
        (int) $config['smtp_port'],
        $config['smtp_user'],
        $config['smtp_pass'],
        $from,
        $to,
        $assunto,
        implode("\r\n", $headers),
        $mime
    );

    echo json_encode(['success' => true, 'message' => 'Pedido enviado.']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Falha no envio SMTP: ' . $e->getMessage(),
    ]);
}

function encode_address(string $email, string $name): string
{
    if ($name === '') {
        return $email;
    }

    return sprintf('"%s" <%s>', addcslashes($name, '"\\'), $email);
}

/**
 * @throws RuntimeException
 */
function smtp_send(
    string $host,
    int $port,
    string $user,
    string $pass,
    string $from,
    string $to,
    string $subject,
    string $headers,
    string $body
): void {
    $remote = ($port === 465 ? 'ssl://' : '') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT);

    if (!$fp) {
        throw new RuntimeException("Ligação SMTP falhou ({$errno}): {$errstr}");
    }

    stream_set_timeout($fp, 20);

    $expect = static function ($fp, array $codes) use ($host): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($data, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new RuntimeException(trim($data) !== '' ? trim($data) : "Resposta SMTP inválida de {$host}");
        }
        return $data;
    };

    $command = static function ($fp, string $cmd, array $codes) use ($expect): string {
        fwrite($fp, $cmd . "\r\n");
        return $expect($fp, $codes);
    };

    $expect($fp, [220]);
    $command($fp, 'EHLO pontonobreeventos.pt', [250]);

    if ($port === 587) {
        $command($fp, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('Não foi possível iniciar TLS.');
        }
        $command($fp, 'EHLO pontonobreeventos.pt', [250]);
    }

    $command($fp, 'AUTH LOGIN', [334]);
    $command($fp, base64_encode($user), [334]);
    $command($fp, base64_encode($pass), [235]);
    $command($fp, 'MAIL FROM:<' . $from . '>', [250]);
    $command($fp, 'RCPT TO:<' . $to . '>', [250, 251]);
    $command($fp, 'DATA', [354]);

    $subjectHeader = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';
    $payload = $headers . "\r\n" . $subjectHeader . "\r\n\r\n" . $body;
    $payload = preg_replace("/\r\n\./", "\r\n..", $payload) ?? $payload;

    fwrite($fp, $payload . "\r\n.\r\n");
    $expect($fp, [250]);
    $command($fp, 'QUIT', [221]);
    fclose($fp);
}
