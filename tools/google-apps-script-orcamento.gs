/**
 * Ponto Nobre Eventos — reencaminhamento de pedidos de orçamento
 * ----------------------------------------------------------------
 * 1. Abrir https://script.google.com
 * 2. Novo projeto → colar este ficheiro
 * 3. Deploy → Novo deployment → Tipo: Aplicação Web
 *    - Executar como: Eu
 *    - Quem tem acesso: Qualquer pessoa
 * 4. Copiar o URL do deployment e enviar ao programador
 *    (ou colar em script.js → CONFIG.googleScriptUrl)
 */

var DESTINO = 'geral@pontonobreeventos.pt';
var ASSUNTO_DEFAULT = 'Novo pedido de orçamento - Ponto Nobre Eventos';

function doPost(e) {
  try {
    var data = {};

    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents || '{}');
    } else if (e.parameter) {
      data = e.parameter;
    }

    if (data.botcheck === true || data.botcheck === 'true' || data.botcheck === 'on') {
      return json_({ success: true, skipped: true });
    }

    var nome = str_(data.name || data.nome);
    var email = str_(data.email);
    var mensagem = str_(data.message);
    var telefone = str_(data.telefone);
    var assunto = str_(data.subject) || ASSUNTO_DEFAULT;

    if (!mensagem) {
      mensagem = [
        'Nome: ' + nome,
        'E-mail: ' + email,
        'Telefone: ' + telefone,
        '',
        JSON.stringify(data, null, 2)
      ].join('\n');
    }

    if (!email && !nome && !telefone) {
      return json_({ success: false, message: 'Pedido vazio.' }, 400);
    }

    MailApp.sendEmail({
      to: DESTINO,
      subject: assunto,
      replyTo: email || DESTINO,
      name: nome ? (nome + ' via Website') : 'Website Ponto Nobre',
      body: mensagem,
      htmlBody: htmlBody_(data, mensagem)
    });

    return json_({ success: true, message: 'Pedido enviado.' });
  } catch (err) {
    return json_({ success: false, message: String(err) }, 500);
  }
}

function doGet() {
  return json_({
    success: true,
    service: 'Ponto Nobre — pedidos de orçamento',
    status: 'ok'
  });
}

function str_(value) {
  return value == null ? '' : String(value).trim();
}

function htmlBody_(data, mensagem) {
  var rows = Object.keys(data)
    .filter(function (key) {
      return ['access_key', 'botcheck', 'message', 'subject', 'from_name', 'replyto'].indexOf(key) === -1;
    })
    .map(function (key) {
      return (
        '<tr><td style="padding:8px;border:1px solid #e8e4de;font-weight:600;">' +
        escape_(key) +
        '</td><td style="padding:8px;border:1px solid #e8e4de;">' +
        escape_(data[key]) +
        '</td></tr>'
      );
    })
    .join('');

  return (
    '<div style="font-family:Arial,sans-serif;color:#1c1c1c;">' +
    '<h2 style="color:#9a7b52;">Novo pedido de orçamento</h2>' +
    '<table style="border-collapse:collapse;width:100%;max-width:640px;">' +
    rows +
    '</table>' +
    '<pre style="margin-top:24px;white-space:pre-wrap;background:#f5f2ec;padding:16px;border-radius:8px;">' +
    escape_(mensagem) +
    '</pre></div>'
  );
}

function escape_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json_(payload, status) {
  var output = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
  return output;
}
