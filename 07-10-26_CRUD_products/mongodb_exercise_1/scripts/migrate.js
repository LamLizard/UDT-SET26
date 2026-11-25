/**
 * ============================================================================
 * scripts/migrate.js
 * ----------------------------------------------------------------------------
 * Chuyển dữ liệu từ file database.json sang MongoDB.
 *
 * Cách chạy:  npm run migrate
 *
 * Việc script làm:
 *   1. Đọc database.json (dạng { "products": [...] } hoặc mảng product)
 *   2. Xoá dữ liệu products cũ trong Mongo rồi insert toàn bộ từ file
 *   3. Đặt counters { _id: 'productId', seq: <id lớn nhất> }
 *      để product tạo mới không bao giờ trùng id đã có
 *
 * Script chạy lại nhiều lần được (kết quả cuối cùng vẫn khớp database.json).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const dataSource = require('../datasource/mongo-data-source');

const DATABASE_FILE = path.join(__dirname, '..', 'database.json');
const PRODUCT_COUNTER_ID = 'productId';

// Đọc file và chuẩn hoá thành mảng product {id, name, price}
function readDatabaseFile() {
    const raw = fs.readFileSync(DATABASE_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    const products = Array.isArray(parsed) ? parsed : parsed.products;

    if (!Array.isArray(products)) {
        throw new Error('database.json phải là mảng product hoặc object có field "products"');
    }

    return products.map((item, index) => {
        const id = Number(item.id);

        if (!Number.isInteger(id)) {
            throw new Error('Product thứ ' + (index + 1) + ' trong database.json có id không hợp lệ');
        }

        return {
            id: id,
            name: typeof item.name === 'string' ? item.name : '',
            price: typeof item.price === 'number' ? item.price : Number(item.price) || 0,
        };
    });
}

async function main() {
    const products = readDatabaseFile();
    console.log('Doc database.json: ' + products.length + ' product');

    await dataSource.connect();
    await dataSource.ensureIndexes();

    const collection = dataSource.products();

    // Xoá dữ liệu cũ để migrate lại từ đầu, tránh nhân đôi document
    const deleted = await collection.deleteMany({});
    console.log('Da xoa ' + deleted.deletedCount + ' document cu trong collection products');

    if (products.length > 0) {
        await collection.insertMany(products, { ordered: true });
        console.log('Da insert ' + products.length + ' product vao MongoDB');
    }

    // seq = id lớn nhất trong file -> id kế tiếp là max + 1
    const maxId = products.reduce((max, product) => Math.max(max, product.id), 0);

    await dataSource.counters().updateOne(
        { _id: PRODUCT_COUNTER_ID },
        { $set: { seq: maxId } },
        { upsert: true }
    );
    console.log('Da dat counters.' + PRODUCT_COUNTER_ID + '.seq = ' + maxId);

    const total = await collection.countDocuments();
    console.log('Kiem tra: collection products dang co ' + total + ' document');

    await dataSource.close();
}

main()
    .then(() => {
        console.log('Migrate xong.');
    })
    .catch(async (err) => {
        console.error('Migrate that bai:', err.message);
        await dataSource.close().catch(() => {});
        process.exitCode = 1;
    });
