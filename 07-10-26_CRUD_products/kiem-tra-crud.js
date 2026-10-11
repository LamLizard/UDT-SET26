/**
 * ============================================================================
 * FILE: kiem-tra-crud.js
 * ----------------------------------------------------------------------------
 * FILE NÀY DÙNG ĐỂ LÀM GÌ?
 *   - Đây là BỘ KIỂM TRA (tester), KHÔNG phải server.
 *   - Nó gửi 20 request vào server đang chạy (server.js) và in ra PASS / FAIL
 *     cho từng bước, kèm "thứ mong đợi" và "thứ server thật sự trả về".
 *
 * CÁCH DÙNG (mở 2 terminal):
 *   Terminal 1:  node server.js          <- bật server, để yên đó
 *   Terminal 2:  node kiem-tra-crud.js   <- chạy bộ kiểm tra
 *
 * CÁCH SỬA LỖI:
 *   - Sửa FAIL ĐẦU TIÊN trước. Một bug ở trên có thể kéo theo FAIL ở dưới,
 *     và có bug chỉ lộ ra sau khi bug khác đã được sửa.
 *   - Mỗi FAIL: đọc "mong đợi" và "thực nhận", tự ghi giả thuyết,
 *     đặt breakpoint ở dòng nghi ngờ trong server.js, tắt/bật lại server,
 *     rồi chạy lại CẢ BỘ kiểm tra.
 * ============================================================================
 */

// Module "http" để gửi request. Node thuần, không cần cài thêm gì.
// (Không dùng fetch để bộ kiểm tra chạy được trên Node cũ.)
const http = require('http');

// Phải khớp với PORT trong server.js
const HOST = 'localhost';
const PORT = 3000;

// ===========================================================================
// HÀM GỬI REQUEST
// ===========================================================================

/**
 * Gửi 1 request tới server và chờ response.
 *
 * Input:
 *   method  : 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
 *   path    : ví dụ '/products?limit=2'
 *   body    : object sẽ được JSON.stringify rồi gửi (bỏ trống nếu không có body)
 *   rawText : chuỗi gửi thẳng, KHÔNG stringify.
 *             Dùng để test body JSON sai cú pháp, ví dụ: '{ name: '
 *
 * Output (Promise resolve ra object):
 *   { status: 200, body: <object đã parse hoặc null>, raw: '<chuỗi thô server trả>' }
 */
