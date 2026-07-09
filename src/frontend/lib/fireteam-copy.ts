const CHINESE_JOIN_COMMAND_PREFIX = '/\u52a0\u5165';
const ENGLISH_JOIN_COMMAND_PREFIX = '/join';

export function normalizeChineseJoinCommand(command?: string): string {
  const value = String(command || '').trim();
  if (!value) return '';

  const legacyShort = value.match(/^\/j\s+(.+)$/i);
  if (legacyShort) {
    return `${CHINESE_JOIN_COMMAND_PREFIX} ${legacyShort[1].trim()}`;
  }

  const legacyLong = value.match(/^\/join\s+(.+)$/i);
  if (legacyLong) {
    return `${CHINESE_JOIN_COMMAND_PREFIX} ${legacyLong[1].trim()}`;
  }

  return value;
}

export function normalizeJoinCommand(command?: string): string {
  return normalizeChineseJoinCommand(command);
}

export function joinCommandForCopy(joinCommand?: string, username?: string): string {
  const normalized = normalizeChineseJoinCommand(joinCommand);
  if (normalized) return normalized;

  const fallbackName = String(username || '').trim();
  return fallbackName ? `${CHINESE_JOIN_COMMAND_PREFIX} ${fallbackName}` : '';
}

export function englishJoinCommandForCopy(username?: string): string {
  const fallbackName = String(username || '').trim();
  return fallbackName ? `${ENGLISH_JOIN_COMMAND_PREFIX} ${fallbackName}` : '';
}
