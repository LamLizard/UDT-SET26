'use strict';

const db = require('../src/db');
const { COLLECTIONS } = require('../src/data-sources/mongo-data-source');

const ORDER_STATUSES = ['PENDING', 'PAID', 'CANCELLED'];

// ---------------------------------------------------------------------------
// $jsonSchema cua 3 collection
// ---------------------------------------------------------------------------

const productSchema = {
  bsonType: 'object',
  required: ['code', 'name', 'price', 'stock', 'createdAt'],
  properties: {
    code: { bsonType: 'string', minLength: 1, description: 'Ma san pham, duy nhat' },
    name: { bsonType: 'string', minLength: 1 },
    price: { bsonType: 'number', minimum: 0, description: 'Don gia (VND)' },
    stock: { bsonType: 'number', minimum: 0 },
    category: { bsonType: 'string' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

const customerSchema = {
  bsonType: 'object',
  required: ['name', 'email', 'createdAt'],
  properties: {
    name: { bsonType: 'string', minLength: 1 },
    email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    phone: { bsonType: 'string' },
    address: { bsonType: 'string' },
    createdAt: { bsonType: 'date' },
  },
};

const orderSchema = {
  bsonType: 'object',
  required: ['code', 'customerId', 'items', 'total', 'status', 'createdAt'],
  properties: {
    code: { bsonType: 'string', minLength: 1, description: 'Ma don hang, duy nhat' },
    customerId: { bsonType: 'objectId' },
    customerName: { bsonType: 'string' },
    items: {
      bsonType: 'array',
      minItems: 1,
      items: {
        bsonType: 'object',
        required: ['productId', 'code', 'name', 'price', 'quantity'],
        properties: {
          // 3 truong code/name/price la SNAPSHOT tai thoi diem dat hang
          productId: { bsonType: 'objectId' },
          code: { bsonType: 'string' },
          name: { bsonType: 'string' },
          price: { bsonType: 'number', minimum: 0 },
          quantity: { bsonType: 'number', minimum: 1 },
          lineTotal: { bsonType: 'number', minimum: 0 },
        },
      },
    },
    total: { bsonType: 'number', minimum: 0 },
    status: { enum: ORDER_STATUSES },
    note: { bsonType: 'string' },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
};

// ---------------------------------------------------------------------------
// Tao collection + validator
// ---------------------------------------------------------------------------

async function createCollectionWithSchema(database, name, schema) {
  const validator = { $jsonSchema: schema };
  const options = { validator, validationLevel: 'strict', validationAction: 'error' };

  const existing = await database.listCollections({ name }).toArray();
  if (existing.length > 0) {
    // Da co collection -> chi cap nhat validator
    await database.command({ collMod: name, ...options });
    console.log(`  [schema] cap nhat validator cho "${name}"`);
  } else {
    await database.createCollection(name, options);
    console.log(`  [schema] tao moi collection "${name}"`);
  }
}

async function createIndexes(database) {
  // Unique index: chan trung ma san pham / ma don hang
  await database.collection(COLLECTIONS.PRODUCTS).createIndex(
    { code: 1 },
    { unique: true, name: 'ux_products_code' }
  );
  await database.collection(COLLECTIONS.CUSTOMERS).createIndex(
    { email: 1 },
    { unique: true, name: 'ux_customers_email' }
  );
  await database.collection(COLLECTIONS.ORDERS).createIndex(
    { code: 1 },
    { unique: true, name: 'ux_orders_code' }
  );

  // Index phu tro truy van
  await database.collection(COLLECTIONS.ORDERS).createIndex(
    { customerId: 1, createdAt: -1 },
    { name: 'ix_orders_customer_created' }
  );
  await database.collection(COLLECTIONS.ORDERS).createIndex(
    { status: 1 },
    { name: 'ix_orders_status' }
  );

  console.log('  [index] da tao unique index products.code, orders.code, customers.email');
}

async function setupDatabase() {
  const database = db.getDb();
  console.log(`[setup] database: ${database.databaseName}`);

  await createCollectionWithSchema(database, COLLECTIONS.PRODUCTS, productSchema);
  await createCollectionWithSchema(database, COLLECTIONS.CUSTOMERS, customerSchema);
  await createCollectionWithSchema(database, COLLECTIONS.ORDERS, orderSchema);
  await createIndexes(database);

  return database;
}

if (require.main === module) {
  (async () => {
    try {
      await db.connect();
      await setupDatabase();
      console.log('[setup] xong.');
    } catch (err) {
      console.error('[setup] loi:', err.message);
      process.exitCode = 1;
    } finally {
      await db.close();
    }
  })();
}

module.exports = {
  setupDatabase,
  createCollectionWithSchema,
  createIndexes,
  ORDER_STATUSES,
  schemas: { productSchema, customerSchema, orderSchema },
};
