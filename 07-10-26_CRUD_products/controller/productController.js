/**
 * ============================================================================
 * controller/productController.js
 * ----------------------------------------------------------------------------
 * Tầng CONTROLLER: xử lý request HTTP cho tài nguyên "products".
 *
 * Nhiệm vụ:
 *   - Đọc input từ request (query, id, body)
 *   - Gọi repository để lấy/ghi dữ liệu
 *   - Quyết định status code và dữ liệu trả về
 *
 * Controller KHÔNG đọc file trực tiếp, chỉ nói chuyện với repository.
 * ============================================================================
 */

const repository = require('../repository/productRepository');
const { sendJson, sendNoContent } = require('../utils/httpUtils');
const { notFound, badRequest } = require('../middleware/errorHandler');

const INVALID_BODY = 'Body phải là JSON object hợp lệ';

// GET /products (?limit=N để lấy N sản phẩm đầu)
function list(req, res, url) {
    const products = repository.findAll();

    const rawLimit = url.searchParams.get('limit');

    if (rawLimit === null) {
        sendJson(res, 200, products);
        return;
    }

    const limit = Number(rawLimit);

    // limit phải là số nguyên >= 0, ngược lại coi là client gửi sai -> 400
    if (!Number.isInteger(limit) || limit < 0) {
        badRequest(res, 'Query limit phải là số nguyên >= 0');
        return;
    }

    // slice(0, N) lấy N phần tử đầu. slice KHÔNG sửa mảng gốc.
    sendJson(res, 200, products.slice(0, limit));
}

// GET /products/:id
function getOne(req, res, id, rawId) {
    const product = repository.findById(id);

    if (product === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    sendJson(res, 200, product);
}

// POST /products - nhận {name, price}, id do server cấp -> 201
function create(req, res, body) {
    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const product = repository.create(body.data);

    sendJson(res, 201, product); // 201 = Created, trả về product vừa tạo
}

// PUT /products/:id - thay CẢ record, 404 nếu không có id
function replace(req, res, id, rawId, body) {
    // Luôn kiểm tồn tại trước khi xử lý body (đúng như hành vi cũ)
    if (repository.findById(id) === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const record = repository.replace(id, body.data);

    sendJson(res, 200, record);
}

// PATCH /products/:id - chỉ sửa field gửi lên, 404 nếu không có id
function update(req, res, id, rawId, body) {
    if (repository.findById(id) === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const product = repository.update(id, body.data);

    sendJson(res, 200, product);
}

// DELETE /products/:id - xoá sản phẩm, 404 nếu không có id -> 204 (không body)
function remove(req, res, id, rawId) {
    const deleted = repository.remove(id);

    if (!deleted) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    // 204 = No Content. Không trả body.
    sendNoContent(res, 204);
}

module.exports = { list, getOne, create, replace, update, remove };
