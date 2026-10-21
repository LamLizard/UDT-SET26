'use strict';

const repository = require('./repository');
const {
  sendJSON,
  sendError,
  sendNoContent,
  readJsonBody,
  isValidBodyObject,
  InvalidJsonBodyError
} = require('./middleware');

const BODY_MESSAGE = 'Body phải là một object JSON';
const BODY_EXAMPLE_MESSAGE = 'Body phải là một object JSON, ví dụ: { "name": "Bàn phím cơ", "price": 120 }';

function parseLimit(url) {
  const limitParam = url.searchParams.get('limit');

  if (limitParam === null) {
    return { isValid: true, limit: null, message: null };
  }

  if (limitParam.trim() === '') {
    return { isValid: false, limit: null, message: 'Tham số "limit" không được để trống' };
  }

  const limit = Number(limitParam);

  if (!Number.isInteger(limit) || limit < 0) {
    return {
      isValid: false,
      limit: null,
      message: `Tham số "limit" phải là số nguyên không âm (nhận được: "${limitParam}")`
    };
  }

  return { isValid: true, limit: limit, message: null };
}

function hasValidPrice(body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'price')) {
    return true;
  }

  const { price } = body;

  return typeof price === 'number' && !Number.isNaN(price) && price >= 0;
}

async function readBodyOrSendError(request, response, invalidBodyMessage) {
  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      sendError(response, 400, 'Body không phải JSON hợp lệ');
      return null;
    }

    throw error;
  }

  if (!isValidBodyObject(body)) {
    sendError(response, 400, invalidBodyMessage);
    return null;
  }

  if (!hasValidPrice(body)) {
    sendError(response, 400, `Trường "price" phải là số không âm, nhận được: ${JSON.stringify(body.price)}`);
    return null;
  }

  return body;
}

function handleGetProducts(request, response, url) {
  const parsedLimit = parseLimit(url);

  if (parsedLimit.isValid === false) {
    sendError(response, 400, parsedLimit.message);
    return;
  }

  const products = repository.findAll(parsedLimit.limit);

  sendJSON(response, 200, products);
}

function handleGetProductById(request, response, rawId) {
  const productId = Number(rawId);
  const product = repository.findById(productId);

  if (product === null) {
    sendError(response, 404, `Không tìm thấy sản phẩm có id "${rawId}"`);
    return;
  }

  sendJSON(response, 200, product);
}

async function handleCreateProduct(request, response) {
  const body = await readBodyOrSendError(request, response, BODY_EXAMPLE_MESSAGE);

  if (body === null) {
    return;
  }

  const newProduct = repository.create(body);

  sendJSON(response, 201, newProduct);
}

async function handleReplaceProduct(request, response, rawId) {
  const body = await readBodyOrSendError(request, response, BODY_MESSAGE);

  if (body === null) {
    return;
  }

  const productId = Number(rawId);
  const replacedProduct = repository.replace(productId, body);

  if (replacedProduct === null) {
    sendError(response, 404, `Không tìm thấy sản phẩm có id "${rawId}"`);
    return;
  }

  sendJSON(response, 200, replacedProduct);
}

async function handlePatchProduct(request, response, rawId) {
  const body = await readBodyOrSendError(request, response, BODY_MESSAGE);

  if (body === null) {
    return;
  }

  const productId = Number(rawId);
  const updatedProduct = repository.patch(productId, body);

  if (updatedProduct === null) {
    sendError(response, 404, `Không tìm thấy sản phẩm có id "${rawId}"`);
    return;
  }

  sendJSON(response, 200, updatedProduct);
}

function handleDeleteProduct(request, response, rawId) {
  const productId = Number(rawId);
  const removedProduct = repository.remove(productId);

  if (removedProduct === null) {
    sendError(response, 404, `Không tìm thấy sản phẩm có id "${rawId}"`);
    return;
  }

  sendNoContent(response);
}

module.exports = {
  handleGetProducts,
  handleCreateProduct,
  handleGetProductById,
  handleReplaceProduct,
  handlePatchProduct,
  handleDeleteProduct
};
