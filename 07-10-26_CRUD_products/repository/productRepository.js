/**
 * ============================================================================
 * repository/productRepository.js
 * ----------------------------------------------------------------------------
 * Tầng REPOSITORY (CRUD trên dữ liệu product).
 *
 * Nhiệm vụ:
 *   - Dịch giữa "mảng ô trong file" (datasource) và "object product" (domain)
 *   - Cung cấp các thao tác thêm/đọc/sửa/xoá cho controller
 *   - Ô trống trong file coi như field không tồn tại (undefined),
 *     ví dụ PUT chỉ gửi price
 *
 * Không biết gì về HTTP (status code, request/response).
 * ============================================================================
 */

const dataSource = require('../datasource/productDataSource');

// Dữ liệu mẫu khi file chưa tồn tại
const SEED_ROWS = [
    [1, 'Bàn phím', 300],
    [2, 'Chuột', 150],
    [3, 'Màn hình', 2000],
];

// Mảng ô trong file -> object product
function toProduct([id, name, price]) {
    return {
        id: Number(id),
        name: name === '' ? undefined : name,
        price: price === '' ? undefined : Number(price),
    };
}

// object product -> mảng ô để ghi xuống file
function toRow(product) {
    return [product.id, product.name, product.price];
}

// Id kế tiếp = id lớn nhất đang có + 1 (tính từ file nên không cấp lại id đã xoá)
function getNextId(products) {
    if (products.length === 0) return 1;

    return Math.max(...products.map((p) => p.id)) + 1;
}

// Ghi toàn bộ danh sách xuống file
function save(products) {
    dataSource.writeRows(products.map(toRow));
}

// Tất cả product
function findAll() {
    return dataSource.readRows().map(toProduct);
}

// 1 product theo id (undefined nếu không có)
function findById(id) {
    return findAll().find((p) => p.id === id);
}

// Thêm product mới, id do server cấp
function create(fields) {
    const products = findAll();

    const product = {
        id: getNextId(products),
        name: typeof fields.name === 'string' ? fields.name : '',
        price: typeof fields.price === 'number' ? fields.price : 0,
    };

    products.push(product); // thêm vào cuối danh sách
    save(products);

    return product;
}

// Thay CẢ record theo id (chỉ giữ lại các field được gửi lên), null nếu không có id
function replace(id, fields) {
    const products = findAll();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) return null;

    // Id luôn giữ nguyên id cũ, không lấy id trong body.
    const record = { id: id };
    if ('name' in fields) {
        record.name = fields.name;
    }
    if ('price' in fields) {
        record.price = fields.price;
    }

    products[index] = record;
    save(products);

    return record;
}

// Chỉ sửa field được gửi lên, null nếu không có id
function update(id, fields) {
    const products = findAll();
    const product = products.find((p) => p.id === id);

    if (!product) return null;

    // Field không gửi thì giữ nguyên giá trị cũ.
    if ('name' in fields) {
        product.name = fields.name;
    }
    if ('price' in fields) {
        product.price = fields.price;
    }

    save(products);

    return product;
}

// Xoá product theo id, trả về true/false
function remove(id) {
    const products = findAll();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) return false;

    products.splice(index, 1); // xoá 1 phần tử tại vị trí index
    save(products);

    return true;
}

// Tạo file + dữ liệu mẫu nếu chưa có (gọi 1 lần lúc khởi động)
function ensureSeeded() {
    dataSource.ensureExists(SEED_ROWS);
}

module.exports = { findAll, findById, create, replace, update, remove, ensureSeeded };
