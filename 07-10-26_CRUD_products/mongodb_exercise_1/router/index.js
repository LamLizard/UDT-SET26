/**
 * ============================================================================
 * router/index.js
 * ----------------------------------------------------------------------------
 * Router gốc: điều hướng request theo tiền tố tài nguyên.
 *
 * Hiện tại chỉ có tài nguyên "products" -> giao cho productRouter.
 * Sau này thêm tài nguyên mới (ví dụ "orders") chỉ cần thêm nhánh ở đây.
 * ============================================================================
 */

const productRouter = require('./productRouter');
const { notFound } = require('../middleware/errorHandler');

async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const segments = pathname.split('/').filter((s) => s !== '');

    // Điều hướng theo tiền tố tài nguyên
    if (segments[0] === 'products') {
        return productRouter.handle(req, res, url, segments);
    }

    // Mọi route còn lại -> 404
    return notFound(res, 'Route không tồn tại: ' + req.method + ' ' + pathname);
}

module.exports = { handle };
