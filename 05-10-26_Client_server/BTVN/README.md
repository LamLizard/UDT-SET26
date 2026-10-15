# Website Todo List

## 1. Công nghệ sử dụng

- **Backend:** Các module tích hợp sẵn của Node.js gồm `http`, `fs`, `path`, `crypto`; các thư viện `jsonwebtoken`, `nodemailer`, `csv-parse` / `csv-stringify`.
- **Frontend:** HTML, CSS, JavaScript thuần (vanilla JavaScript), `fetch()`, `localStorage` (dùng để lưu JWT).
- **Lưu trữ dữ liệu:** `backend/db/users.csv` và `backend/db/tasks.csv` (tự động tạo khi khởi động lần đầu).

## 2. Cấu trúc thư mục

```text
BTVN/
├── frontend/
│   ├── page/       (login.html, signup.html, assign-task.html)
│   ├── script/     (login.js, signup.js, assign-task.js)
│   └── style/      (login.css, signup.css, assign-task.css)
├── backend/
│   ├── src/
│   │   ├── routes/          (authRoutes.js, taskRoutes.js)
│   │   ├── controllers/     (authController.js, taskController.js)
│   │   ├── services/        (authService.js, taskService.js, emailService.js)
│   │   ├── middleware/      (authMiddleware.js)
│   │   ├── store/           (userStore.js)
│   │   ├── utils/           (csvUtils.js, jwtUtils.js, passwordUtils.js, responseUtils.js, validationUtils.js)
│   │   ├── config.js
│   │   └── server.js
│   └── db/
│       ├── users.csv
│       └── tasks.csv   (cả hai tự động tạo khi khởi động lần đầu, được Git bỏ qua)
├── .env
├── .gitignore
├── package.json
└── README.md
```

**Trách nhiệm của từng thành phần:**

- **routes:** Khai báo danh sách route (method, path, có cần xác thực hay không) và ánh xạ tới controller.
- **controllers:** Đọc request và gửi response.
- **services:** Chứa logic nghiệp vụ (đăng ký, đăng nhập, xác minh email, quản lý công việc).
- **middleware:** Xác thực JWT cho các API được bảo vệ.
- **store:** Chỉ mục người dùng trong bộ nhớ (ánh xạ theo email và id) dựng từ `users.csv`.
- **utils:** Các hàm tiện ích dùng chung (đọc/ghi CSV, JWT, băm mật khẩu, chuẩn hóa/kiểm tra dữ liệu, định dạng response).

## 3. Yêu cầu hệ thống

Node.js phiên bản **20.6 trở lên** (sử dụng `node --env-file` để nạp biến môi trường từ file `.env`).

## 4. Cài đặt và khởi chạy

```bash
npm install
# Tạo file .env ở thư mục gốc dự án (BTVN/) và điền đầy đủ các biến ở mục 5
npm start
```

Mở trình duyệt tại địa chỉ:

**http://localhost:3000**

## 5. Các biến môi trường trong file `.env`

| Tên biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng máy chủ (mặc định là 3000). |
| `JWT_SECRET` | Chuỗi bí mật ngẫu nhiên, dài ít nhất 32 ký tự. |
| `JWT_EXPIRES_DAYS` | Thời hạn của token tính bằng ngày (mặc định là 3 ngày). |
| `SMTP_HOST` / `SMTP_PORT` | Máy chủ SMTP: `smtp.gmail.com`; cổng `465` (TLS trực tiếp) hoặc `587` (STARTTLS). |
| `SMTP_USER` | Địa chỉ Gmail của bạn. |
| `SMTP_APP_PASSWORD` | **Mật khẩu ứng dụng Gmail (App Password)**, không phải mật khẩu Gmail thông thường. |
| `APP_BASE_URL` | Địa chỉ gốc được sử dụng trong liên kết xác minh email, ví dụ `http://localhost:3000`. |

Tạo chuỗi bí mật bằng lệnh:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Máy chủ sẽ từ chối khởi động nếu thiếu cấu hình bắt buộc, đồng thời không in các giá trị bí mật ra màn hình.

