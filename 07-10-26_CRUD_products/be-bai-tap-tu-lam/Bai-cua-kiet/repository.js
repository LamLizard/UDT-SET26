'use strict';

const dataSource = require('./memory-data-source');

function findProductIndexById(products, productId) {
  return products.findIndex((product) => product.id === productId);
}

function findAll(limit) {
  const data = dataSource.load();

  if (limit === null) {
    return data.products;
  }

  return data.products.slice(0, limit);
}

function findById(productId) {
  const data = dataSource.load();
  const index = findProductIndexById(data.products, productId);

  if (index === -1) {
    return null;
  }

  return data.products[index];
}

function create(body) {
  const data = dataSource.load();
  const newProduct = { ...body, id: data.currentId };

  data.currentId = data.currentId + 1;
  data.products.push(newProduct);
  dataSource.save(data);

  return newProduct;
}

function replace(productId, body) {
  const data = dataSource.load();
  const index = findProductIndexById(data.products, productId);

  if (index === -1) {
    return null;
  }

  const replacedProduct = { ...body, id: productId };

  data.products[index] = replacedProduct;
  dataSource.save(data);

  return replacedProduct;
}

function patch(productId, body) {
  const data = dataSource.load();
  const index = findProductIndexById(data.products, productId);

  if (index === -1) {
    return null;
  }

  const updatedProduct = { ...data.products[index], ...body, id: productId };

  data.products[index] = updatedProduct;
  dataSource.save(data);

  return updatedProduct;
}

function remove(productId) {
  const data = dataSource.load();
  const index = findProductIndexById(data.products, productId);

  if (index === -1) {
    return null;
  }

  const removedProduct = data.products[index];

  data.products.splice(index, 1);
  dataSource.save(data);

  return removedProduct;
}

module.exports = {
  findAll,
  findById,
  create,
  replace,
  patch,
  remove
};
