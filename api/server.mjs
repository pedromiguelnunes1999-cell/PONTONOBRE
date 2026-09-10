/**
 * API SMTP sem dependências (Node 18+).
 * Uso no servidor: node api/server.mjs
 * Variáveis: SMTP_PASS (obrigatória), PORT (default 8787)
 */
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

function loadConfig() {
  const configPath = join(__dirname, 'config.php');
  const envPass = process.env.SMTP_PASS || '';

  // Preferência: variáveis de ambiente (produção)
  if (envPass) {
    return {
      smtp_host: process.env.SMTP_HOST || 'mail.pontonobreeventos.pt',
      smtp_port: Number(process.env.SMTP_PORT || 465),
      smtp_user: process.env.SMTP_USER || 'geral@pontonobreeventos.pt',
      smtp_pass: envPass,
      to: process.env.SMTP_TO || 'geral@pontonobreeventos.pt',
      from_name: process.env.SMTP_FROM_NAME || 'Website Ponto Nobre Eventos'
    };
  }

  // Fallback local: ler api/config.php (apenas desenvolvimento)
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf8');
    const grab = (key) => {
      const match = raw.match(new RegExp(`'${key}'\\s*=>\\s*'((?:\\\\'|[^'])*)'`));
      return match ? match[1].replace(/\\'/g, "'") : '';
    };
    return {
      smtp_host: grab('smtp_host') || 'mail.pontonobreeventos.pt',
      smtp_port: Number(grab('smtp_port') || 465),
      smtp_user: grab('smtp_user'),
      smtp_pass: grab('smtp_pass'),
      to: grab('to') || grab('smtp_user'),
      from_name: grab('from_name') || 'Website Ponto Nobre Eventos'
    };
  }

  throw new Error('SMTP não configurado (SMTP_PASS ou api/config.php).');
}

function readSmtp(socket) {
  return new Promise((resolve, reject) => {
    let data = '';
    const onData = (chunk) => {
      data += chunk.toString('utf8');
      if (/\r?\n/.test(data) && data.split(/\r?\n/).filter(Boolean).some((line) => /^[0-9]{3} /.test(line))) {
        socket.off('data', onData);
        resolve(data);
      }
    };
    socket.on('data', onData);
    socket.on('error', reject);
    setTimeout(() => reject(new Error('Timeout SMTP')), 20000);
  });
}

async function command(socket, cmd, okCodes) {
  socket.write(cmd + '\r\n');
  const response = await readSmtp(socket);
  const code = Number(response.slice(0, 3));
  if (!okCodes.includes(code)) {
    throw new Error(response.trim() || `SMTP ${code}`);
  }
  return response;
}

async function sendMail(config, { subject, text, replyTo }) {
  const connect = () =>
    new Promise((resolve, reject) => {
      if (config.smtp_port === 465) {
        const socket = tls.connect({
          host: config.smtp_host,
          port: config.smtp_port,
          servername: config.smtp_host
        }, () => resolve(socket));
        socket.on('error', reject);
      } else {
        const socket = net.connect({ host: config.smtp_host, port: config.smtp_port }, () => resolve(socket));
        socket.on('error', reject);
      }
    });

  const socket = await connect();
  socket.setEncoding('utf8');

  await readSmtp(socket);
  await command(socket, 'EHLO pontonobreeventos.pt', [250]);

  if (config.smtp_port === 587) {
    await command(socket, 'STARTTLS', [220]);
    await new Promise((resolve, reject) => {
      socket.removeAllListeners('data');
      const secure = tls.connect({
        socket,
        servername: config.smtp_host
      }, () => resolve(secure));
      secure.on('error', reject);
    }).then((secure) => {
      Object.assign(socket, secure);
    });
    await command(socket, 'EHLO pontonobreeventos.pt', [250]);
  }

  await command(socket, 'AUTH LOGIN', [334]);
  await command(socket, Buffer.from(config.smtp_user).toString('base64'), [334]);
  await command(socket, Buffer.from(config.smtp_pass).toString('base64'), [235]);
  await command(socket, `MAIL FROM:<${config.smtp_user}>`, [250]);
  await command(socket, `RCPT TO:<${config.to}>`, [250, 251]);
  await command(socket, 'DATA', [354]);

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const fromName = config.from_name.replace(/"/g, '');
  const payload = [
    `From: "${fromName}" <${config.smtp_user}>`,
    `To: ${config.to}`,
    `Reply-To: ${replyTo || config.smtp_user}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '.'
  ].join('\r\n');

  await command(socket, payload, [250]);
  await command(socket, 'QUIT', [221]).catch(() => {});
  socket.end();
}

const config = loadConfig();

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = new Set([
    'https://pontonobreeventos.pt',
    'https://www.pontonobreeventos.pt',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost',
    'http://127.0.0.1'
  ]);

  if (allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.url !== '/api/send-orcamento' && req.url !== '/api/send-orcamento.php') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: 'Método não permitido.' }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

    if (data.botcheck) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    const message = String(data.message || '').trim();
    const email = String(data.email || '').trim();
    const name = String(data.name || data.nome || '').trim();
    const telefone = String(data.telefone || '').trim();

    if (!message && !email && !name && !telefone) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: 'Pedido incompleto.' }));
      return;
    }

    await sendMail(config, {
      subject: String(data.subject || 'Novo pedido de orçamento - Ponto Nobre Eventos'),
      text: message || `Nome: ${name}\nE-mail: ${email}\nTelefone: ${telefone}`,
      replyTo: email || config.smtp_user
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: 'Pedido enviado.' }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: String(error.message || error) }));
  }
});

server.listen(PORT, () => {
  console.log(`Ponto Nobre mail API on http://127.0.0.1:${PORT}`);
});
