import { httpError } from '../http/index.js';

export function parseJsonEnv(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(500, 'INVALID_ENV_JSON', 'HEYBOX_SOURCE_HEADERS must be valid JSON');
  }
}
