import { BUNGIE_BASE_URL } from './constants.js';
import { httpError } from './utils.js';

export async function bungieFetchJson(pathOrUrl, deps) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BUNGIE_BASE_URL}${pathOrUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs || 30000);
  const maxBytes = deps.maxBytes || 80_000_000;

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'x-api-key': deps.apiKey,
        'accept-language': deps.locale || 'zh-chs',
        'content-type': 'application/json'
      }
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw httpError(502, 'GEAR_SOURCE_TOO_LARGE', `Bungie Manifest response is larger than ${maxBytes} bytes`);
    }
    const text = await response.text();
    if (text.length > maxBytes) {
      throw httpError(502, 'GEAR_SOURCE_TOO_LARGE', `Bungie Manifest response is larger than ${maxBytes} bytes`);
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw httpError(502, 'BUNGIE_INVALID_JSON', 'Bungie API returned invalid JSON');
    }
    if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
      throw httpError(response.ok ? 502 : response.status || 502, 'BUNGIE_API_ERROR', payload.Message || `Bungie API returned HTTP ${response.status}`);
    }
    return payload.Response && pathOrUrl.includes('/Platform/') ? payload : payload;
  } catch (error) {
    if (error.name === 'AbortError') throw httpError(504, 'REQUEST_TIMEOUT', 'Bungie Manifest request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
