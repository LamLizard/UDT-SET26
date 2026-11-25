'use strict';

const { MongoClient } = require('mongodb');
const config = require('../config');

const COLLECTIONS = Object.freeze({
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
});

let client = null;
let db = null;

/**
 * Tao MongoClient va ket noi toi database.
 * Goi nhieu lan cung luc thi chi tao 1 ket noi duy nhat.
 */
async function connect({ url = config.mongoUrl, dbName = config.dbName } = {}) {
  if (db) return db;

  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB chua duoc ket noi. Goi connect() truoc khi dung collection.');
  }
  return db;
}

function getCollection(name) {
  return getDb().collection(name);
}

const products = () => getCollection(COLLECTIONS.PRODUCTS);
const customers = () => getCollection(COLLECTIONS.CUSTOMERS);
const orders = () => getCollection(COLLECTIONS.ORDERS);

async function close() {
  if (client) {
    await client.close();
  }
  client = null;
  db = null;
}

module.exports = {
  COLLECTIONS,
  connect,
  getDb,
  getCollection,
  products,
  customers,
  orders,
  close,
};
