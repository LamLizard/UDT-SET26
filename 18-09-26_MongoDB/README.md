# 18-09-26_MongoDB — Shop API (products / customers / orders + báo cáo aggregate)

Bài tập MongoDB: CRUD cơ bản + 3 báo cáo `aggregate` (snapshot giá, `$lookup`, unique index).

- Môn: SWP391 / NodeJS + MongoDB — UDT-SET 2026
- Ngày: 18-09-26 (buổi MongoDB)

## Yêu cầu môi trường

- Node.js >= 18 (đã test với Node 26)
- MongoDB >= 6.0 chạy local ở `mongodb://127.0.0.1:27017` (hoặc MongoDB Atlas — chỉ cần đổi `MONGO_URL`)

## Cách chạy

```bash
npm install                              # cài dependencies
cp .env.example .env                     # tạo file .env từ mẫu (Windows: copy .env.example .env)
npm run setup                            # tạo 3 collection + $jsonSchema + unique index + seed dữ liệu mẫu
npm start                                # chạy server tại http://127.0.0.1:3000
npm test                                 # chạy test (dùng database riêng shop_test_e2e)
```

Lệnh khác:

```bash
npm run seed                             # chỉ nạp lại dữ liệu mẫu (xoá dữ liệu cũ trong 3 collection)
npm start                                # PORT có thể đổi qua biến môi trường PORT trong .env
```

File `.env` **không được commit** (đã nằm trong `.gitignore`), chỉ commit `.env.example`.

Gặp lỗi `MongoServerSelectionError ... ECONNREFUSED 127.0.0.1:27017` nghĩa là MongoDB chưa chạy — bật MongoDB service (`net start MongoDB`) hoặc chạy `mongod --dbpath <thư mục dữ liệu>` trước, rồi chạy lại `npm run setup`.

### Dùng MongoDB Atlas (cloud, không cần cài MongoDB)

1. Tạo tài khoản tại <https://cloud.mongodb.com> → **Build a Database** → chọn **M0 (Free)** → provider AWS, region **ap-southeast-1 (Singapore)** → **Create Deployment**.
2. Tạo **database user** (Security → Database Access): username + password, role **Atlas admin** (hoặc *Read and write to any database*), vì script cần tạo/xoá database.
3. **Network Access** → **Add My Current IP Address** (để demo có thể dùng `0.0.0.0/0`).
4. Cluster → **Connect** → **Drivers** → copy connection string dạng
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Dán vào `.env` (chỉ đổi `MONGO_URL`, giữ `DB_NAME=shop_test`):

```bash
MONGO_URL=mongodb+srv://shopuser:MatKhau123@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=shop_test
PORT=3000
```

6. Chạy `npm run setup` → `npm test` → `npm start`. Test vẫn dùng database riêng `shop_test_e2e`.

Lưu ý: mật khẩu có ký tự đặc biệt (`@ : / ? # % &`) phải percent-encode (`@` → `%40`) — dễ nhất là bật *Autogenerate Secure Password*, hoặc dùng chuỗi "standard connection string" trong hộp thoại Connect nếu mạng chặn DNS SRV.

## Cấu trúc thư mục

```
18-09-26_MongoDB/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── server.js                     # điểm vào: express app, gắn routes, listen
├── src/
│   ├── config.js                 # đọc MONGO_URL / DB_NAME / PORT từ .env
│   ├── db.js                     # lớp mỏng: connect / getDb / getCollection
│   ├── data-sources/
│   │   └── mongo-data-source.js  # MongoClient, kết nối DB, export collection
│   ├── routes/
│   │   ├── products.js
│   │   ├── customers.js
│   │   ├── orders.js
│   │   └── reports.js
│   ├── controllers/
│   │   ├── product-controller.js
│   │   ├── customer-controller.js
│   │   └── order-controller.js
│   └── repositories/
│       ├── product-repository.js
│       ├── customer-repository.js
│       └── order-repository.js   # query orders + 3 pipeline aggregate cho reports
├── scripts/
│   ├── setup-db.js               # $jsonSchema + unique index
│   └── seed.js                   # dữ liệu mẫu
└── test/
    └── mongo.test.js             # test tích hợp bằng node:test
```

