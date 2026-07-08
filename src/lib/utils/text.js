/* eslint-disable no-irregular-whitespace */
export function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/ /g, ' ')
    .trim();
}

export function extractDestinyName(text) {
  const normalized = cleanText(String(text || '').replace(/^\/j\s+/i, ''));
  // Strict: name at word boundary; allows ASCII, Latin-ext, Cyrillic, CJK, and spaces within name
  const strict = normalized.match(
    /(?:^|[\s:：,，;；])([A-Za-z0-9_\-.()[\]À-ɏЀ-ӿ一-鿿 ]{1,32}#\d{3,8})(?=$|[\s,，;；])/u
  );
  if (strict?.[1]) return strict[1].trim();
  // Loose fallback: first char non-whitespace/non-separator; rest allows internal spaces
  const loose = normalized.match(/([^\s#,:：，;；][^#,:：，;；]{0,31}#\d{3,8})/u);
  return loose?.[1]?.trim() || '';
}

export function parseBungieName(input) {
  const text = String(input || '')
    .replace(/[\u00A0\u807D]/g, ' ')
    .trim();
  const match = text.match(/^(.{1,32})#(\d{3,8})$/u);
  if (!match) return null;
  return {
    displayName: match[1].trim(),
    displayNameCode: Number(match[2])
  };
}

export function tryParseJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
