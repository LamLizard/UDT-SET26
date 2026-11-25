'use strict';

const express = require('express');
const config = require('./src/config');
const db = require('./src/db');
const productRoutes = require('./src/routes/products');
const customerRoutes = require('./src/routes/customers');
const orderRoutes = require('./src/routes/orders');
const reportRoutes = require('./src/routes/reports');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', async (req, res) => {
    try {
      await db.getDb().command({ ping: 1 });
      res.json({ ok: true, database: db.getDb().databaseName });
    } catch (err) {
      res.status(503).json({ ok: false, error: err.message });
    }
  });

  app.use('/products', productRoutes);
  app.use('/customers', customerRoutes);
  app.use('/orders', orderRoutes);
  app.use('/reports', reportRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Khong co route ${req.method} ${req.originalUrl}` });
  });

  // Xu ly loi tap trung: E11000 -> 409, document validation -> 400, con lai -> 500
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.code === 11000 || err.code === 11001) {
      const field = err.keyValue ? Object.keys(err.keyValue)[0] : null;
      return res.status(409).json({
        error: 'DUPLICATE_KEY',
        message: `Gia tri${field ? ` cua "${field}"` : ''} da ton tai (E11000).`,
        keyValue: err.keyValue || null,
      });
    }

    if (err.code === 121) {
      return res.status(400).json({
        error: 'DOCUMENT_VALIDATION_FAILED',
        message: err.message,
      });
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'INVALID_JSON', message: 'Body khong phai JSON hop le.' });
    }

    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err);
    return res.status(status).json({
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Loi khong xac dinh.',
    });
  });

  return app;
}

async function start({ port = config.port } = {}) {
  await db.connect();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });
  console.log(`[server] dang chay: http://127.0.0.1:${server.address().port} (db: ${db.getDb().databaseName})`);
  return { app, server };
}

if (require.main === module) {
  let started = null;

  start()
    .then((value) => {
      started = value;
    })
    .catch((err) => {
      console.error('[server] khong the khoi dong:', err.message);
      process.exit(1);
    });

  const shutdown = async (signal) => {
    console.log(`\n[server] nhan ${signal}, dang tat...`);
    if (started) {
      await new Promise((resolve) => started.server.close(resolve));
    }
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { createApp, start };
