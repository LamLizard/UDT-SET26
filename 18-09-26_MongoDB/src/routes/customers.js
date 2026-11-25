'use strict';

const express = require('express');
const controller = require('../controllers/customer-controller');

const router = express.Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);

module.exports = router;
