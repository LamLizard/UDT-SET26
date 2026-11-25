'use strict';

const { ObjectId } = require('mongodb');
const db = require('../db');

function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
  return null;
}

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function create({ code, name, price, stock = 0, category }) {
  const now = new Date();
  const doc = {
    code,
    name,
    price,
    stock,
    createdAt: now,
    updatedAt: now,
  };
  if (category !== undefined && category !== null) doc.category = category;

  // Neu code bi trung, driver nem loi E11000 -> server.js doi thanh HTTP 409
  const result = await db.products().insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function findAll({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    db.products().find({}).sort({ code: 1 }).skip(skip).limit(limit).toArray(),
    db.products().countDocuments({}),
  ]);
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function findByCode(code) {
  return db.products().findOne({ code });
}

async function findById(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return db.products().findOne({ _id });
}

async function updateByCode(code, changes) {
  const set = { ...changes, updatedAt: new Date() };
  delete set._id;
  delete set.code;

  const result = await db
    .products()
    .findOneAndUpdate({ code }, { $set: set }, { returnDocument: 'after' });

  return normalizeFindOneAndUpdate(result);
}

async function deleteByCode(code) {
  const result = await db.products().deleteOne({ code });
  return result.deletedCount === 1;
}

// driver v5 tra ve { value }, v6 tra ve thang document
function normalizeFindOneAndUpdate(result) {
  if (!result) return null;
  if (Object.prototype.hasOwnProperty.call(result, 'value')) return result.value;
  return result;
}

module.exports = {
  create,
  findAll,
  findByCode,
  findById,
  updateByCode,
  deleteByCode,
  toObjectId,
  httpError,
};
