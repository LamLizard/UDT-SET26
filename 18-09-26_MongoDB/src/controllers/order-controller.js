'use strict';

const orderRepository = require('../repositories/order-repository');

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
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
  return { page: safePage, limit: safeLimit };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('items phai la mang khac rong: [{ code | productId, quantity }].');
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw badRequest(`items[${index}] phai la object.`);
    }
    const hasCode = typeof item.code === 'string' && item.code.trim() !== '';
    const hasProductId = typeof item.productId === 'string' && item.productId.trim() !== '';
    if (!hasCode && !hasProductId) {
      throw badRequest(`items[${index}] can co "code" hoac "productId".`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw badRequest(`items[${index}].quantity phai la so nguyen >= 1.`);
    }
    return {
      code: hasCode ? item.code.trim() : undefined,
      productId: hasProductId ? item.productId.trim() : undefined,
      quantity: item.quantity,
    };
  });
}

// POST /orders - tao don, chep snapshot name + price cua san pham
async function create(req, res, next) {
  try {
    const body = req.body || {};

    if (typeof body.code !== 'string' || body.code.trim() === '') {
      throw badRequest('code la bat buoc (chuoi khac rong).');
    }
    if (typeof body.customerId !== 'string' || body.customerId.trim() === '') {
      throw badRequest('customerId la bat buoc (ObjectId dang chuoi).');
    }
    const items = validateItems(body.items);

    if (body.status !== undefined && !orderRepository.ORDER_STATUSES.includes(body.status)) {
      throw badRequest(`status phai la mot trong: ${orderRepository.ORDER_STATUSES.join(', ')}`);
    }
    if (body.note !== undefined && typeof body.note !== 'string') {
      throw badRequest('note phai la chuoi.');
    }

    const order = await orderRepository.create({
      code: body.code.trim(),
      customerId: body.customerId.trim(),
      items,
      status: body.status,
      note: body.note,
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

// GET /orders?page=1&limit=10
async function list(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const status = req.query.status;
    if (status !== undefined && !orderRepository.ORDER_STATUSES.includes(status)) {
      throw badRequest(`status phai la mot trong: ${orderRepository.ORDER_STATUSES.join(', ')}`);
    }
    const result = await orderRepository.findAll({ page, limit, status });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /orders/:code
async function getByCode(req, res, next) {
  try {
    const order = await orderRepository.findByCode(req.params.code);
    if (!order) {
      const err = new Error(`Khong tim thay don hang ${req.params.code}.`);
      err.status = 404;
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// PATCH /orders/:code/status
async function updateStatus(req, res, next) {
  try {
    const body = req.body || {};
    if (typeof body.status !== 'string') {
      throw badRequest(`status la bat buoc: ${orderRepository.ORDER_STATUSES.join(', ')}`);
    }
    const order = await orderRepository.updateStatus(req.params.code, body.status);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getByCode, updateStatus };
