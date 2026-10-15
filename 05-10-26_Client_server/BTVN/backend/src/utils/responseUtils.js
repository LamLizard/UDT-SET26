// An error that is safe to show to the client (status code + message).
class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function sendOk(res, message, data, statusCode = 200) {
  sendJson(res, statusCode, { status: 'OK', message, data });
}

function sendError(res, statusCode, message, extra = {}) {
  sendJson(res, statusCode, { status: 'ERROR', message, ...extra });
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  });
  res.end(html);
}

module.exports = { HttpError, sendJson, sendOk, sendError, sendHtml };
