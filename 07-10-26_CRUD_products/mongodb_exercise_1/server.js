/**
 * ============================================================================
 * server.js
 * ----------------------------------------------------------------------------
 * Điểm khởi động server.
 *   1. Kết nối MongoDB xong mới được listen (nếu DB chết thì báo lỗi, không chạy nửa vời)
 *   2. Tạo HTTP server và đẩy mọi request vào router
 *
 * Toàn bộ logic nghiệp vụ đã được tách ra các tầng:
 *   router -> controller -> repository -> datasource (MongoDB)
 * ============================================================================
 */

const http = require('http');
const router = require('./router');
const dataSource = require('./datasource/mongo-data-source');
const { sendJson } = require('./utils/httpUtils');

// datasource đã load .env -> đọc PORT sau khi require là an toàn
const PORT = Number(process.env.PORT) || 3000;

async function start() {
    // Phải await connect() trước khi listen
    await dataSource.connect();
    await dataSource.ensureIndexes();

    const server = http.createServer((req, res) => {
        // router.handle là async -> bắt lỗi để server không bị sập
        router.handle(req, res).catch((err) => {
            console.error('Loi xu ly request:', err.message);
            sendJson(res, 500, { error: 'Lỗi server' });
        });
    });

    server.listen(PORT, () => {
        console.log('Server dang chay tai http://localhost:' + PORT);
    });

    // Tắt server: đóng socket rồi đóng kết nối Mongo
    async function shutdown(signal) {
        console.log('\nNhan ' + signal + ', dang tat server...');
        server.close(async () => {
            await dataSource.close();
            process.exit(0);
        });
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
}

start().catch(async (err) => {
    console.error('Khong khoi dong duoc server:', err.message);
    await dataSource.close().catch(() => {});
    process.exit(1);
});

module.exports = { start, PORT };
