'use strict';

let storage = {
  products: [],
  currentId: 1
};

function load() {
  return storage;
}

function save(data) {
  storage = data;
}

module.exports = { load, save };
