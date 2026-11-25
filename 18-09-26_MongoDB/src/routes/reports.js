'use strict';

const express = require('express');
const orderRepository = require('../repositories/order-repository');

const router = express.Router();

// GET /reports/orders - bao cao tung don (co $lookup khach hang)
router.get('/orders', async (req, res, next) => {
  try {
    res.json(await orderRepository.orderSummaries());
  } catch (err) {
    next(err);
  }
});

// GET /reports/order-buckets - phan loai <50k / 50k-100k / >100k
router.get('/order-buckets', async (req, res, next) => {
  try {
    res.json(await orderRepository.orderBuckets());
  } catch (err) {
    next(err);
  }
});

// GET /reports/revenue-by-customer - doanh thu theo khach hang (lam them)
router.get('/revenue-by-customer', async (req, res, next) => {
  try {
    res.json(await orderRepository.revenueByCustomer());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
