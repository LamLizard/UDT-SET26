/**
 * ============================================================================
 * middleware/errorHandler.js
 * ----------------------------------------------------------------------------
 * Gom các response lỗi về một chỗ để controller không phải lặp lại.
 * ============================================================================
 */

const { sendJson } = require('../utils/httpUtils');

// 404 - không tìm thấy tài nguyên / route
function notFound(res, message) {
    sendJson(res, 404, { error: message });
}

// 400 - client gửi dữ liệu sai
function badRequest(res, message) {
    sendJson(res, 400, { error: message });
}

module.exports = { notFound, badRequest };
