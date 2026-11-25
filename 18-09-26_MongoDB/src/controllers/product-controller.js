'use strict';

const productRepository = require('../repositories/product-repository');

function badRequest(message, code = 'VALIDATION_ERROR') {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

function parsePagination(query) {
  const page = Number.parseInt(query.page, 10);
  const limit = Number.parseInt(query.limit, 10);
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  return { page: safePage, limit: safeLimit };
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${field} la bat buoc (chuoi khac rong).`);
  }
  return value.trim();
}

function assertNumber(value, field, { min = 0 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw badRequest(`${field} phai la so >= ${min}.`);
  }
  return value;
}

// POST /products
async function create(req, res, next) {
  try {
    const body = req.body || {};
    const code = assertNonEmptyString(body.code, 'code');
    const name = assertNonEmptyString(body.name, 'name');
    const price = assertNumber(body.price, 'price', { min: 0 });
    const stock = body.stock === undefined ? 0 : assertNumber(body.stock, 'stock', { min: 0 });

    if (body.category !== undefined && typeof body.category !== 'string') {
      throw badRequest('category phai la chuoi.');
    }

    const product = await productRepository.create({ code, name, price, stock, category: body.category });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

// GET /products?page=1&limit=20
async function list(req, res, next) {
  try {
    const result = await productRepository.findAll(parsePagination(req.query));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /products/:code
async function getByCode(req, res, next) {
  try {
    const product = await productRepository.findByCode(req.params.code);
    if (!product) {
      const err = new Error(`Khong tim thay san pham ${req.params.code}.`);
      err.status = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// PUT /products/:code
async function update(req, res, next) {
  try {
    const body = req.body || {};
    const changes = {};

    if (body.name !== undefined) changes.name = assertNonEmptyString(body.name, 'name');
    if (body.price !== undefined) changes.price = assertNumber(body.price, 'price', { min: 0 });
    if (body.stock !== undefined) changes.stock = assertNumber(body.stock, 'stock', { min: 0 });
    if (body.category !== undefined) {
      if (typeof body.category !== 'string') throw badRequest('category phai la chuoi.');
      changes.category = body.category;
    }

    if (Object.keys(changes).length === 0) {
      throw badRequest('Khong co truong nao de cap nhat (name, price, stock, category).');
    }

    const product = await productRepository.updateByCode(req.params.code, changes);
    if (!product) {
      const err = new Error(`Khong tim thay san pham ${req.params.code}.`);
      err.status = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// DELETE /products/:code
async function remove(req, res, next) {
  try {
    const deleted = await productRepository.deleteByCode(req.params.code);
    if (!deleted) {
      const err = new Error(`Khong tim thay san pham ${req.params.code}.`);
      err.status = 404;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getByCode, update, remove };