## API endpoints

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/health` | Kiểm tra server + kết nối DB |
| POST | `/products` | Tạo sản phẩm (body: `code`, `name`, `price`, `stock`, `category`) |
| GET | `/products?page=1&limit=20` | Danh sách sản phẩm + phân trang |
| GET | `/products/:code` | Lấy sản phẩm theo `code` |
| PUT | `/products/:code` | Cập nhật `name` / `price` / `stock` / `category` |
| DELETE | `/products/:code` | Xoá sản phẩm |
| POST | `/customers` | Thêm khách (body: `name`, `email`, `phone`, `address`) |
| GET | `/customers?page=1&limit=20` | Danh sách khách hàng |
| GET | `/customers/:id` | Lấy khách theo `_id` |
| POST | `/orders` | Tạo đơn — chép **snapshot** `name` + `price` từ sản phẩm |
| GET | `/orders?page=1&limit=10&status=PENDING` | Danh sách đơn + phân trang + `total` |
| GET | `/orders/:code` | Lấy đơn theo `code` |
| PATCH | `/orders/:code/status` | Cập nhật trạng thái (`PENDING`/`CONFIRMED`/`SHIPPED`/`CANCELLED`) |
| GET | `/reports/orders` | Báo cáo từng đơn (`$lookup` khách hàng) |
| GET | `/reports/order-buckets` | Phân loại đơn `<50k` / `50k–100k` / `>100k` |
| GET | `/reports/revenue-by-customer` | Doanh thu theo khách (làm thêm) |

Ví dụ tạo đơn:

```bash
curl -X POST http://127.0.0.1:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "code": "O1001",
    "customerId": "<_id khách hàng>",
    "items": [{ "code": "P001", "quantity": 2 }]
  }'
