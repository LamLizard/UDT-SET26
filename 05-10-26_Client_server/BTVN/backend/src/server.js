const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadConfig } = require('./config');
const { initCsvFiles } = require('./utils/csvUtils');
const { HttpError, sendError } = require('./utils/responseUtils');
const { authenticate } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userStore = require('./store/userStore');

// Turn "/api/tasks/:id" into a regex plus a list of parameter names.
const routes = [...authRoutes, ...taskRoutes].map((route) => {
  const paramNames = [];
  const pattern = route.path.replace(/:([A-Za-z]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { ...route, regex: new RegExp(`^${pattern}$`), paramNames };
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') return resolve({});
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reject(new HttpError(400, 'Malformed JSON in request body'));
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject(new HttpError(400, 'Request body must be a JSON object'));
      }
      resolve(parsed);
    });
  });
}

async function handleApi(req, res, url) {
  const route = routes.find((r) => r.method === req.method && r.regex.test(url.pathname));
  if (!route) throw new HttpError(404, 'API endpoint not found');

  const match = route.regex.exec(url.pathname);
  const params = {};
  route.paramNames.forEach((name, i) => {
    try {
      params[name] = decodeURIComponent(match[i + 1]);
    } catch {
      throw new HttpError(400, 'Invalid URL parameter');
    }
  });

  const ctx = { req, res, params, query: Object.fromEntries(url.searchParams), body: {}, user: null };
  if (route.protect) ctx.user = await authenticate(req);
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) ctx.body = await readJsonBody(req);

  await route.handler(ctx);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

// Minimal static file server for the frontend folder. Because it runs on the same
// origin as the API, the browser needs no CORS setup.
async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(404, 'Not found');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new HttpError(400, 'Bad request');
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: '/page/login.html' });
    res.end();
    return;
  }

  const frontendDir = loadConfig().frontendDir;
  const target = path.resolve(frontendDir, `.${pathname}`);
  if (!target.startsWith(frontendDir + path.sep)) throw new HttpError(404, 'Not found');

  const mime = MIME_TYPES[path.extname(target).toLowerCase()];
  if (!mime) throw new HttpError(404, 'Not found');

  let content;
  try {
    content = await fs.readFile(target);
  } catch {
    throw new HttpError(404, 'Not found');
  }

  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length });
  res.end(req.method === 'HEAD' ? undefined : content);
}

function handleError(res, err) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const isHttpError = err instanceof HttpError;
  if (!isHttpError) console.error('Unexpected error:', err); // details stay on the server
  const status = isHttpError ? err.statusCode : 500;
  const message = isHttpError ? err.message : 'Internal server error';
  sendError(res, status, message, isHttpError ? err.extra : {});
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (err) {
    handleError(res, err);
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err && err.message ? err.message : err);
});

async function main() {
  try {
    const config = loadConfig();
    await initCsvFiles();
    await userStore.load();
    createServer().listen(config.port, () => {
      console.log(`Server running at http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createServer };
