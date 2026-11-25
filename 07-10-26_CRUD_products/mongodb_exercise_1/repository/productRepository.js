/**
 * ============================================================================
 * repository/productRepository.js
 * ----------------------------------------------------------------------------
 * Tầng REPOSITORY (CRUD trên collection products của MongoDB).
 *
 * Nhiệm vụ:
 *   - Dịch giữa "document Mongo" và "object product" (domain)
 *   - Cung cấp thao tác thêm/đọc/sửa/xoá cho controller
 *   - Cấp id kiểu số bằng collection counters (không tái dùng id đã xoá)
 *   - Ẩn _id của Mongo khỏi mọi kết quả trả về (projection { _id: 0 })
 *
 * Vì driver MongoDB là async nên mọi hàm ở đây đều async.
 * Không biết gì về HTTP (status code, request/response).
 * ============================================================================
 */

const dataSource = require('../datasource/mongo-data-source');

// Không trả _id (ObjectId nội bộ của Mongo) ra ngoài
const HIDE_ID = { projection: { _id: 0 } };

// Bộ đếm id của product trong collection counters
const PRODUCT_COUNTER_ID = 'productId';

// Field được phép ghi vào document
const FIELDS = ['name', 'price'];

// Document Mongo -> object product (bỏ _id, id về kiểu Number)
function toProduct(doc) {
    if (!doc) return undefined;

    const product = { id: Number(doc.id) };
    if ('name' in doc) product.name = doc.name;
    if ('price' in doc) product.price = doc.price;

    return product;
}

// Lấy id kế tiếp từ counters: $inc seq + 1, tạo document nếu chưa có
async function nextId() {
    const counter = await dataSource.counters().findOneAndUpdate(
        { _id: PRODUCT_COUNTER_ID },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
    );

    return counter.seq;
}

// Tất cả product, sắp theo id tăng dần (limit = undefined -> lấy hết)
async function findAll(limit) {
    let cursor = dataSource.products().find({}, HIDE_ID).sort({ id: 1 });

    if (typeof limit === 'number') {
        cursor = cursor.limit(limit);
    }

    const docs = await cursor.toArray();
    return docs.map(toProduct);
}

// 1 product theo id (undefined nếu không có hoặc id không phải số nguyên)
async function findById(id) {
    if (!Number.isInteger(id)) return undefined;

    const doc = await dataSource.products().findOne({ id: id }, HIDE_ID);
    return toProduct(doc);
}

// Thêm product mới, id do server cấp từ counters
async function create(fields) {
    const product = {
        id: await nextId(),
        name: typeof fields.name === 'string' ? fields.name : '',
        price: typeof fields.price === 'number' ? fields.price : 0,
    };

    await dataSource.products().insertOne({ ...product });

    return product;
}

// Thay CẢ record theo id (chỉ giữ field được gửi lên), null nếu không có id
async function replace(id, fields) {
    if (!Number.isInteger(id)) return null;

    // Id luôn giữ nguyên id cũ, không lấy id trong body.
    const record = { id: id };
    for (const field of FIELDS) {
        if (field in fields) record[field] = fields[field];
    }

    const result = await dataSource.products().replaceOne({ id: id }, record);

    if (result.matchedCount === 0) return null;

    return record;
}

// Chỉ sửa field được gửi lên, null nếu không có id
async function update(id, fields) {
    if (!Number.isInteger(id)) return null;

    // Field không gửi thì giữ nguyên giá trị cũ.
    const changes = {};
    for (const field of FIELDS) {
        if (field in fields) changes[field] = fields[field];
    }

    // Không có field nào để sửa -> trả lại document hiện tại
    if (Object.keys(changes).length === 0) {
        return findById(id);
    }

    const doc = await dataSource.products().findOneAndUpdate(
        { id: id },
        { $set: changes },
        { returnDocument: 'after', ...HIDE_ID }
    );

    return toProduct(doc);
}

// Xoá product theo id, trả về true/false
async function remove(id) {
    if (!Number.isInteger(id)) return false;

    const result = await dataSource.products().deleteOne({ id: id });
    return result.deletedCount > 0;
}

module.exports = { findAll, findById, create, replace, update, remove };