```

Mã lỗi: `400` body sai / vi phạm `$jsonSchema` (code 121), `404` không tìm thấy, `409` trùng `code`/`email` (E11000).

## Dữ liệu mẫu (seed)

- 5 sản phẩm: `P001` Áo thun cotton 120.000đ, `P002` Quần jean 250.000đ, `P003` Mũ lưỡi trai 45.000đ, `P004` Áo khoác mưa 50.000đ, `P005` Tất cổ ngắn 25.000đ
- 3 khách hàng: `an.nguyen@example.com`, `binh.tran@example.com`, `cuong.le@example.com`
- 5 đơn: `O0001` 165.000đ, `O0002` 100.000đ, `O0003` 45.000đ, `O0004` 300.000đ, `O0005` 25.000đ

## Output mẫu của 3 báo cáo

### 1. `GET /reports/orders`

```json
[
  {
    "code": "O0005",
    "total": 25000,
    "status": "CANCELLED",
    "createdAt": "2026-09-23T09:00:00.000Z",
    "itemCount": 1,
    "lineCount": 1,
    "customerName": "Tran Thi Binh"
  },
  {
    "code": "O0004",
    "total": 300000,
    "status": "CONFIRMED",
    "createdAt": "2026-09-22T09:00:00.000Z",
    "itemCount": 3,
    "lineCount": 2,
    "customerName": "Nguyen Van An"
  },
  {
    "code": "O0003",
    "total": 45000,
    "status": "SHIPPED",
    "createdAt": "2026-09-21T09:00:00.000Z",
    "itemCount": 1,
    "lineCount": 1,
    "customerName": "Le Van Cuong"
  },
  {
    "code": "O0002",
    "total": 100000,
    "status": "PENDING",
    "createdAt": "2026-09-20T09:00:00.000Z",
    "itemCount": 2,
    "lineCount": 1,
    "customerName": "Tran Thi Binh"
  },
  {
    "code": "O0001",
    "total": 165000,
    "status": "CONFIRMED",
    "createdAt": "2026-09-19T09:00:00.000Z",
    "itemCount": 2,
    "lineCount": 2,
    "customerName": "Nguyen Van An"
  }
]
```

### 2. `GET /reports/order-buckets`

```json
[
  {
    "orderCount": 2,
    "revenue": 70000,
    "codes": [
      "O0003",
      "O0005"
    ],
    "bucket": "<50k"
  },
  {
    "orderCount": 1,
    "revenue": 100000,
    "codes": [
      "O0002"
    ],
    "bucket": "50k-100k"
  },
  {
    "orderCount": 2,
    "revenue": 465000,
    "codes": [
      "O0001",
      "O0004"
    ],
    "bucket": ">100k"
  }
]
```

### 3. `GET /reports/revenue-by-customer`

```json
[
  {
    "orderCount": 2,
    "revenue": 465000,
    "customerId": "6b06a4c0fe9a6ecbd7c096dd",
    "customerName": "Nguyen Van An",
    "email": "an.nguyen@example.com",
    "avgOrderValue": 232500
  },
  {
    "orderCount": 1,
    "revenue": 100000,
    "customerId": "6b06a4c0fe9a6ecbd7c096de",
    "customerName": "Tran Thi Binh",
    "email": "binh.tran@example.com",
    "avgOrderValue": 100000
  },
  {
    "orderCount": 1,
    "revenue": 45000,
    "customerId": "6b06a4c0fe9a6ecbd7c096df",
    "customerName": "Le Van Cuong",
    "email": "cuong.le@example.com",
    "avgOrderValue": 45000
  }
]
```

## Giải thích ngắn

### Snapshot giá (vì sao đơn hàng không đọc giá từ `products`)

Khi tạo đơn, mỗi item **chép lại** `name` và `price` của sản phẩm tại thời điểm mua (`order-repository.create`), rồi tính `lineTotal = price × quantity` và `total` — tất cả lưu trong document `orders`.

Lý do: giá sản phẩm thay đổi theo thời gian. Nếu đơn hàng chỉ lưu `productId` rồi lúc báo cáo mới `$lookup` sang `products` để lấy giá, thì mọi đơn cũ sẽ bị tính lại theo giá mới → sai doanh thu. Snapshot giữ nguyên giá lúc bán; test `POST /orders chep dung snapshot name + price` chứng minh điều này: đổi giá `P001` sau khi đặt, đơn cũ vẫn giữ 120.000đ.

### `$lookup` (join giữa các collection)

`$lookup` là phép join của aggregation pipeline. Ví dụ báo cáo từng đơn:

```js
{ $lookup: {
    from: 'customers',
    localField: 'customerId',
    foreignField: '_id',
    as: 'customer'
} },
{ $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } }
```

`$lookup` trả về **mảng** `customer` (rỗng nếu không khớp), `$unwind` bung mảng đó thành object để dùng `$customer.name`. `preserveNullAndEmptyArrays: true` giữ lại đơn của khách đã bị xoá — nhờ vậy báo cáo không bị mất đơn. Báo cáo doanh thu theo khách dùng chiều ngược lại: `group` theo `customerId` trước rồi `$lookup` sang `customers` để lấy tên/email.

### Unique index (vì sao trùng `code` bị chặn)

Trong `scripts/setup-db.js`:

```js
await db.collection('orders').createIndex({ code: 1 }, { unique: true, name: 'ux_orders_code' });
await db.collection('products').createIndex({ code: 1 }, { unique: true, name: 'ux_products_code' });
```

Unique index được kiểm tra ở tầng database, nên **không phụ thuộc** vào việc code ứng dụng có kiểm tra hay không: insert/update trùng `code` sẽ bị MongoDB từ chối với lỗi `E11000 duplicate key error`. Server bắt `err.code === 11000` trong middleware xử lý lỗi và trả **HTTP 409** kèm `keyValue` cho client. Index này cũng tăng tốc tìm đơn theo `code` (đúng 1 lần đọc index thay vì quét collection).

Ngoài ra `$jsonSchema` (validator `strict`, `validationAction: 'error'`) chặn document sai cấu trúc ngay khi ghi: ví dụ `orders.items[].price` phải là number ≥ 0, `status` chỉ được là một trong 4 giá trị, `total` bắt buộc. Lỗi này trả về code MongoDB `121` → HTTP 400.

## Test

`npm test` chạy `node --test` trên database **riêng** `shop_test_e2e` (xoá sạch trước mỗi lần chạy) nên không ảnh hưởng dữ liệu `shop_test`. Các case:

1. `POST /orders` chép đúng snapshot `name` + `price` (đổi giá sau đó, đơn không đổi).
2. Trùng `code` → `E11000` / HTTP 409; trong DB chỉ có 1 đơn.
3. Đơn đúng 100.000đ rơi đúng nhóm `50k–100k`.
4. Phân trang `limit=2`: trang 1 và trang 2 đúng số đơn, `total`, `totalPages`, không trùng đơn.
5. Báo cáo doanh thu theo khách bỏ qua đơn `CANCELLED` và khớp tổng với DB.
