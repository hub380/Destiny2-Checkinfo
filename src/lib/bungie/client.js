import { httpError, positiveNumber } from '../http/index.js';

export async function bungieFetch(pathname, options, env) {
  const { response, text } = await requestText(
    `https://www.bungie.net${pathname}`,
    {
      ...options,
      maxBytes: positiveNumber(env.BUNGIE_MAX_BYTES, 20_000_000),
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.BUNGIE_API_KEY,
        'accept-language': env.BUNGIE_LOCALE || 'zh-chs',
        ...(options.headers || {})
      }
    },
    env
  );

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw httpError(502, 'BUNGIE_INVALID_JSON', 'Bungie API returned invalid JSON');
  }

  if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
    throw httpError(response.ok ? 502 : response.status || 502, 'BUNGIE_API_ERROR', payload.Message || `Bungie API returned HTTP ${response.status}`);
  }
  return payload;
}

export async function requestText(url, options, env) {
  const { maxBytes = Number(env.HEYBOX_MAX_BYTES || 2_000_000), timeoutMs: requestTimeoutMs, ...fetchOptions } = options || {};
  const controller = new AbortController();
  const timeoutMs = Number(requestTimeoutMs || env.REQUEST_TIMEOUT_MS || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    const text = await response.text();
    if (text.length > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    return { response, text };
  } catch (error) {
    if (error.name === 'AbortError') throw httpError(504, 'REQUEST_TIMEOUT', 'External request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
