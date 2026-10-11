const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const PRODUCTS_FILE = path.join(__dirname, 'products.csv');

function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
}

function sendNoContent(res, status) {
    res.writeHead(status);
    res.end();
}

function readJsonBody(req) {
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

// Đọc products.csv và trả về danh sách sản phẩm {id, name, price}
// Ô trống trong file coi như field không tồn tại (undefined), ví dụ PUT chỉ gửi price
function readProducts() {
    if (!fs.existsSync(PRODUCTS_FILE)) return [];

    const lines = fs
        .readFileSync(PRODUCTS_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');

    // Bỏ dòng tiêu đề (id, name, price), phần còn lại là dữ liệu
    return lines.slice(1).map((line) => {
        const [id, name, price] = line.split(',').map((part) => part.trim());

        return {
            id: Number(id),
            name: name === '' ? undefined : name,
            price: price === '' ? undefined : Number(price),
        };
    });
}

// Ghi danh sách sản phẩm xuống products.csv (tạo file nếu chưa có)
function writeProducts(products) {
    const cell = (value) => (value === undefined ? '' : value);

    const content =
        'id, name, price\n' +
        products.map((p) => `${cell(p.id)}, ${cell(p.name)}, ${cell(p.price)}`).join('\n') +
        '\n';

    fs.writeFileSync(PRODUCTS_FILE, content);
}

// Id kế tiếp = id lớn nhất đang có trong file + 1
// Tính từ file nên server khởi động lại vẫn không cấp lại id đã xoá
function getNextId(products) {
    if (products.length === 0) return 1;

    return Math.max(...products.map((p) => p.id)) + 1;
}

// Chưa có file (hoặc file rỗng) thì tạo mới kèm dòng tiêu đề và vài sản phẩm mẫu
function ensureProductsFile() {
    if (fs.existsSync(PRODUCTS_FILE) && fs.statSync(PRODUCTS_FILE).size > 0) return;

    writeProducts([
        { id: 1, name: 'Bàn phím', price: 300 },
        { id: 2, name: 'Chuột', price: 150 },
        { id: 3, name: 'Màn hình', price: 2000 },
    ]);
}

// Tìm sản phẩm theo id (undefined nếu không có)
function findById(products, id) {
    return products.find((p) => p.id === id);
}

// Tìm vị trí sản phẩm theo id (-1 nếu không có)
function findIndexById(products, id) {
    return products.findIndex((p) => p.id === id);
}

const server = http.createServer(async (req, res) => {
    const method = req.method;

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const segments = pathname.split('/').filter((s) => s !== '');

    const isCollection = segments.length === 1 && segments[0] === 'products'; // /products
    const isItem = segments.length === 2 && segments[0] === 'products';       // /products/:id

    if (isCollection) {
        // Đọc lại products.csv mỗi request -> file là nguồn dữ liệu duy nhất
        const products = readProducts();

        // GET /products: trả về danh sách (?limit=N để lấy N sản phẩm đầu)
        if (method === 'GET') {
            const rawLimit = url.searchParams.get('limit');

            if (rawLimit === null) {
                sendJson(res, 200, products);
                return; 
            }
            const limit = Number(rawLimit);

            // limit phải là số nguyên >= 0, ngược lại coi là client gửi sai -> 400
            if (!Number.isInteger(limit) || limit < 0) {
                sendJson(res, 400, { error: 'Query limit phải là số nguyên >= 0' });
                return;
            }

            // slice(0, N) lấy N phần tử đầu. slice KHÔNG sửa mảng gốc.
            sendJson(res, 200, products.slice(0, limit));
            return;
        }

        // POST /products: nhận {name, price}, id do server cấp -> 201
        if (method === 'POST') {
            const result = await readJsonBody(req);

            if (!result.ok) {
                sendJson(res, 400, { error: 'Body phải là JSON object hợp lệ' });
                return;
            }

            const body = result.data;

            const product = {
                id: getNextId(products),
                name: typeof body.name === 'string' ? body.name : '',
                price: typeof body.price === 'number' ? body.price : 0,
            };

            products.push(product);  // thêm vào cuối danh sách
            writeProducts(products); // ghi xuống products.csv

            sendJson(res, 201, product); // 201 = Created, trả về product vừa tạo
            return;
        }

        // Các method khác trên /products (PUT, DELETE...) -> không có route -> 404
        sendJson(res, 404, { error: 'Route không tồn tại' });
        return;
    }

    if (isItem) {
        const id = Number(segments[1]);

        // GET /products/:id: trả về 1 sản phẩm, không có id đó thì 404
        if (method === 'GET') {
            const product = findById(readProducts(), id);

            if (!product) {
                sendJson(res, 404, { error: 'Không tìm thấy product id = ' + segments[1] });
                return;
            }

            sendJson(res, 200, product);
            return;
        }

        // PUT /products/:id: thay CẢ record, 404 nếu không có id
        if (method === 'PUT') {
            const products = readProducts();
            const index = findIndexById(products, id);

            // Luôn kiểm -1 trước khi dùng index
            if (index === -1) {
                sendJson(res, 404, { error: 'Không tìm thấy product id = ' + segments[1] });
                return;
            }

            const result = await readJsonBody(req);
            if (!result.ok) {
                sendJson(res, 400, { error: 'Body phải là JSON object hợp lệ' });
                return;
            }

            // Id luôn giữ nguyên id cũ, không lấy id trong body.
            const newRecord = { id: id };
            if ('name' in result.data) {
                newRecord.name = result.data.name;
            }
            if ('price' in result.data) {
                newRecord.price = result.data.price;
            }

            // Gán object mới vào đúng vị trí cũ trong mảng rồi ghi lại file
            products[index] = newRecord;
            writeProducts(products);

            sendJson(res, 200, newRecord);
            return;
        }

        // PATCH /products/:id: chỉ sửa field gửi lên, 404 nếu không có id
        if (method === 'PATCH') {
            const products = readProducts();
            const product = findById(products, id);

            if (!product) {
                sendJson(res, 404, { error: 'Không tìm thấy product id = ' + segments[1] });
                return;
            }

            const result = await readJsonBody(req);
            if (!result.ok) {
                sendJson(res, 400, { error: 'Body phải là JSON object hợp lệ' });
                return;
            }

            // Field không gửi thì giữ nguyên giá trị cũ.
            if ('name' in result.data) {
                product.name = result.data.name;
            }
            if ('price' in result.data) {
                product.price = result.data.price;
            }

            writeProducts(products);
            sendJson(res, 200, product);
            return;
        }

        // DELETE /products/:id: xóa sản phẩm, 404 nếu không có id -> 204 (không body)
        if (method === 'DELETE') {
            const products = readProducts();
            const index = findIndexById(products, id);

            if (index === -1) {
                sendJson(res, 404, { error: 'Không tìm thấy product id = ' + segments[1] });
                return;
            }

            products.splice(index, 1); // xoá 1 phần tử tại vị trí index
            writeProducts(products);

            // 204 = No Content. Không trả body.
            sendNoContent(res, 204);
            return;
        }

        // Method khác (POST trên /products/:id...) -> không có route -> 404
        sendJson(res, 404, { error: 'Route không tồn tại' });
        return;
    }

    // Mọi route còn lại -> 404
    sendJson(res, 404, { error: 'Route không tồn tại: ' + method + ' ' + pathname });
});

// Chạy 1 lần lúc khởi động để chắc chắn products.csv đã tồn tại
ensureProductsFile();

server.listen(PORT, () => {
    console.log('Server dang chay tai http://localhost:' + PORT);
});
