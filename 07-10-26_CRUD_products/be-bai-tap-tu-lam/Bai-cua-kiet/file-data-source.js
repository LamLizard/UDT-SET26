'use strict';

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'products.json');

function createEmptyStorage() {
  return {
    products: [],
    currentId: 1
  };
}

function load() {
  if (!fs.existsSync(FILE_PATH)) {
    const emptyStorage = createEmptyStorage();

    save(emptyStorage);

    return emptyStorage;
  }

  const rawText = fs.readFileSync(FILE_PATH, 'utf8');

  return JSON.parse(rawText);
}

function save(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { load, save };
