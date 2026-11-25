# MongoDB Exercise 1 — CRUD products trên MongoDB

Bài cá nhân: chuyển bài n-layer `07-10-26_CRUD_products` (đang lưu bằng file `products.csv`) sang **MongoDB**,
dùng **driver `mongodb` thuần**, không ORM.

Bản gốc không bị sửa: thư mục này là bản copy riêng cho Exercise 1
(`07-10-26_CRUD_products/mongodb_exercise_1`).

## Đã đổi gì so với bài n-layer cũ

| Thành phần | Bài cũ (đọc file) | Bài này (MongoDB) |
|---|---|---|
| Nơi lưu dữ liệu | `datasource/productDataSource.js` đọc/ghi `products.csv` | `datasource/mongo-data-source.js` dùng `MongoClient` |
| Cấu hình | hằng số trong code | `.env`: `MONGODB_URI`, `MONGODB_DB`, `PORT` |
| Repository | hàm đồng bộ | hàm **async**, query trên collection `products` |
| Cấp id | `max(id) + 1` tính từ file | collection `counters` (`_id: 'productId'`, `$inc: { seq: 1 }`) |
| `_id` của Mongo | không có | ẩn khỏi mọi response bằng projection `{ _id: 0 }` |
| Khởi động | `ensureSeeded()` tạo file CSV | `await dataSource.connect()` rồi mới `listen()` |
| Seed | dữ liệu mẫu trong code | `npm run migrate` đọc `database.json` |

**Không đổi:** router, middleware, utils, đường dẫn API, status code, validate body, `?limit`.
Controller chỉ được thêm `async/await` vì repository giờ trả Promise — logic và status code giữ nguyên.

## Cấu trúc

```
mongodb_exercise_1/
├── server.js                        # await connect() -> listen(PORT)
├── router/
│   ├── index.js                     # điều hướng theo tài nguyên
│   └── productRouter.js             # ghép method + path -> controller
├── controller/productController.js  # async, quyết định status code
├── repository/productRepository.js  # CRUD async trên collection products
├── datasource/mongo-data-source.js  # MongoClient: connect / getDb / close
├── middleware/                      # parse JSON body, response lỗi
├── utils/httpUtils.js               # sendJson, sendNoContent
├── scripts/migrate.js               # database.json -> MongoDB
├── scripts/test-crud.js             # bật server -> chạy kiem-tra-crud.js -> tắt
├── kiem-tra-crud.js                 # 20 bước kiểm tra CRUD qua HTTP
├── database.json                    # dữ liệu nguồn để migrate
├── products.csv                     # dữ liệu gốc của bài cũ (giữ lại để đối chiếu)
└── .env.example
```

## Yêu cầu

- Node.js 18+ (dùng `fetch`/driver mới)
- Một MongoDB đang chạy (local hoặc Atlas)

## Cách chạy

```bash
# 1. Cài dependency (mongodb, dotenv)
npm install

# 2. Tạo file cấu hình
cp .env.example .env      # Windows: copy .env.example .env
#    sửa MONGODB_URI / MONGODB_DB nếu cần

# 3. Đổ dữ liệu từ database.json sang MongoDB (chạy lại nhiều lần được)
npm run migrate

# 4. Bật server
npm start                 # http://localhost:3000

# 5. Kiểm tra CRUD thật (tự bật server ở cổng 3100 rồi tắt)
npm test
```

### Biến môi trường (`.env`)

