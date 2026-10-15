/**
 * ============================================================================
 * datasource/productDataSource.js
 * ----------------------------------------------------------------------------
 * Tầng TRUY CẬP VẬT LÝ tới nơi lưu dữ liệu (file products.csv).
 *
 * Nhiệm vụ:
 *   - Đọc/ghi file CSV thô (mảng các dòng, mỗi dòng là mảng các ô chuỗi)
 *   - Không biết gì về "product" hay HTTP, chỉ lo định dạng file
 *
 * Tầng repository ở trên sẽ dịch mảng ô <-> object product.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '..', 'products.csv');
const HEADER = 'id, name, price';

// Đọc file và trả về mảng các dòng dữ liệu (đã tách ô, đã bỏ dòng tiêu đề)
function readRows() {
    if (!fs.existsSync(PRODUCTS_FILE)) return [];

    const lines = fs
        .readFileSync(PRODUCTS_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');

    // Bỏ dòng tiêu đề (id, name, price), phần còn lại là dữ liệu
    return lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));
}

// Ghi mảng các dòng xuống file (tạo file nếu chưa có)
function writeRows(rows) {
    const cell = (value) => (value === undefined || value === null ? '' : value);

    const content =
        HEADER + '\n' +
        rows.map((cells) => cells.map(cell).join(', ')).join('\n') +
        '\n';

    fs.writeFileSync(PRODUCTS_FILE, content);
}

// Chưa có file (hoặc file rỗng) thì tạo mới với dữ liệu mẫu
function ensureExists(seedRows) {
    if (fs.existsSync(PRODUCTS_FILE) && fs.statSync(PRODUCTS_FILE).size > 0) return;

    writeRows(seedRows);
}

module.exports = { PRODUCTS_FILE, readRows, writeRows, ensureExists };
