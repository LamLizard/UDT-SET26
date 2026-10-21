'use strict';

const { URL } = require('url');
const { checkToken, sendError } = require('./middleware');
const controller = require('./controller');

const BASE_URL = 'http://localhost:3000';

async function handleRequest(request, response) {
  const { method } = request;

  try {
    const url = new URL(request.url, BASE_URL);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length === 0 || segments[0] !== 'products') {
      sendError(response, 404, `Không tìm thấy tài nguyên ${method} ${url.pathname}`);
      return;
    }

    if (segments.length === 1) {
      if (method === 'GET') {
        await controller.handleGetProducts(request, response, url);
        return;
      }

      if (method === 'POST') {
        const isAllowed = checkToken(request, response);

        if (isAllowed === false) {
          return;
        }

        await controller.handleCreateProduct(request, response);
        return;
      }

      sendError(response, 404, `Không hỗ trợ phương thức ${method} cho /products`);
      return;
    }

    if (segments.length === 2) {
      const rawId = segments[1];

      if (method === 'GET') {
        await controller.handleGetProductById(request, response, rawId);
        return;
      }

      if (method === 'PUT') {
        const isAllowed = checkToken(request, response);

        if (isAllowed === false) {
          return;
        }

        await controller.handleReplaceProduct(request, response, rawId);
        return;
      }

      if (method === 'PATCH') {
        const isAllowed = checkToken(request, response);

        if (isAllowed === false) {
          return;
        }

        await controller.handlePatchProduct(request, response, rawId);
        return;
      }

      if (method === 'DELETE') {
        const isAllowed = checkToken(request, response);

        if (isAllowed === false) {
          return;
        }

        await controller.handleDeleteProduct(request, response, rawId);
        return;
      }

      sendError(response, 404, `Không hỗ trợ phương thức ${method} cho /products/:id`);
      return;
    }

    sendError(response, 404, `Không tìm thấy tài nguyên ${method} ${url.pathname}`);
  } catch (error) {
    console.error('Lỗi không mong đợi:', error);

    if (!response.headersSent) {
      sendError(response, 500, 'Lỗi máy chủ nội bộ');
    } else {
      response.end();
    }
  }
}

module.exports = { handleRequest };
