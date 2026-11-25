/**
 * ============================================================================
 * router/productRouter.js
 * ----------------------------------------------------------------------------
 * Tầng ROUTER cho tài nguyên "products".
 *
 * Nhiệm vụ:
 *   - Ghép (method + số lượng segment) với đúng hàm controller
 *   - Đọc body qua middleware trước khi gọi controller (POST/PUT/PATCH)
 *
 * Router KHÔNG chứa logic nghiệp vụ, chỉ điều phối.
 * ============================================================================
 */

const productController = require('../controller/productController');
const { parseJsonBody } = require('../middleware/jsonBody');
const { notFound } = require('../middleware/errorHandler');

// segments: mảng các phần của path sau khi đã xác định là route "products"
// ví dụ: ['products'] hoặc ['products', '3']
async function handle(req, res, url, segments) {
    const method = req.method;

    const isCollection = segments.length === 1; // /products
    const isItem = segments.length === 2;       // /products/:id

    if (isCollection) {
        // GET /products
        if (method === 'GET') {
            return productController.list(req, res, url);
        }

        // POST /products
        if (method === 'POST') {
            const body = await parseJsonBody(req);
            return productController.create(req, res, body);
        }

        // Method khác trên /products (PUT, DELETE...) -> không có route -> 404
        return notFound(res, 'Route không tồn tại');
    }

    if (isItem) {
        const rawId = segments[1];
        const id = Number(rawId);

        // GET /products/:id
        if (method === 'GET') {
            return productController.getOne(req, res, id, rawId);
        }

        // PUT /products/:id
        if (method === 'PUT') {
            const body = await parseJsonBody(req);
            return productController.replace(req, res, id, rawId, body);
        }

        // PATCH /products/:id
        if (method === 'PATCH') {
            const body = await parseJsonBody(req);
            return productController.update(req, res, id, rawId, body);
        }

        // DELETE /products/:id
        if (method === 'DELETE') {
            return productController.remove(req, res, id, rawId);
        }

        // Method khác (POST trên /products/:id...) -> không có route -> 404
        return notFound(res, 'Route không tồn tại');
    }

    // /products/... với quá nhiều segment -> không có route
    return notFound(res, 'Route không tồn tại');
}

module.exports = { handle };
