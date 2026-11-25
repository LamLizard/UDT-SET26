'use strict';

const customerRepository = require('../repositories/customer-repository');

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

// POST /customers
async function create(req, res, next) {
  try {
    const body = req.body || {};

    if (typeof body.name !== 'string' || body.name.trim() === '') {
      throw badRequest('name la bat buoc (chuoi khac rong).');
    }
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
      throw badRequest('email khong hop le.');
    }
    if (body.phone !== undefined && typeof body.phone !== 'string') {
      throw badRequest('phone phai la chuoi.');
    }
    if (body.address !== undefined && typeof body.address !== 'string') {
      throw badRequest('address phai la chuoi.');
    }

    const customer = await customerRepository.create({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone,
      address: body.address,
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

// GET /customers?page=1&limit=20
async function list(req, res, next) {
  try {
    const result = await customerRepository.findAll(parsePagination(req.query));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /customers/:id
async function getById(req, res, next) {
  try {
    const customer = await customerRepository.findById(req.params.id);
    if (!customer) {
      const err = new Error(`Khong tim thay khach hang ${req.params.id}.`);
      err.status = 404;
      err.code = 'CUSTOMER_NOT_FOUND';
      throw err;
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById };
