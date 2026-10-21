# Review bài của Kiệt — người chấm: Dương Vĩ Lâm

## 1. Kết quả kiểm CRUD

- **PASS: 20/20** khi gửi kèm header `Authorization` với token demo (bản test copy có token, vì `kiem-tra-crud.js` gốc không gửi token).
- Chạy `kiem-tra-crud.js` gốc không token: **PASS 1, FAIL 2** rồi dừng, vì POST bị **401** do Kiệt chặn token. Theo hướng dẫn Bài 1, các FAIL 401 do route ghi có token **không tính**.
- **Bản một file:** không có trong bài nộp nên không so được.

Lệnh đã chạy:

```bash
node kiem-tra-crud.js http://localhost:3000
# raw: PASS 1, FAIL 2 (dừng ở POST vì 401)

node kiem-tra-crud-token.js http://localhost:3000
# PASS 20, FAIL 0
```

## 2. File cần hai câu để tả

- **`middleware.js`** — phải dùng ít nhất 2–3 câu:
  - Vừa là thư viện response HTTP (`sendJSON`, `sendError`, `sendNoContent`).
  - Vừa là middleware auth/log (`checkToken`, `logRequest`).
  - Vừa đọc và validate body (`readJsonBody`, `isValidBodyObject`, `InvalidJsonBodyError`).
- **`controller.js`** — về layer là Controller, nhưng trong file còn có `parseLimit`, `hasValidPrice`, `readBodyOrSendError`; nếu tách theo single responsibility thì phần đọc body nên chuyển sang middleware, còn validate/parse limit có thể giữ Controller.

## 3. Controller tự đụng dữ liệu

- Không có.

## 4. Repository biết `req`, `res`, `sendJson`, status

- Không có.

## 5. Thứ tự breakpoint

- Router: `router.js:47` — `await controller.handleGetProductById(...)`.
- Controller: `controller.js:92` — `repository.findById(productId)`.
- Repository: `repository.js:21` — `findProductIndexById(...)`.

## Nếu là bài của em, em sửa chỗ

1. **Tách `middleware.js`**:
   - `http-utils.js`: `sendJSON`, `sendError`, `sendNoContent`.
   - `middlewares/require-token.js`: `checkToken`.
   - `middlewares/log-request.js`: `logRequest`.
   - `middlewares/parse-json-body.js`: `readJsonBody` + `isValidBodyObject`.
2. **Đưa `readBodyOrSendError` ra khỏi Controller** — đọc body là việc chung, nên là middleware; controller chỉ nhận `req.body`.
3. **Router nên gắn middleware theo route**, không gọi `checkToken` rải rác trong từng nhánh `if`; hiện tại router vừa route vừa auth, khó thấy luồng.
4. **`file-data-source.js` chưa được dùng** — `repository.js` đang require `memory-data-source`; nếu muốn có DataSource file thì đổi require và kiểm tra `FILE_PATH`, nếu không thì bỏ file thừa để tránh hiểu nhầm.
5. **Thống nhất format lỗi**: middleware trả `{ error: ... }`; các API khác trong bài dùng `{ message: ... }`. Không sai CRUD test, nhưng nên thống nhất để client dễ xử lý.

---

**Ghi chú:** Kết quả 20/20 là sau khi thêm token vào bản test copy.
