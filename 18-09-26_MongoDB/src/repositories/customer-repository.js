'use strict';

const { ObjectId } = require('mongodb');
const db = require('../db');

function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
  return null;
}

async function create({ name, email, phone, address }) {
  const doc = { name, email, createdAt: new Date() };
  if (phone !== undefined) doc.phone = phone;
  if (address !== undefined) doc.address = address;

  // email trung -> E11000 -> HTTP 409
  const result = await db.customers().insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

async function findAll({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    db.customers().find({}).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
    db.customers().countDocuments({}),
  ]);
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function findById(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return db.customers().findOne({ _id });
}

async function findByEmail(email) {
  return db.customers().findOne({ email });
}

module.exports = { create, findAll, findById, findByEmail, toObjectId };
