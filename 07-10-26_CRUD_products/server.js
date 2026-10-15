/**
 * ============================================================================
 * server.js
 * ----------------------------------------------------------------------------
 * Điểm khởi động server. Chỉ còn 2 việc:
 *   1. Tạo HTTP server và đẩy mọi request vào router
 *   2. Đảm bảo file dữ liệu đã tồn tại rồi lắng nghe cổng PORT
 *
 * Toàn bộ logic nghiệp vụ đã được tách ra các tầng:
 *   router -> controller -> repository -> datasource
 * (kèm middleware và utils dùng chung)
 * ============================================================================
 */

const http = require('http');
const router = require('./router');
const repository = require('./repository/productRepository');
const { sendJson } = require('./utils/httpUtils');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // router.handle là async -> bắt lỗi để server không bị sập
    router.handle(req, res).catch(() => {
        sendJson(res, 500, { error: 'Lỗi server' });
    });
});

// Chạy 1 lần lúc khởi động để chắc chắn products.csv đã tồn tại
repository.ensureSeeded();

server.listen(PORT, () => {
    console.log('Server dang chay tai http://localhost:' + PORT);
});
