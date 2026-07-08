import { httpError } from './utils.js';

export function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

export function json(payload, status = 200, options = {}) {
  const cacheControl = options.cacheControl || 'no-cache';
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl
    }
  });
}

export async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  if (text.length > 64_000) throw httpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}
