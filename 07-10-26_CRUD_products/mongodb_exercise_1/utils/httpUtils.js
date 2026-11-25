/**
 * ============================================================================
 * utils/httpUtils.js
 * ----------------------------------------------------------------------------
 * Các hàm tiện ích dùng chung để gửi response HTTP.
 * Được nhiều tầng (controller, middleware) dùng lại.
 * ============================================================================
 */

// Gửi JSON kèm status code
function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
}

// Gửi response không có body (ví dụ 204 No Content)
function sendNoContent(res, status) {
    res.writeHead(status);
    res.end();
}

module.exports = { sendJson, sendNoContent };
