import { cleanText } from '../utils/index.js';

export function selectMembership(memberships) {
  return (
    memberships.find((item) => Number(item.crossSaveOverride) > 0 && Number(item.crossSaveOverride) === Number(item.membershipType)) ||
    memberships.find((item) => Number(item.crossSaveOverride) > 0) ||
    memberships[0]
  );
}

export function displayMembershipName(item) {
  if (item.bungieGlobalDisplayName) {
    return `${item.bungieGlobalDisplayName}#${String(item.bungieGlobalDisplayNameCode || '').padStart(4, '0')}`;
  }
  if (item.displayNameCode) return `${item.displayName}#${item.displayNameCode}`;
  return item.displayName || item.membershipId;
}

export function membershipTypeName(type) {
  const map = {
    '-1': '全部',
    1: 'Xbox',
    2: 'PlayStation',
    3: 'Steam',
    4: 'Battle.net',
    5: 'Stadia',
    6: 'Epic',
    10: 'Demon'
  };
  return map[type] || `平台 ${type}`;
}

export function bungieAssetUrl(pathname) {
  const path = cleanText(pathname);
  if (!path) return '';
  return path.startsWith('http') ? path : `https://www.bungie.net${path.startsWith('/') ? path : `/${path}`}`;
}

export function className(type) {
  return ['泰坦', '猎人', '术士'][Number(type)] || '未知职业';
}

export function raceName(type) {
  return ['人类', '觉醒者', 'EXO'][Number(type)] || '未知种族';
}

export function genderName(type) {
  return ['男性', '女性'][Number(type)] || '未知';
}
