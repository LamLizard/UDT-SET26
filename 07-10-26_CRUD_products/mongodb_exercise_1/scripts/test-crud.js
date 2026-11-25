/**
 * ============================================================================
 * scripts/test-crud.js
 * ----------------------------------------------------------------------------
 * Chạy test CRUD thật: bật server -> chạy kiem-tra-crud.js -> tắt server.
 *
 * Cách chạy:  npm test
 *
 * Dùng PORT riêng (3100) để không đụng server đang mở ở cổng 3000.
 * ============================================================================
 */

const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT) || 3100;

// Chờ server trả lời GET /products (tối đa ~15s)
function waitForServer(timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
        const attempt = () => {
            const req = http.get({ host: '127.0.0.1', port: PORT, path: '/products' }, (res) => {
                res.resume();
                resolve();
            });

            req.on('error', () => {
                if (Date.now() > deadline) {
                    reject(new Error('Server khong phan hoi sau ' + timeoutMs + 'ms'));
                    return;
                }
                setTimeout(attempt, 300);
            });
        };

        attempt();
    });
}

async function main() {
    const server = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverOutput = '';
    server.stdout.on('data', (chunk) => (serverOutput += chunk));
    server.stderr.on('data', (chunk) => (serverOutput += chunk));

    try {
        await waitForServer(15000);

        const result = spawnSync(process.execPath, ['kiem-tra-crud.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(PORT) },
            stdio: 'inherit',
        });

        process.exitCode = result.status === null ? 1 : result.status;
    } catch (err) {
        console.error('Khong chay duoc test:', err.message);
        console.error('Output cua server:\n' + serverOutput);
        process.exitCode = 1;
    } finally {
        server.kill();
    }
}

main();
