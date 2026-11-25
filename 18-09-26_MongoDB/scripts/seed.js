'use strict';

const { ObjectId } = require('mongodb');
const db = require('../src/db');
const { COLLECTIONS } = require('../src/data-sources/mongo-data-source');

// Du lieu mau co dinh, du de chay 3 bao cao aggregate.
const PRODUCTS = [
  { code: 'P001', name: 'Ao thun cotton', price: 120000, stock: 50, category: 'Ao' },
  { code: 'P002', name: 'Quan jean', price: 250000, stock: 30, category: 'Quan' },
  { code: 'P003', name: 'Mu luoi trai', price: 45000, stock: 100, category: 'Phu kien' },
  { code: 'P004', name: 'Ao khoac mua', price: 50000, stock: 40, category: 'Ao' },
  { code: 'P005', name: 'Tat co ngan', price: 25000, stock: 200, category: 'Phu kien' },
];

const CUSTOMERS = [
  { code: 'C001', name: 'Nguyen Van An', email: 'an.nguyen@example.com', phone: '0901234567', address: 'TP.HCM' },
  { code: 'C002', name: 'Tran Thi Binh', email: 'binh.tran@example.com', phone: '0912345678', address: 'Ha Noi' },
  { code: 'C003', name: 'Le Van Cuong', email: 'cuong.le@example.com', phone: '0987654321', address: 'Da Nang' },
];

// items: [ma san pham, so luong]
const ORDERS = [
  { code: 'O0001', customer: 'C001', items: [['P001', 1], ['P003', 1]], status: 'CONFIRMED', day: 1 },
  { code: 'O0002', customer: 'C002', items: [['P004', 2]], status: 'PENDING', day: 2 },
  { code: 'O0003', customer: 'C003', items: [['P003', 1]], status: 'SHIPPED', day: 3 },
  { code: 'O0004', customer: 'C001', items: [['P002', 1], ['P005', 2]], status: 'CONFIRMED', day: 4 },
  { code: 'O0005', customer: 'C002', items: [['P005', 1]], status: 'CANCELLED', day: 5 },
];

function buildOrder(order, productByCode, customerByCode) {
  const items = order.items.map(([code, quantity]) => {
    const product = productByCode.get(code);
    return {
      // Snapshot: chep name + price tai thoi diem dat hang
      productId: product._id,
      code: product.code,
      name: product.name,
      price: product.price,
      quantity,
      lineTotal: product.price * quantity,
    };
  });

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const createdAt = new Date(Date.UTC(2026, 8, 18 + order.day, 9, 0, 0));

  return {
    code: order.code,
    customerId: customerByCode.get(order.customer)._id,
    customerName: customerByCode.get(order.customer).name,
    items,
    total,
    status: order.status,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Xoa du lieu cu trong 3 collection roi nap lai du lieu mau.
 * Goi duoc nhieu lan (idempotent).
 */
async function seedDatabase(database) {
  const database_ = database || db.getDb();
  const productsCol = database_.collection(COLLECTIONS.PRODUCTS);
  const customersCol = database_.collection(COLLECTIONS.CUSTOMERS);
  const ordersCol = database_.collection(COLLECTIONS.ORDERS);

  await Promise.all([
    productsCol.deleteMany({}),
    customersCol.deleteMany({}),
    ordersCol.deleteMany({}),
  ]);

  const now = new Date(Date.UTC(2026, 8, 18, 8, 0, 0));

  const productDocs = PRODUCTS.map((p) => ({ ...p, createdAt: now, updatedAt: now }));
  await productsCol.insertMany(productDocs);

  const customerDocs = CUSTOMERS.map((c) => ({ ...c, createdAt: now }));
  await customersCol.insertMany(customerDocs);

  const productByCode = new Map(productDocs.map((p) => [p.code, p]));
  const customerByCode = new Map(customerDocs.map((c) => [c.code, c]));
  const orderDocs = ORDERS.map((o) => buildOrder(o, productByCode, customerByCode));
  await ordersCol.insertMany(orderDocs);

  return {
    products: productDocs.length,
    customers: customerDocs.length,
    orders: orderDocs.length,
  };
}

if (require.main === module) {
  (async () => {
    try {
      await db.connect();
      const counts = await seedDatabase();
      console.log(
        `[seed] da nap ${counts.products} products, ${counts.customers} customers, ${counts.orders} orders`
      );
    } catch (err) {
      console.error('[seed] loi:', err.message);
      process.exitCode = 1;
    } finally {
      await db.close();
    }
  })();
}

module.exports = { seedDatabase, PRODUCTS, CUSTOMERS, ORDERS };
