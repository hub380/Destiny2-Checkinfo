export function hasFailures(value) {
  return Array.isArray(value) && value.length > 0;
}

export function privacyLabel(value) {
  const number = Number(value);
  if (number === 1) return 'public';
  if (number === 2) return 'private';
  return 'none';
}
