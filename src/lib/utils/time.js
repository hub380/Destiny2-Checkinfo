export function parseTime(value) {
  if (!value) return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (number > 1_000_000_000_000) return new Date(number).toISOString();
    if (number > 1_000_000_000) return new Date(number * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function stableId(title, content, index) {
  const seed = `${title}|${content}|${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `item-${hash.toString(36)}`;
}
