'use strict';

const path = require('path');

// Nap bien moi truong tu file .env o thu muc goc du an (neu co).
// File .env that KHONG duoc commit - chi commit .env.example.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017',
  dbName: process.env.DB_NAME || 'shop_test',
  port: Number(process.env.PORT) || 3000,
};

module.exports = config;
