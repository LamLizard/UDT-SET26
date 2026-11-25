'use strict';

// Lop mong man nay de phan con lai cua app chi can require('../db')
// ma khong phu thuoc truc tiep vao driver MongoDB.
const mongoDataSource = require('./data-sources/mongo-data-source');

module.exports = {
  COLLECTIONS: mongoDataSource.COLLECTIONS,
  connect: mongoDataSource.connect,
  getDb: mongoDataSource.getDb,
  getCollection: mongoDataSource.getCollection,
  products: mongoDataSource.products,
  customers: mongoDataSource.customers,
  orders: mongoDataSource.orders,
  close: mongoDataSource.close,
};
