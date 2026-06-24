export function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function extractDestinyName(text) {
  const normalized = cleanText(String(text || '').replace(/^\/j\s+/i, ''));
  const strict = normalized.match(/(?:^|[\s:：,，;；])([A-Za-z0-9_\-.()[\]\u4e00-\u9fff ]{1,32}#\d{3,8})(?=$|[\s,，;；])/u);
  if (strict?.[1]) return strict[1].trim();
  const loose = normalized.match(/([^\s#,:：，;；]{1,32}#\d{3,8})/u);
  return loose?.[1]?.trim() || '';
}

export function parseBungieName(input) {
  const text = cleanText(input);
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
