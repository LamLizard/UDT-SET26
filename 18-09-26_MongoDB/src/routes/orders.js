'use strict';

const express = require('express');
const controller = require('../controllers/order-controller');

const router = express.Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:code', controller.getByCode);
router.patch('/:code/status', controller.updateStatus);

module.exports = router;