## 6. Tạo Gmail App Password

1. Bật tính năng xác minh 2 bước (2-Step Verification) cho tài khoản Google của bạn.
2. Truy cập https://myaccount.google.com/apppasswords và tạo mật khẩu ứng dụng.
3. Điền mật khẩu gồm 16 ký tự vào biến `SMTP_APP_PASSWORD` (không có khoảng trắng) và điền địa chỉ Gmail vào `SMTP_USER`.

## 7. Tài liệu API

Tất cả response đều có định dạng:

```json
{
  "status": "OK" hoặc "ERROR",
  "message": "...",
  "data": ...
}
```

| Phương thức | Đường dẫn | Xác thực | Mô tả |
|---|---|---|---|
| POST | `/api/signup` | Không | Tạo tài khoản ở trạng thái `pending`, sau đó gửi email xác minh bất đồng bộ. |
| GET | `/api/verify-email?token=...` | Không | Kích hoạt tài khoản (hiển thị một trang HTML đơn giản). |
| POST | `/api/resend-verification` | Không | Gửi lại email xác minh (mỗi tài khoản chờ 60 giây giữa các lần gửi; tối đa 5 lần trong 10 phút cho mỗi IP). |
| POST | `/api/login` | Không | Trả về `{ token, user }`; tài khoản chưa xác minh email nhận mã 403 `EMAIL_NOT_VERIFIED`. |
| POST | `/api/logout` | Có | Xác nhận đăng xuất (token không bị thu hồi ở phía máy chủ). |
| GET | `/api/me` | Có | Lấy thông tin người dùng hiện tại (id, name, email). |
| GET | `/api/users` | Có | Lấy danh sách người dùng đang hoạt động (id, name, email). |
| GET | `/api/tasks` | Có | Lấy toàn bộ công việc, kèm `assignedToName`. |
| POST | `/api/tasks` | Có | Tạo công việc với dữ liệu `{ content }`. |
| PATCH | `/api/tasks/:id` | Có | Cập nhật một hoặc nhiều trường `content`, `assignedTo` (`""` nghĩa là bỏ phân công), `completed`. |
| DELETE | `/api/tasks/:id` | Có | Xóa một công việc. |

**Các mã trạng thái HTTP:** `200`, `201`, `400`, `401`, `403` (email chưa được xác minh), `404`, `409`, `429`, `500`.

## 8. Cấu trúc dữ liệu CSV

- `users.csv`:

  `id,email,passwordSalt,passwordHash,name,status,verificationTokenHash,verificationExpiresAt,verificationSentAt,createdAt`

- `tasks.csv`:

  `id,content,createdBy,assignedTo,completed,createdAt,updatedAt`

**ID:** Cả người dùng lẫn công việc đều dùng **số nguyên dương nhỏ nhất chưa được dùng** (1, 2, 3, ...), độc lập với số thứ tự dòng trong file.

**Cách ghi file:**

- `users.csv` **chỉ ghi thêm (append-only):** đăng ký ghi thẳng một dòng mới; mỗi lần cập nhật trạng thái cũng ghi thêm một dòng mới có cùng `id`. Vì vậy một người dùng có thể xuất hiện trên nhiều dòng. Khi nạp vào bộ nhớ, `userStore` dùng `Map` theo `id`/`email` nên **dòng cuối cùng (mới nhất) thắng**, các dòng cũ bị bỏ qua.
- `tasks.csv` **ghi đè cả file** mỗi khi thêm/sửa/xóa (ghi ra file tạm rồi `rename` đè lên file thật, nên an toàn nếu tiến trình dừng giữa chừng).

## 9. Quy trình xác minh email

