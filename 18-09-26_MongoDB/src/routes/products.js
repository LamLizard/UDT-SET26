'use strict';

const express = require('express');
const controller = require('../controllers/product-controller');

const router = express.Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:code', controller.getByCode);
router.put('/:code', controller.update);
router.delete('/:code', controller.remove);

module.exports = router;