function request(method, path, body, rawText) {
  return new Promise((resolve, reject) => {
    // Chuẩn bị dữ liệu sẽ gửi
    let payload = null;
    if (rawText !== undefined) {
      payload = rawText; // gửi thẳng, cố tình để JSON sai
    } else if (body !== undefined) {
      payload = JSON.stringify(body); // object -> chuỗi JSON
    }

    const options = {
      host: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {},
    };

    if (payload !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let raw = '';

      res.on('data', (chunk) => {
        raw += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          // Response 204 không có body -> raw là '' -> để nguyên null
          parsed = raw === '' ? null : JSON.parse(raw);
        } catch (err) {
          parsed = null; // server trả về thứ không phải JSON
        }

        resolve({ status: res.statusCode, body: parsed, raw: raw });
      });
    });

    // Server chưa bật -> lỗi ECONNREFUSED
    req.on('error', reject);

    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

// ===========================================================================
// HÀM IN KẾT QUẢ
// ===========================================================================

let soLuongPass = 0;
let soLuongFail = 0;

/**
 * In PASS hoặc FAIL cho 1 bước kiểm tra.
 *
 * Input:
 *   so      : số thứ tự bước
 *   ten     : mô tả bước đang kiểm
 *   dung    : true/false - điều kiện đúng hay sai
 *   mongDoi : mô tả thứ ta mong server trả về
 *   thucNhan: mô tả thứ server THẬT SỰ trả về
 */
function check(so, ten, dung, mongDoi, thucNhan) {
  if (dung) {
    soLuongPass += 1;
    console.log('PASS ' + so + '. ' + ten);
  } else {
    soLuongFail += 1;
    console.log('FAIL ' + so + '. ' + ten);
    console.log('     mong doi : ' + mongDoi);
    console.log('     thuc nhan: ' + thucNhan);
  }
}

// ===========================================================================
// CHẠY 20 BƯỚC KIỂM TRA
// ===========================================================================

async function main() {
  console.log('=== BAT DAU KIEM TRA: ' + HOST + ':' + PORT + ' ===\n');

  let r; // biến giữ response của request vừa gửi

  // ---- 1. GET /products -------------------------------------------------
  r = await request('GET', '/products');
  check(1, 'GET /products tra 200', r.status === 200, 200, r.status);

  // ---- 2. GET /products trả về mảng -------------------------------------
  check(
    2,
    'GET /products tra ve mot MANG',
    Array.isArray(r.body),
    'body la array',
    Array.isArray(r.body) ? 'array' : typeof r.body
  );

  // ---- 3+4. GET /products?limit=2 --------------------------------------
  r = await request('GET', '/products?limit=2');
  check(3, 'GET /products?limit=2 tra 200', r.status === 200, 200, r.status);
  check(
    4,
    'GET /products?limit=2 tra dung 2 phan tu',
    Array.isArray(r.body) && r.body.length === 2,
    'mang co length = 2',
    Array.isArray(r.body) ? 'length = ' + r.body.length : 'khong phai array'
  );

  // ---- 5. GET /products/1 ----------------------------------------------
  r = await request('GET', '/products/1');
  check(
    5,
    'GET /products/1 tra 200 va dung id = 1',
    r.status === 200 && r.body !== null && r.body.id === 1,
    'status 200, id = 1',
    'status ' + r.status + ', id = ' + (r.body ? r.body.id : 'null')
  );

  // ---- 6. GET id không tồn tại -> 404 ----------------------------------
  r = await request('GET', '/products/99999');
  check(6, 'GET /products/99999 (khong co) tra 404', r.status === 404, 404, r.status);

  // ---- 7. GET id không phải số -> 404 ----------------------------------
  r = await request('GET', '/products/abc');
  check(7, 'GET /products/abc tra 404', r.status === 404, 404, r.status);

  // ---- 8+9. POST /products -> 201 --------------------------------------
  r = await request('POST', '/products', { name: 'Tai nghe', price: 500 });
  check(8, 'POST /products tra 201', r.status === 201, 201, r.status);

  const idVuaTao = r.body ? r.body.id : null;
  check(
    9,
    'POST tra ve product co id (kieu so)',
    Number.isInteger(idVuaTao),
    'id la so nguyen',
    'id = ' + idVuaTao + ' (' + typeof idVuaTao + ')'
  );

  // ---- 10. POST body JSON sai -> 400 -----------------------------------
  r = await request('POST', '/products', undefined, '{ name: ');
  check(10, 'POST body JSON sai tra 400', r.status === 400, 400, r.status);

  // ---- 11. POST gửi kèm id -> server tự cấp id -------------------------
  r = await request('POST', '/products', { id: 12345, name: 'Loa', price: 800 });
  const idBoQua = r.body ? r.body.id : null;
  check(
    11,
    'POST bo qua id trong body (server tu cap id)',
    r.status === 201 && idBoQua !== 12345,
    'status 201, id do server cap (khac 12345)',
    'status ' + r.status + ', id = ' + idBoQua
  );
  const idDePatch = idBoQua;

  // ---- 12. PUT thay CẢ record -> 200 -----------------------------------
  r = await request('PUT', '/products/' + idVuaTao, { price: 999 });
  check(12, 'PUT /products/' + idVuaTao + ' tra 200', r.status === 200, 200, r.status);

  // ---- 13. Kiểm chứng PUT đã thay cả record ----------------------------
  r = await request('GET', '/products/' + idVuaTao);
  const conName = r.body ? r.body.name : 'null';
  const conPrice = r.body ? r.body.price : 'null';
  check(
    13,
    'PUT thay CA record (chi con id + price, name bi mat)',
    r.status === 200 && r.body !== null && r.body.price === 999 && r.body.name === undefined,
    'price = 999, name = undefined',
    'price = ' + conPrice + ', name = ' + conName
  );

  // ---- 14. PUT id không tồn tại -> 404 ---------------------------------
  r = await request('PUT', '/products/99999', { price: 1 });
  check(14, 'PUT id khong ton tai tra 404', r.status === 404, 404, r.status);

  // ---- 15. PATCH -> 200 ------------------------------------------------
  r = await request('PATCH', '/products/' + idDePatch, { price: 850 });
  check(15, 'PATCH /products/' + idDePatch + ' tra 200', r.status === 200, 200, r.status);

  // ---- 16. PATCH chỉ sửa field gửi lên, field khác giữ nguyên ----------
  const patchName = r.body ? r.body.name : 'null';
  const patchPrice = r.body ? r.body.price : 'null';
  check(
    16,
    'PATCH giu nguyen field khong gui len (name van la "Loa")',
    r.body !== null && r.body.name === 'Loa' && r.body.price === 850,
    'name = "Loa", price = 850',
    'name = ' + JSON.stringify(patchName) + ', price = ' + patchPrice
  );

  // ---- 17. PATCH id không tồn tại -> 404 -------------------------------
  r = await request('PATCH', '/products/99999', { price: 1 });
  check(17, 'PATCH id khong ton tai tra 404', r.status === 404, 404, r.status);

  // ---- 18. DELETE -> 200 hoặc 204 --------------------------------------
  r = await request('DELETE', '/products/' + idVuaTao);
  check(
    18,
    'DELETE /products/' + idVuaTao + ' tra 200 hoac 204',
    r.status === 200 || r.status === 204,
    '200 hoac 204',
    r.status
  );

  // ---- 19. DELETE lại id đã xoá -> 404 ---------------------------------
  r = await request('DELETE', '/products/' + idVuaTao);
  check(19, 'DELETE lai id da xoa tra 404', r.status === 404, 404, r.status);

  // ---- 20. Route khác -> 404 -------------------------------------------
  r = await request('GET', '/khong-ton-tai');
  check(20, 'GET /khong-ton-tai tra 404', r.status === 404, 404, r.status);

  // ---- Kiểm tra thêm (không tính vào 20 bước) --------------------------
  // Id đã cấp thì KHÔNG cấp lại cho product khác, kể cả sau khi xoá.
  r = await request('POST', '/products', { name: 'Webcam', price: 700 });
  const idMoi = r.body ? r.body.id : null;
  console.log(
    '\n[Thong tin them] id da xoa = ' + idVuaTao + ', id moi cap = ' + idMoi +
      ' -> id khong bi cap lai: ' + (idMoi > idVuaTao ? 'DUNG' : 'SAI')
  );

  // ---- Tổng kết --------------------------------------------------------
  console.log('\n=== KET QUA: ' + soLuongPass + ' PASS / ' + soLuongFail + ' FAIL ===');

  if (soLuongFail > 0) {
    console.log('Sua FAIL DAU TIEN truoc, roi chay lai ca bo.');
    process.exitCode = 1; // thoát với mã lỗi để script khác biết là có FAIL
  }
}

// Chạy và bắt lỗi kết nối (ví dụ quên bật server)
main().catch((err) => {
  console.log('\nKHONG KET NOI DUOC TOI SERVER.');
  console.log('Loi: ' + err.message);
  console.log('Kiem tra: da chay "node server.js" o terminal khac chua?');
  process.exitCode = 1;
});