1. **Đăng ký:** Hệ thống kiểm tra dữ liệu đầu vào, băm mật khẩu bằng `scrypt` kết hợp với salt ngẫu nhiên, lưu **giá trị băm của token ngẫu nhiên** (token hết hạn sau 15 phút), lưu tài khoản ở trạng thái `pending`, sau đó trả về response.
2. **Gửi email:** Email được gửi sau đó. Nếu SMTP gặp lỗi, hệ thống ghi log lỗi (không ghi token vào log) và tài khoản vẫn ở trạng thái `pending`. Người dùng có thể chọn chức năng **Resend verification email** trên trang đăng nhập để gửi lại email xác minh.
3. **Xác minh:** Khi người dùng mở liên kết, hệ thống băm token nhận được, so sánh với giá trị băm đã lưu và kiểm tra thời hạn. Nếu hợp lệ, tài khoản được kích hoạt và các trường token được xóa. Liên kết không thể sử dụng lần thứ hai.

## 10. Cơ chế JWT

- Token được ký bằng thuật toán HS256.
- Trường `sub` chứa ID người dùng.
- Thời hạn token được xác định bởi `JWT_EXPIRES_DAYS`.
- Khi thay đổi giá trị `JWT_EXPIRES_DAYS`, thay đổi đó **chỉ áp dụng cho các token được cấp mới**.
- Mỗi request cần xác thực sẽ kiểm tra chữ ký, thời hạn token, đồng thời kiểm tra lại tài khoản có tồn tại và đang ở trạng thái `active` hay không.
- Frontend lưu token trong `localStorage` và gọi `/api/me` sau khi trang được tải lại để khôi phục trạng thái đăng nhập.

## 11. Các hạn chế đã biết

- **CSV không phải cơ sở dữ liệu thực sự:** Không hỗ trợ transaction. Hàng đợi ghi dữ liệu chỉ bảo vệ trong phạm vi **một tiến trình máy chủ duy nhất**, nên chỉ được chạy một instance.
- **Hai kiểu ghi dữ liệu khác nhau:** `users.csv` ghi thêm dòng (append) nên nhanh $O(1)$ nhưng có thể chứa nhiều dòng cho cùng một `id` (chỉ dòng mới nhất có hiệu lực); `tasks.csv` ghi đè toàn bộ file mỗi lần thay đổi $O(n)$. Cả hai chỉ phù hợp với lượng dữ liệu nhỏ.
- **Đăng xuất:** Chỉ xóa token trên trình duyệt. Nếu token đã bị sao chép, token vẫn hợp lệ cho đến khi hết hạn vì máy chủ không thu hồi token.
- **Token trong `localStorage`:** Có nguy cơ bị đánh cắp nếu ứng dụng tồn tại lỗ hổng XSS. Nội dung công việc được hiển thị bằng `textContent` để tránh việc diễn giải nội dung thành HTML. Khi triển khai thực tế, cần sử dụng HTTPS.
- **Giới hạn gửi lại email:** Dữ liệu giới hạn số lần gửi được lưu trong bộ nhớ và bị đặt lại khi khởi động lại máy chủ. Chưa có giới hạn số lần đăng nhập.
- **Tiết lộ thông tin email:** Các API đăng ký và gửi lại email có thể tiết lộ liệu một địa chỉ email đã đăng ký hoặc đang chờ xác minh hay chưa. Đây là sự đánh đổi để tăng tính tiện dụng.

## 12. Xử lý sự cố

- **`Invalid configuration: Missing environment variables`**  
  Kiểm tra xem file `.env` có tồn tại ở thư mục gốc dự án hay không và tất cả biến môi trường bắt buộc đã được điền đầy đủ chưa.

- **`node: .env: not found`**  
  Chạy `npm start` từ thư mục gốc dự án (`BTVN/`) và tạo file `.env` tại đó với đầy đủ các biến ở mục 5.

- **`Failed to send verification email ... Invalid login / 535`**  
  Sử dụng Gmail App Password thay vì mật khẩu Gmail thông thường và bật xác minh 2 bước.

- **`ETIMEDOUT` / `ECONNECTION`**  
  Mạng của bạn có thể đang chặn kết nối SMTP. Hãy thử sử dụng cổng `587` thay cho `465`.

- **Không nhận được email**  
  Kiểm tra thư mục Spam và nội dung log trên console của máy chủ để tìm thông báo `Failed to send verification email`.
