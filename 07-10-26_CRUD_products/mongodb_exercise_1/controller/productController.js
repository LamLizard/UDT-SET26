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
 * Khác bản đọc file CSV: repository giờ là async (MongoDB), nên các hàm ở đây
 * thành async và await repository. Route, status code, validate và ?limit
 * KHÔNG đổi so với bài n-layer cũ.
 * ============================================================================
 */

const repository = require('../repository/productRepository');
const { sendJson, sendNoContent } = require('../utils/httpUtils');
const { notFound, badRequest } = require('../middleware/errorHandler');

const INVALID_BODY = 'Body phải là JSON object hợp lệ';

/**
 * Đọc ?limit và trả về:
 *   { ok: true,  limit: <number|undefined> }  - không gửi, hoặc số nguyên >= 0
 *   { ok: false }                             - gửi sai kiểu
 */
function readLimit(url) {
    const rawLimit = url.searchParams.get('limit');

    if (rawLimit === null) return { ok: true, limit: undefined };

    const limit = Number(rawLimit);

    // limit phải là số nguyên >= 0, ngược lại coi là client gửi sai -> 400
    if (!Number.isInteger(limit) || limit < 0) return { ok: false };

    return { ok: true, limit: limit };
}

// GET /products (?limit=N để lấy N sản phẩm đầu)
async function list(req, res, url) {
    const parsed = readLimit(url);

    if (!parsed.ok) {
        badRequest(res, 'Query limit phải là số nguyên >= 0');
        return;
    }

    // Repository đã sắp theo id tăng dần; limit = undefined -> lấy hết
    const products = await repository.findAll(parsed.limit);

    sendJson(res, 200, products);
}

// GET /products/:id
async function getOne(req, res, id, rawId) {
    const product = await repository.findById(id);

    if (product === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    sendJson(res, 200, product);
}

// POST /products - nhận {name, price}, id do server cấp -> 201
async function create(req, res, body) {
    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const product = await repository.create(body.data);

    sendJson(res, 201, product); // 201 = Created, trả về product vừa tạo
}

// PUT /products/:id - thay CẢ record, 404 nếu không có id
async function replace(req, res, id, rawId, body) {
    // Luôn kiểm tồn tại trước khi xử lý body (đúng như hành vi cũ)
    if ((await repository.findById(id)) === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const record = await repository.replace(id, body.data);

    // Phòng trường hợp record vừa bị xoá giữa 2 bước -> vẫn là 404
    if (record === null) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    sendJson(res, 200, record);
}

// PATCH /products/:id - chỉ sửa field gửi lên, 404 nếu không có id
async function update(req, res, id, rawId, body) {
    if ((await repository.findById(id)) === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    if (!body.ok) {
        badRequest(res, INVALID_BODY);
        return;
    }

    const product = await repository.update(id, body.data);

    if (product === null || product === undefined) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    sendJson(res, 200, product);
}

// DELETE /products/:id - xoá sản phẩm, 404 nếu không có id -> 204 (không body)
async function remove(req, res, id, rawId) {
    const deleted = await repository.remove(id);

    if (!deleted) {
        notFound(res, 'Không tìm thấy product id = ' + rawId);
        return;
    }

    // 204 = No Content. Không trả body.
    sendNoContent(res, 204);
}

module.exports = { list, getOne, create, replace, update, remove };
