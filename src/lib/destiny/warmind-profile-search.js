import { cleanText, parseBungieName } from '../utils/index.js';
import { membershipTypeName, bungieAssetUrl } from '../bungie/index.js';

const WARMIND_PROFILE_SEARCH_URL = 'https://api.warmind.io/in/profileSearch';

const PLATFORM_ICON_PATHS = {
  1: '/img/theme/bungienet/icons/xboxLiveLogo.png',
  2: '/img/theme/bungienet/icons/psnLogo.png',
  3: '/img/theme/bungienet/icons/steamLogo.png',
  5: '/img/theme/bungienet/icons/stadiaLogo.png',
  6: '/img/theme/bungienet/icons/egsLogo.png'
};

export async function searchWarmindProfilesByName(query, env = {}) {
  if (String(env.WARMIND_PROFILE_SEARCH_DISABLED || '').toLowerCase() === 'true') return [];

  const text = cleanText(query);
  if (!text) return [];

  const response = await fetch(`${WARMIND_PROFILE_SEARCH_URL}?q=${encodeURIComponent(text)}`, {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) return [];

  const payload = await response.json();
  const rows = Array.isArray(payload?.response) ? payload.response : [];
  return rows
    .map(normalizeWarmindProfile)
    .filter(Boolean)
    .sort((a, b) => {
      const lastPlayedDiff = Date.parse(b.lastPlayed || '') - Date.parse(a.lastPlayed || '');
      if (Number.isFinite(lastPlayedDiff) && lastPlayedDiff !== 0) return lastPlayedDiff;
      return Number(b.hoursPlayed || 0) - Number(a.hoursPlayed || 0);
    });
}

export function normalizeWarmindProfile(row) {
  const membershipId = cleanText(row?.membershipId);
  const membershipType = Number(row?.membershipType || 0);
  const parsed = parseBungieName(row?.displayName || '');
  const displayName = cleanText(row?.baseBungieName || parsed?.displayName || row?.displayName || row?.platformName);
  const displayNameCode = Number(parsed?.displayNameCode || 0);
  if (!membershipId || !membershipType || !displayName || !displayNameCode) return null;

  const iconPath = PLATFORM_ICON_PATHS[membershipType] || '';
  return {
    bungieName: `${displayName}#${String(displayNameCode).padStart(4, '0')}`,
    displayName,
    displayNameCode,
    membershipType,
    membershipTypeName: membershipTypeName(membershipType),
    membershipId,
    displayMembershipName: cleanText(row?.platformName || displayName),
    crossSaveOverride: 0,
    isPublic: true,
    icon: bungieAssetUrl(iconPath),
    source: 'warmind',
    lastPlayed: cleanText(row?.lastPlayed),
    hoursPlayed: Number(row?.hoursPlayed || 0),
    linkedAccounts: [
      {
        displayName: cleanText(row?.platformName || displayName),
        membershipType,
        membershipTypeName: membershipTypeName(membershipType),
        membershipId,
        crossSaveOverride: 0,
        isPublic: true,
        icon: bungieAssetUrl(iconPath),
        source: 'warmind',
        lastPlayed: cleanText(row?.lastPlayed),
        hoursPlayed: Number(row?.hoursPlayed || 0)
      }
    ]
  };
}
