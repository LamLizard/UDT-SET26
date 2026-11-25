/**
 * ============================================================================
 * datasource/mongo-data-source.js
 * ----------------------------------------------------------------------------
 * Tầng TRUY CẬP VẬT LÝ tới MongoDB (thay cho productDataSource.js đọc file CSV).
 *
 * Nhiệm vụ:
 *   - Giữ 1 MongoClient duy nhất cho cả app (singleton)
 *   - Đọc cấu hình kết nối từ .env: MONGODB_URI, MONGODB_DB
 *   - Cấp collection thô cho tầng repository
 *   - Không biết gì về "product", HTTP hay status code
 *
 * API: connect(), getDb(), getCollection(name), products(), counters(),
 *      ensureIndexes(), close()
 * ============================================================================
 */

const path = require('path');

// Load .env ở gốc project, không phụ thuộc thư mục đang đứng khi chạy
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');

// Tên collection dùng trong database
const COLLECTIONS = Object.freeze({
    PRODUCTS: 'products',
    COUNTERS: 'counters', // bộ đếm id, ví dụ { _id: 'productId', seq: 12 }
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'express-exercise1';

let client = null;
let db = null;

/**
 * Tạo MongoClient và kết nối. Gọi nhiều lần cũng chỉ mở 1 kết nối.
 */
async function connect({ uri = MONGODB_URI, dbName = MONGODB_DB } = {}) {
    if (db) return db;

    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(dbName);

    console.log('Da ket noi MongoDB: db = ' + dbName);
    return db;
}

/**
 * Lấy database đang kết nối. Gọi trước connect() -> báo lỗi rõ ràng.
 */
function getDb() {
    if (!db) {
        throw new Error('MongoDB chua duoc ket noi. Goi connect() truoc khi dung collection.');
    }
    return db;
}

function getCollection(name) {
    return getDb().collection(name);
}

const products = () => getCollection(COLLECTIONS.PRODUCTS);
const counters = () => getCollection(COLLECTIONS.COUNTERS);

/**
 * Bảo đảm collection products có index cho field id.
 * id do counters cấp nên phải là duy nhất (unique) để không bao giờ trùng.
 */
async function ensureIndexes() {
    await products().createIndex({ id: 1 }, { unique: true, name: 'uniq_product_id' });
}

/**
 * Đóng kết nối (dùng khi tắt server hoặc kết thúc script migrate/test).
 */
async function close() {
    if (client) {
        await client.close();
    }
    client = null;
    db = null;
}

module.exports = {
    COLLECTIONS,
    MONGODB_URI,
    MONGODB_DB,
    connect,
    getDb,
    getCollection,
    products,
    counters,
    ensureIndexes,
    close,
};
