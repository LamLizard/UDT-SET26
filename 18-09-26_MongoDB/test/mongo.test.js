'use strict';

// Test chay tren database RIENG (shop_test_e2e) de khong dung vao du lieu dev.
// Phai dat bien moi truong TRUOC khi require src/config (dotenv khong ghi de bien da co).
process.env.DB_NAME = process.env.DB_NAME_TEST || 'shop_test_e2e';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { ObjectId } = require('mongodb');
const db = require('../src/db');
const { setupDatabase } = require('../scripts/setup-db');
const { seedDatabase } = require('../scripts/seed');
const orderRepository = require('../src/repositories/order-repository');
const { createApp } = require('../server');

let server;
let baseUrl;
let customers;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function customerId(email) {
  const customer = customers.find((c) => c.email === email);
  assert.ok(customer, `khong tim thay customer ${email}`);
  return customer._id.toString();
}

before(async () => {
  await db.connect();
  await db.getDb().dropDatabase(); // lam sach truoc moi lan chay test
  await setupDatabase();
  await seedDatabase();
  customers = await db.customers().find({}).toArray();

  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
});

test('POST /orders chep dung snapshot name + price tai thoi diem dat hang', async () => {
  const created = await api('/orders', {
    method: 'POST',
    body: {
      code: 'T-SNAP-01',
      customerId: customerId('an.nguyen@example.com'),
      items: [{ code: 'P001', quantity: 2 }],
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.items.length, 1);

  const item = created.body.items[0];
  assert.equal(item.code, 'P001');
  assert.equal(item.name, 'Ao thun cotton');
  assert.equal(item.price, 120000);
  assert.equal(item.quantity, 2);
  assert.equal(item.lineTotal, 240000);
  assert.equal(created.body.total, 240000);
  assert.equal(created.body.customerName, 'Nguyen Van An');

  // Doi gia san pham sau khi dat hang -> don hang phai giu gia cu
  const updated = await api('/products/P001', { method: 'PUT', body: { price: 999000 } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.price, 999000);

  const afterUpdate = await api('/orders/T-SNAP-01');
  assert.equal(afterUpdate.status, 200);
  assert.equal(afterUpdate.body.items[0].price, 120000);
  assert.equal(afterUpdate.body.total, 240000);

  // Tra gia ve cu de cac test sau khong bi anh huong
  await api('/products/P001', { method: 'PUT', body: { price: 120000 } });
});

test('Trung code don hang -> HTTP 409 (unique index, E11000)', async () => {
  const body = {
    code: 'T-DUP-01',
    customerId: customerId('binh.tran@example.com'),
    items: [{ code: 'P003', quantity: 1 }],
  };

  const first = await api('/orders', { method: 'POST', body });
  assert.equal(first.status, 201);

  const second = await api('/orders', { method: 'POST', body });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'DUPLICATE_KEY');

  const stored = await db.orders().countDocuments({ code: 'T-DUP-01' });
  assert.equal(stored, 1, 'chi duoc luu 1 don voi code T-DUP-01');
});

test('Repository: insert trung code nem loi E11000', async () => {
  await assert.rejects(
    () =>
      orderRepository.create({
        code: 'O0001', // da co trong seed
        customerId: new ObjectId(customers[0]._id),
        items: [{ code: 'P003', quantity: 1 }],
      }),
    (err) => err.code === 11000
  );
});

test('Don dung 100.000d roi dung nhom 50k-100k', async () => {
  const created = await api('/orders', {
    method: 'POST',
    body: {
      code: 'T-BUCKET-100K',
      customerId: customerId('cuong.le@example.com'),
      items: [{ code: 'P004', quantity: 2 }], // 50.000 x 2 = 100.000
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.total, 100000);

  const buckets = await api('/reports/order-buckets');
  assert.equal(buckets.status, 200);
  assert.equal(buckets.body.length, 3, 'luon tra du 3 nhom');

  const middle = buckets.body.find((b) => b.bucket === '50k-100k');
  const high = buckets.body.find((b) => b.bucket === '>100k');
  const low = buckets.body.find((b) => b.bucket === '<50k');

  assert.ok(middle, 'phai co nhom 50k-100k');
  assert.ok(middle.codes.includes('T-BUCKET-100K'), 'don 100.000d phai nam trong 50k-100k');
  assert.ok(!high.codes.includes('T-BUCKET-100K'));
  assert.ok(!low.codes.includes('T-BUCKET-100K'));

  // Kiem tra thu cong: tong so don cua 3 nhom = tong so don trong DB
  const totalInDb = await db.orders().countDocuments({});
  const sumInBuckets = buckets.body.reduce((sum, b) => sum + b.orderCount, 0);
  assert.equal(sumInBuckets, totalInDb);
});

test('Phan trang limit=2: trang 1 va trang 2 dung so don + total', async () => {
  const all = await api('/orders?page=1&limit=100');
  assert.equal(all.status, 200);
  const total = all.body.total;
  assert.ok(total >= 4, 'seed + test phai co it nhat 4 don');

  const page1 = await api('/orders?page=1&limit=2');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.page, 1);
  assert.equal(page1.body.limit, 2);
  assert.equal(page1.body.total, total);
  assert.equal(page1.body.totalPages, Math.ceil(total / 2));
  assert.equal(page1.body.data.length, 2);

  const page2 = await api('/orders?page=2&limit=2');
  assert.equal(page2.status, 200);
  assert.equal(page2.body.page, 2);
  assert.equal(page2.body.total, total);
  assert.equal(page2.body.data.length, Math.min(2, total - 2));

  const codes1 = page1.body.data.map((o) => o.code);
  const codes2 = page2.body.data.map((o) => o.code);
  assert.equal(codes1.some((code) => codes2.includes(code)), false, '2 trang khong duoc trung don');
});

test('Tru kho khi tao don: vuot ton kho -> 409 khong tao don; du hang -> tru dung', async () => {
  const created = await api('/products', {
    method: 'POST',
    body: { code: 'T-STOCK', name: 'San pham test ton kho', price: 10000, stock: 1 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.stock, 1);

  const cid = customerId('cuong.le@example.com');

  // dat 2 mon nhung chi con 1 -> 409 OUT_OF_STOCK, khong tao don, khong tru kho
  const tooMany = await api('/orders', {
    method: 'POST',
    body: { code: 'T-STOCK-OUT', customerId: cid, items: [{ code: 'T-STOCK', quantity: 2 }] },
  });
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.body.error, 'OUT_OF_STOCK');
  assert.equal(await db.orders().countDocuments({ code: 'T-STOCK-OUT' }), 0);

  let product = await db.products().findOne({ code: 'T-STOCK' });
  assert.equal(product.stock, 1, 'ton kho khong duoc thay doi khi don bi tu choi');

  // dat 1 mon -> 201 va tru dung 1
  const ok = await api('/orders', {
    method: 'POST',
    body: { code: 'T-STOCK-OK', customerId: cid, items: [{ code: 'T-STOCK', quantity: 1 }] },
  });
  assert.equal(ok.status, 201);

  product = await db.products().findOne({ code: 'T-STOCK' });
  assert.equal(product.stock, 0, 'phai tru dung so luong da dat');

  // het hang -> don tiep theo bi tu choi
  const again = await api('/orders', {
    method: 'POST',
    body: { code: 'T-STOCK-OK2', customerId: cid, items: [{ code: 'T-STOCK', quantity: 1 }] },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'OUT_OF_STOCK');
});

test('Bao cao doanh thu theo khach hang bo qua don CANCELLED', async () => {
  const revenue = await api('/reports/revenue-by-customer');
  assert.equal(revenue.status, 200);
  assert.ok(revenue.body.length >= 3);

  const validOrders = await db.orders().find({ status: { $ne: 'CANCELLED' } }).toArray();
  const cancelledOrders = await db.orders().find({ status: 'CANCELLED' }).toArray();
  assert.ok(cancelledOrders.length >= 1, 'seed phai co it nhat 1 don CANCELLED');

  // 1) tong doanh thu = tong total cua don khong CANCELLED
  const expectedTotal = validOrders.reduce((sum, o) => sum + o.total, 0);
  assert.equal(revenue.body.reduce((sum, r) => sum + r.revenue, 0), expectedTotal);

  // 2) tong so don cung phai khop
  assert.equal(revenue.body.reduce((sum, r) => sum + r.orderCount, 0), validOrders.length);

  // 3) tung khach: doanh thu phai bang tong don hop le cua khach do (khong cong don CANCELLED)
  const expectedByCustomer = new Map();
  for (const o of validOrders) {
    const key = String(o.customerId);
    expectedByCustomer.set(key, (expectedByCustomer.get(key) || 0) + o.total);
  }

  for (const row of revenue.body) {
    const expected = expectedByCustomer.get(String(row.customerId));
    assert.ok(expected !== undefined, `khach ${row.customerName} khong co don hop le nao`);
    assert.equal(row.revenue, expected, `doanh thu cua ${row.customerName} sai`);
  }

  // 4) khach chi co don CANCELLED thi khong duoc xuat hien
  const reportedIds = new Set(revenue.body.map((r) => String(r.customerId)));
  for (const o of cancelledOrders) {
    const cid = String(o.customerId);
    if (!expectedByCustomer.has(cid)) {
      assert.ok(!reportedIds.has(cid), 'khach chi co don CANCELLED khong duoc vao bao cao');
    }
  }
});
