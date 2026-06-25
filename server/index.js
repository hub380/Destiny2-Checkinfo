import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { handleAppRequest } from '../src/app/index.js';
import { serverGearDeps } from '../src/lib/gear/server-deps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
loadEnvFile(path.join(rootDir, '.env'));

const PORT = Number(process.env.PORT || 5173);
const DIST_DIR = path.join(rootDir, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const response = await handleAppRequest(toWebRequest(req, url), nodeEnv(), waitUntilContext());
      await sendWebResponse(res, response);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Unexpected server error'
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Destiny 2 Checkinfo running at http://localhost:${PORT}`);
});

function toWebRequest(req, url) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else if (value != null) {
      headers.set(key, String(value));
    }
  }

  const init = {
    method: req.method || 'GET',
    headers
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  return new Request(url, init);
}

function waitUntilContext() {
  return {
    waitUntil(promise) {
      Promise.resolve(promise).catch(() => undefined);
    }
  };
}

function nodeEnv() {
  return {
    ...process.env,
    GEAR_DEPS: serverGearDeps(process.env, {
      dataDir: path.join(rootDir, 'public', 'data', 'gear'),
      sourceAliasesFile: path.join(rootDir, 'content', 'gear', 'source-aliases.json')
    }),
    ASSETS: {
      fetch: fetchLocalAsset
    }
  };
}

async function fetchLocalAsset(request) {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname);
  const absolutePath = path.normalize(path.join(DIST_DIR, relativePath));
  if (!absolutePath.startsWith(DIST_DIR) || !existsSync(absolutePath)) {
    return new Response('Not found', { status: 404 });
  }
  const ext = path.extname(absolutePath).toLowerCase();
  return new Response(await readFile(absolutePath), {
    headers: {
      'content-type': MIME_TYPES[ext] || 'application/octet-stream'
    }
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

async function serveStatic(requestPath, res) {
  if (!existsSync(DIST_DIR)) {
    throw httpError(503, 'FRONTEND_NOT_BUILT', 'Frontend is not built. Run npm run build before starting the local server.');
  }

  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const decoded = decodeURIComponent(normalizedPath);
  const absolutePath = path.normalize(path.join(DIST_DIR, decoded));

  if (!absolutePath.startsWith(DIST_DIR)) {
    throw httpError(403, 'FORBIDDEN', 'Forbidden');
  }

  if (!existsSync(absolutePath)) {
    throw httpError(404, 'NOT_FOUND', 'Not found');
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const content = await readFile(absolutePath);
  const cacheControl = absolutePath.includes(`${path.sep}assets${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate';
  res.writeHead(200, {
    'content-type': MIME_TYPES[ext] || 'application/octet-stream',
    'cache-control': cacheControl
  });
  res.end(content);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache'
  });
  res.end(JSON.stringify(payload));
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
