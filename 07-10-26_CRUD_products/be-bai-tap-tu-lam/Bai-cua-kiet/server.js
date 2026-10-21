'use strict';

const http = require('http');
const { logRequest } = require('./middleware');
const router = require('./router');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const server = http.createServer((request, response) => {
  logRequest(request, response);
  router.handleRequest(request, response);
});

server.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại ${BASE_URL}`);
  console.log('   Nhấn Ctrl + C để dừng server.');
});
