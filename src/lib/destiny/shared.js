import { bungieFetch } from '../bungie/index.js';
import { positiveNumber } from '../http/index.js';
export async function fetchCharacterRefs(membership, env) {
  const profile = await bungieFetch(
    `/Platform/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200`,
    { method: 'GET' },
    env
  );
  return normalizeCharacterRefs(Object.values(profile.Response?.characters?.data || {}));
}

export function normalizeCharacterRefs(characters) {
  return (Array.isArray(characters) ? characters : [])
    .map((character) => ({
      id: String(character?.id || character?.characterId || '')
    }))
    .filter((character) => character.id);
}

export function attachEndgameToCareer(career, endgamePayload) {
  const endgame = endgamePayload.endgame || endgamePayload;
  career.endgame = {
    ...(career.endgame || {}),
    ...endgame
  };
  career.stats = career.stats || {};
  if (endgame.raid?.total) career.stats.raid = endgame.raid.total;
  if (endgame.dungeon?.total) career.stats.dungeon = endgame.dungeon.total;
  career.cache = {
    ...(career.cache || {}),
    ...(endgamePayload.cache || {})
  };
  return career;
}

export function normalizeEndgameModes(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : ['raid', 'dungeon'];
  const modes = raw.map((item) => String(item || '').toLowerCase()).filter((item) => item === 'raid' || item === 'dungeon' || item === 'pvp');
  return Array.from(new Set(modes.length ? modes : ['raid', 'dungeon']));
}

export function historyPageLimit(modeName, env) {
  if (modeName === 'pvp') {
    return positiveNumber(env.PVP_HISTORY_PAGE_LIMIT, positiveNumber(env.ENDGAME_HISTORY_PAGE_LIMIT, 50));
  }
  return positiveNumber(env.ENDGAME_HISTORY_PAGE_LIMIT, 50);
}

export function historyPageSize(modeName, env) {
  if (modeName === 'pvp') {
    return positiveNumber(env.PVP_HISTORY_PAGE_SIZE, positiveNumber(env.ENDGAME_HISTORY_PAGE_SIZE, 250));
  }
  return positiveNumber(env.ENDGAME_HISTORY_PAGE_SIZE, 250);
}

export function buildEndgameStatsPatch(endgame) {
  const patch = {};
  if (endgame.raid?.total) patch.raid = endgame.raid.total;
  if (endgame.dungeon?.total) patch.dungeon = endgame.dungeon.total;
  return patch;
}