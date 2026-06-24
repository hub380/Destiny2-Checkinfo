import { cleanText as baseCleanText } from '../utils/index.js';
import { httpError } from '../http/index.js';

export { httpError };

export function cleanText(value) {
  return baseCleanText(value);
}

export function normalizeText(value) {
  return cleanText(value)
    .toLocaleLowerCase('zh-CN')
    .normalize('NFKC');
}
export function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

export function uniqueByHash(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item?.hash || seen.has(item.hash)) continue;
    seen.add(item.hash);
    output.push(item);
  }
  return output;
}

export function uniqueNumbers(items) {
  return Array.from(new Set(items.filter((item) => Number.isFinite(Number(item))).map(Number)));
}

export function requireApiKey(deps) {
  if (!deps?.apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询装备数据');
  }
}
