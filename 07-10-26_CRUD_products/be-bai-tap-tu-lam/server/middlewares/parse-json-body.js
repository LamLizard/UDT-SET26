const { sendJson, readBody } = require('../http-utils');

async function parseJsonBody(req, res) {
  const body = await readBody(req);
  if (body === undefined) {
    sendJson(res, 400, { message: 'Body không phải JSON hợp lệ' });
    return false;
  }
  req.body = body;
  return true;
}

module.exports = parseJsonBody;
