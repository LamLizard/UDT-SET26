/**
 * ============================================================================
 * middleware/jsonBody.js
 * ----------------------------------------------------------------------------
 * Middleware đọc body của request và parse JSON.
 *
 * Kết quả trả về:
 *   { ok: true,  data: <object> }  - body là JSON object hợp lệ
 *   { ok: false, raw: <string> }   - body rỗng / sai cú pháp / không phải object
 *
 * Controller dựa vào "ok" để quyết định trả 400 hay tiếp tục xử lý.
 * ============================================================================
 */

function parseJsonBody(req) {
    return new Promise((resolve) => {
        let raw = '';

        req.on('data', (chunk) => {
            raw += chunk;
        });

        req.on('end', () => {
            // Body rỗng -> coi như sai
            if (raw.trim() === '') {
                resolve({ ok: false, raw: raw });
                return;
            }

            try {
                const data = JSON.parse(raw);
                if (data === null || typeof data !== 'object' || Array.isArray(data)) {
                    resolve({ ok: false, raw: raw });
                    return;
                }

                resolve({ ok: true, data: data });
            } catch (err) {
                resolve({ ok: false, raw: raw });
            }
        });

        req.on('error', () => {
            resolve({ ok: false, raw: raw });
        });
    });
}

module.exports = { parseJsonBody };
