'use strict';

const TOKEN = 'demo-token';

class InvalidJsonBodyError extends Error {}

function sendJSON(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

function sendError(response, statusCode, message) {
  sendJSON(response, statusCode, { error: message });
}

function sendNoContent(response) {
  response.statusCode = 204;
  response.end();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new InvalidJsonBodyError('Body không phải JSON hợp lệ'));
      }
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

function isValidBodyObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function logRequest(request, response) {
  console.log(`--> ${request.method} ${request.url}`);
}

function checkToken(request, response) {
  const authorizationHeader = request.headers.authorization;
  const expectedHeader = `Bearer ${TOKEN}`;

  if (authorizationHeader !== expectedHeader) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    sendError(response, 401, 'Thiếu hoặc sai token. Cần gửi header Authorization: Bearer demo-token');
    return false;
  }

  return true;
}

module.exports = {
  logRequest,
  checkToken,
  sendJSON,
  sendError,
  sendNoContent,
  readJsonBody,
  isValidBodyObject,
  InvalidJsonBodyError
};