| Biến | Ý nghĩa | Mặc định trong code |
|---|---|---|
| `MONGODB_URI` | URI kết nối MongoDB | `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | tên database (không phải collection) | `express-exercise1` |
| `PORT` | cổng HTTP của server | `3000` |

`.env` đã nằm trong `.gitignore`; chỉ commit `.env.example`.

## API (giữ nguyên như bài n-layer)

| Method | Route | Status | Ghi chú |
|---|---|---|---|
| GET | `/products` | 200 | mảng product, sắp theo `id` tăng dần |
| GET | `/products?limit=N` | 200 / 400 | `N` phải là số nguyên `>= 0`, sai -> 400 |
| GET | `/products/:id` | 200 / 404 | `id` không phải số -> 404 |
| POST | `/products` | 201 / 400 | body `{name, price}`, `id` do server cấp (bỏ `id` trong body) |
| PUT | `/products/:id` | 200 / 404 | thay **cả** record: field không gửi thì mất |
| PATCH | `/products/:id` | 200 / 404 | chỉ sửa field gửi lên |
| DELETE | `/products/:id` | 204 / 404 | không trả body |

Ví dụ:

```bash
curl http://localhost:3000/products?limit=2
# [{"id":1,"name":"Bàn phím","price":300},{"id":2,"name":"Chuột","price":150}]
```

## Thiết kế phần MongoDB

**data-source** (`datasource/mongo-data-source.js`)

- Một `MongoClient` duy nhất cho cả app; `connect()` gọi lại thì trả về `db` đang có.
- `getDb()` báo lỗi rõ ràng nếu quên `connect()`.
- `products()` / `counters()` trả collection thô; `ensureIndexes()` tạo unique index `{ id: 1 }`.
- `close()` đóng client (dùng ở migrate/test và khi tắt server).

**repository** (`repository/productRepository.js`)

- `findAll(limit)` — `find({}, { projection: { _id: 0 } }).sort({ id: 1 }).limit(n)`.
- `findById(id)` — trả `undefined` nếu `id` không phải số nguyên (nên `/products/abc` -> 404, không query rác).
- `create(fields)` — `findOneAndUpdate({_id:'productId'}, {$inc:{seq:1}}, {upsert:true, returnDocument:'after'})`
  lấy id mới, rồi `insertOne`. Id đã cấp **không bao giờ cấp lại**, kể cả sau khi xoá.
- `replace(id, fields)` — `replaceOne({id}, {id, ...field được gửi})`; không có `_id` trong document mới nên Mongo giữ `_id` cũ.
- `update(id, fields)` — `$set` đúng các field gửi lên, `returnDocument: 'after'`.
- `remove(id)` — `deleteOne`, trả `true/false` theo `deletedCount`.

**Document thật trong Mongo** (`db.products.findOne()`):

```json
{ "_id": ObjectId("6b06d5f1a62bfb7ef28878bf"), "id": 1, "name": "Bàn phím", "price": 300 }
```

`_id` tồn tại trong DB nhưng **không bao giờ** xuất hiện trong response (projection `{_id: 0}`).
Collection `counters` chứa `{ _id: "productId", seq: 12 }` sau khi migrate.

## Migrate từ database.json

`database.json` là dữ liệu nguồn (9 product, id 1–12, có khoảng trống ở 4/7/10 do các id đã xoá ở bài cũ):

```json
{ "products": [ { "id": 1, "name": "Bàn phím", "price": 300 }, ... ] }
```

`npm run migrate`:

1. Đọc `database.json` (nhận cả dạng mảng và dạng `{ "products": [...] }`).
2. `deleteMany({})` trên collection `products` rồi `insertMany` toàn bộ — chạy lại không bị nhân đôi.
3. `counters.updateOne({_id:'productId'}, {$set:{seq: max(id)}}, {upsert:true})`.

Output thật:

```
Doc database.json: 9 product
Da ket noi MongoDB: db = express-liza
Da xoa 0 document cu trong collection products
Da insert 9 product vao MongoDB
Da dat counters.productId.seq = 12
Kiem tra: collection products dang co 9 document
Migrate xong.
```

## Kết quả kiểm tra (chạy thật)

`npm start`:

```
Da ket noi MongoDB: db = express-liza
Server dang chay tai http://localhost:3000
```

`npm test` (bộ `kiem-tra-crud.js`, 20 bước, chạy trên server thật + MongoDB thật):

```
=== BAT DAU KIEM TRA: localhost:3100 ===

PASS 1. GET /products tra 200
PASS 2. GET /products tra ve mot MANG
PASS 3. GET /products?limit=2 tra 200
PASS 4. GET /products?limit=2 tra dung 2 phan tu
PASS 5. GET /products/1 tra 200 va dung id = 1
PASS 6. GET /products/99999 (khong co) tra 404
PASS 7. GET /products/abc tra 404
PASS 8. POST /products tra 201
PASS 9. POST tra ve product co id (kieu so)
PASS 10. POST body JSON sai tra 400
PASS 11. POST bo qua id trong body (server tu cap id)
PASS 12. PUT /products/13 tra 200
PASS 13. PUT thay CA record (chi con id + price, name bi mat)
PASS 14. PUT id khong ton tai tra 404
PASS 15. PATCH /products/14 tra 200
PASS 16. PATCH giu nguyen field khong gui len (name van la "Loa")
PASS 17. PATCH id khong ton tai tra 404
PASS 18. DELETE /products/13 tra 200 hoac 204
PASS 19. DELETE lai id da xoa tra 404
PASS 20. GET /khong-ton-tai tra 404

[Thong tin them] id da xoa = 13, id moi cap = 15 -> id khong bi cap lai: DUNG

=== KET QUA: 20 PASS / 0 FAIL ===
```

> `npm test` tạo/xoá product thật trong DB (id 13, 14, 15). Muốn trả dữ liệu về đúng `database.json`
> thì chạy lại `npm run migrate`.

## Ghi chú

- `database.json` được lập từ 9 dòng dữ liệu của `products.csv` trong bài n-layer cũ, để đúng yêu cầu
  "migrate từ database.json". File `products.csv` vẫn giữ trong thư mục để đối chiếu.
- `scripts/test-crud.js` chạy server ở cổng 3100 để không đụng server dev đang mở cổng 3000.
- Muốn dùng Atlas: đổi `MONGODB_URI` thành `mongodb+srv://<user>:<pass>@<cluster>/...` và đặt `MONGODB_DB`
  là tên database, nhớ allowlist IP.
