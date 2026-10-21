# Ghi chép — Bài tập tối 21/10 · Tách tầng

## Bài 1 — Chấm bài tách tầng của bạn cùng cặp

**Đã chấm bài của Kiệt.**

- `kiem-tra-crud.js` gốc không token: **PASS 1, FAIL 2** rồi dừng vì POST bị 401 do Kiệt chặn token.
- Chạy bản test copy có header `Authorization` token demo: **PASS 20/20**.
- `middleware.js` là file cần 2–3 câu để tả: vừa là HTTP response utils, vừa là auth/log middleware, vừa đọc/validate body.
- Controller không tự đụng dữ liệu; Repository không biết.
- Thứ tự đặt breakpoint: `router.js:47` → `controller.js:92` → `repository.js:21`.

---

## Bài 2 — Đoạn code này ở tầng nào

| Đoạn | Tầng | Vì sao (1 câu) | Cặp bạn chọn | Đáp án |
|---|---|---|---|---|
| 1 — `formatVnd` | Middleware | Format dữ liệu, dùng lại nhiều chỗ, không đụng `req`, `res`. | — | Helper / utils |
| 2 — `requireJson` | Middleware | Kiểm header cho mọi route nhận body, tự trả 415 và dừng request. | — | Middleware |
| 3 — `limitRequest` | Middleware | Giới hạn request theo IP, áp cho cả app, tự trả 429 và dừng request. | — | Middleware |
| 4 — kiểm `stock` | Controller | Luật riêng của API đặt hàng: gọi Repository rồi chọn status 400. | — | Controller |
| 5 — `getUsdToVndRate` | Router | Gọi API tỷ giá bên ngoài. | — | Service |
| 6 — `findCheaperThan` | Repository | Tìm trên dữ liệu, nhận số trả mảng, không biết `req`, `res`. | — | Repository |
| 7 — `load` đọc file orders | DataSource | Biết dữ liệu nằm ở file nào và đọc file lên. | — | DataSource |
| 8 — object `{ method, path, ... }` | Router | Ghép method + URL với middleware và controller. | — | Router |
| 9 — `isPositiveInteger` | Helper / utils | Kiểm một giá trị, dùng lại nhiều chỗ, không đụng `req`, `res`. | — | Helper / utils |
| 10 — `sendOrderEmail` | Service | Gửi email qua hệ thống bên ngoài. | — | Service |
| 11 — tính `total` và giảm 10% | Controller hoặc Helper / utils | Luật “trên 500000 thì giảm 10%” là business logic; tách thành hàm không đụng `req/res` thì là helper. | — | Controller hoặc Helper / utils |
| 12 — `logRequest` | Middleware | Ghi log mọi request, không phải business logic. | — | Middleware |
| 13 — `readBody` | Middleware | Đọc body là việc chung của mọi route ghi; hàm đọc thẳng từ `req` nên không phải helper. | — | Middleware |

---

## Bài 3 — Săn 5 bug

**Kết quả:** `node kiem-tra-5-bug.js` → **PASS 12, FAIL 0**.

| Bước FAIL ban đầu | Em đoán tầng | Tầng thật | file:dòng | Dòng cũ → dòng mới | Breakpoint thấy gì |
|---|---|---|---|---|---|
| 2 — `GET /products/1` trả 404 | Controller | Controller | `server/controllers/product-controller.js:16` | `findById(params.id)` → `findById(Number(params.id))` | Repository dòng 10: `id` là string `"1"`, `p.id` là number `1`; so sánh strict `===` trả false. |
| 5 — token sai vẫn tạo 201 | Middleware | Middleware | `server/middlewares/require-token.js:6` | `if (!req.headers.authorization)` → `if (req.headers.authorization !== \`Bearer ${DEMO_TOKEN}\`)` | Dòng 6: header `Bearer token-sai` vẫn tồn tại; điều kiện cũ chỉ kiểm có header, không kiểm đúng token. |
| 7 — tạo xong, `GET /products` body rỗng | DataSource | DataSource | `server/data-sources/file-data-source.js:11` | `JSON.stringify(data.products, null, 2)` → `JSON.stringify(data, null, 2)` | Dòng 11: `data` có `{ products, nextId }` nhưng file bị ghi thành mảng; lần load sau `findAll` destructure `{ products }` ra `undefined`. |
| 10 — `DELETE /products/2` không token vẫn 204 | Router | Router | `server/router.js:12` (gốc; sau khi thêm import là dòng 13) | `middlewares: []` → `middlewares: [requireToken]` | `require-token.js:6` không dừng với DELETE; route DELETE không có middleware, route PATCH thì có. |
| 11 — xoá product 2 mất luôn product 3 | Repository | Repository | `server/repositories/product-repository.js:43` | `data.products.splice(index)` → `data.products.splice(index, 1)` | Dòng 43: trước `F10` mảng có 3 phần tử; sau `splice(index)` còn 1 phần tử (mất cả 2 và 3). Sau sửa còn đúng `[1, 3]`. |

**Ghi chú:** Mỗi bug sửa đúng 1 dòng; 5 bug nằm ở 5 file khác nhau: Controller, Middleware, DataSource, Router, Repository.

---

## Bài 4 — Dời việc đọc body sang middleware

**Đã làm:**

- Tạo `server/middlewares/parse-json-body.js`.
- Gắn middleware vào ba route ghi trong `server/router.js`, sau `requireToken`:
  - `POST /products`
  - `PUT /products/:id`
  - `PATCH /products/:id`
- Sửa vòng lặp middleware trong `router.js` thành `await` vì middleware mới là hàm async.
- Bỏ `readBody` khỏi `product-controller.js`; controller đọc `req.body`.

**Vì sao kiểm token trước rồi mới đọc body?**

Vì request chưa xác thực thì phải trả 401 ngay, không cần đọc/parse body; vừa đúng thứ tự bảo vệ, vừa tránh đọc dữ liệu không cần thiết và tránh tiêu thụ stream trước khi biết request có được phép hay không.

**Breakpoint với `node gui-request.js json-hong`:**

- Dừng ở `server/middlewares/parse-json-body.js:4` (gọi `readBody`) và trả 400 tại dòng 6.
- Không dừng ở `server/controllers/product-controller.js` vì middleware đã dừng request.

**Kết quả:** `node kiem-tra-bai-4.js` → **PASS 9, FAIL 0**.

---

## Kết quả test đã chạy thật

```text
node kiem-tra-5-bug.js
PASS 12, FAIL 0.

node kiem-tra-bai-4.js
PASS 9, FAIL 0.
```

---