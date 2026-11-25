'use strict';

const { ObjectId } = require('mongodb');
const db = require('../db');
const { COLLECTIONS } = require('../data-sources/mongo-data-source');

const ORDER_STATUSES = ['PENDING', 'PAID', 'CANCELLED'];

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
  return null;
}

function normalizeFindOneAndUpdate(result) {
  if (!result) return null;
  if (Object.prototype.hasOwnProperty.call(result, 'value')) return result.value;
  return result;
}

/**
 * Tao don hang.
 * items: [{ productId? , code?, quantity }] - chap nhan ca 2 cach dinh danh san pham.
 * Moi item luu SNAPSHOT: productId + code + name + price + quantity + lineTotal.
 */
async function create({ code, customerId, items, status = 'PENDING', note }) {
  const customerObjectId = toObjectId(customerId);
  if (!customerObjectId) {
    throw httpError('customerId khong hop le (phai la ObjectId 24 ky tu hex).', 400, 'INVALID_CUSTOMER_ID');
  }

  const customer = await db.customers().findOne({ _id: customerObjectId });
  if (!customer) {
    throw httpError(`Khong tim thay customer ${customerId}.`, 404, 'CUSTOMER_NOT_FOUND');
  }

  const snapshotItems = [];
  for (const item of items) {
    let filter;
    if (item.productId !== undefined && item.productId !== null) {
      const productObjectId = toObjectId(item.productId);
      if (!productObjectId) {
        throw httpError(`productId khong hop le: ${item.productId}.`, 400, 'INVALID_PRODUCT_ID');
      }
      filter = { _id: productObjectId };
    } else {
      filter = { code: item.code };
    }

    const product = await db.products().findOne(filter);

    if (!product) {
      throw httpError(
        `Khong tim thay san pham ${item.code || item.productId}.`,
        404,
        'PRODUCT_NOT_FOUND'
      );
    }

    const quantity = item.quantity;
    if (product.stock < quantity) {
      throw httpError(
        `San pham ${product.code} khong du hang (con ${product.stock}, can ${quantity}).`,
        409,
        'OUT_OF_STOCK'
      );
    }

    snapshotItems.push({
      productId: product._id,
      code: product.code,
      name: product.name, // snapshot ten
      price: product.price, // snapshot don gia
      quantity,
      lineTotal: product.price * quantity,
    });
  }

  const total = snapshotItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const now = new Date();
  const doc = {
    code,
    customerId: customer._id,
    customerName: customer.name,
    items: snapshotItems,
    total,
    status,
    createdAt: now,
    updatedAt: now,
  };
  if (note !== undefined) doc.note = note;

  const result = await db.orders().insertOne(doc);
  const order = { _id: result.insertedId, ...doc };

  // Tru kho tung mon bang update co dieu kien stock >= quantity (chong ban qua so luong
  // khi 2 request cung luc). Loi giua chung -> hoan lai cac mon da tru va xoa don vua tao.
  const deducted = [];
  try {
    for (const item of snapshotItems) {
      const update = await db
        .products()
        .updateOne(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity }, $set: { updatedAt: new Date() } }
        );

      if (update.modifiedCount !== 1) {
        throw httpError(
          `San pham ${item.code} vua het hang, khong the tru kho.`,
          409,
          'OUT_OF_STOCK'
        );
      }
      deducted.push(item);
    }
  } catch (err) {
    // rollback: tra lai so luong da tru, xoa don vua insert
    for (const item of deducted) {
      await db
        .products()
        .updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }
    await db.orders().deleteOne({ _id: result.insertedId });
    throw err;
  }

  return order;
}

async function findAll({ page = 1, limit = 10, status } = {}) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.orders().find(filter).sort({ createdAt: -1, code: 1 }).skip(skip).limit(limit).toArray(),
    db.orders().countDocuments(filter),
  ]);

  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function findByCode(code) {
  return db.orders().findOne({ code });
}

async function updateStatus(code, status) {
  if (!ORDER_STATUSES.includes(status)) {
    throw httpError(`status phai la mot trong: ${ORDER_STATUSES.join(', ')}`, 400, 'INVALID_STATUS');
  }

  const result = await db
    .orders()
    .findOneAndUpdate(
      { code },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

  const updated = normalizeFindOneAndUpdate(result);
  if (!updated) {
    throw httpError(`Khong tim thay don hang ${code}.`, 404, 'ORDER_NOT_FOUND');
  }
  return updated;
}

// ---------------------------------------------------------------------------
// 3 pipeline aggregate cho /reports
// ---------------------------------------------------------------------------

/** 1) Bao cao tung don: khach hang ($lookup) + so luong san pham. */
async function orderSummaries() {
  return db.orders().aggregate([
    { $sort: { createdAt: -1, code: 1 } },
    {
      $lookup: {
        from: COLLECTIONS.CUSTOMERS,
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        code: 1,
        status: 1,
        total: 1,
        itemCount: { $sum: '$items.quantity' },
        lineCount: { $size: '$items' },
        customerName: { $ifNull: ['$customer.name', '$customerName'] },
        createdAt: 1,
      },
    },
  ]).toArray();
}

/**
 * 2) Phan loai don theo gia tri bang $bucket:
 *    [0, 50000) -> <50k | [50000, 100001) -> 50k-100k | con lai (default) -> >100k
 * Boundary cuoi la 100001 (khong phai 100000) de don dung 100.000d van nam trong nhom 50k-100k.
 */
async function orderBuckets() {
  const rows = await db.orders().aggregate([
    {
      $bucket: {
        groupBy: '$total',
        boundaries: [0, 50000, 100001],
        default: '>100k',
        output: {
          orderCount: { $sum: 1 },
          revenue: { $sum: '$total' },
          codes: { $push: '$code' },
        },
      },
    },
  ]).toArray();

  // Luon tra du 3 nhom, nhom khong co don thi orderCount = 0
  // ($bucket chi tra ve nhom co du lieu, va _id cua no la boundary/default)
  const labels = [
    { id: 0, bucket: '<50k' },
    { id: 50000, bucket: '50k-100k' },
    { id: '>100k', bucket: '>100k' },
  ];

  return labels.map(({ id, bucket }) => {
    const row = rows.find((r) => r._id === id);
    return row
      ? { bucket, orderCount: row.orderCount, revenue: row.revenue, codes: row.codes }
      : { bucket, orderCount: 0, revenue: 0, codes: [] };
  });
}

/** 3) Doanh thu theo khach hang (bo qua don CANCELLED) - phan lam them. */
async function revenueByCustomer() {
  return db.orders().aggregate([
    { $match: { status: { $ne: 'CANCELLED' } } },
    {
      $group: {
        _id: '$customerId',
        orderCount: { $sum: 1 },
        revenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.CUSTOMERS,
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        customerName: { $ifNull: ['$customer.name', '(khong con trong customers)'] },
        email: '$customer.email',
        orderCount: 1,
        revenue: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 0] },
      },
    },
    { $sort: { revenue: -1 } },
  ]).toArray();
}

module.exports = {
  ORDER_STATUSES,
  create,
  findAll,
  findByCode,
  updateStatus,
  orderSummaries,
  orderBuckets,
  revenueByCustomer,
  toObjectId,
  httpError,
};
