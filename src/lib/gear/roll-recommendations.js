import { perkPairKey } from './factories.js';
import { normalizeText } from './utils.js';

const TRAIT_SOCKET_INDEXES = new Set([3, 4]);
const MAX_PERKS_PER_SOCKET = 2;

const PROFILES = [
  {
    id: 'pve-clear',
    mode: 'pve',
    label: '\u6e05\u602a',
    role: 'add-clear',
    keywords: [
      'voltshot', 'incandescent', 'destabilizing rounds', 'chain reaction',
      'dragonfly', 'firefly', 'headstone', 'hatchling', 'kinetic tremors',
      'reservoir burst', 'subsistence', 'demolitionist', 'feeding frenzy',
      '\u4f0f\u7279\u5b50\u5f39', '\u767d\u70bd\u5f39\u836f', '\u4e0d\u7a33\u5b9a\u5f39\u836f',
      '\u8fde\u9501\u53cd\u5e94', '\u8725\u8734', '\u8424\u706b\u866b', '\u5893\u7891',
      '\u5b75\u5316', '\u52a8\u80fd\u9707\u98a4', '\u6c34\u5e93\u7206\u70b8',
      '\u7ef4\u6301\u751f\u8ba1', '\u7206\u7834\u4e13\u5bb6', '\u5582\u98df\u72c2\u70ed'
    ],
    effectKeywords: [
      'nearby targets', 'nearby enemies', 'combatants', 'explosion', 'explode',
      'jolt', 'scorch', 'volatile', 'spread', 'refills the magazine',
      '\u9644\u8fd1\u76ee\u6807', '\u9644\u8fd1\u654c\u4eba', '\u6218\u6597\u4eba\u5458',
      '\u7206\u70b8', '\u7206\u70b8\u4f24\u5bb3', '\u9707\u8361', '\u707c\u70e7',
      '\u6613\u7206', '\u6269\u6563', '\u586b\u88c5\u5f39\u836f'
    ]
  },
  {
    id: 'pve-damage',
    mode: 'pve',
    label: '\u8f93\u51fa',
    role: 'damage',
    keywords: [
      'bait and switch', 'firing line', 'explosive light', 'controlled burst',
      'precision instrument', 'surrounded', 'vorpal weapon', 'target lock',
      'one for all', 'frenzy', 'golden tricorn', 'sword logic', 'reconstruction',
      'envious assassin', 'envious arsenal', 'auto-loading holster',
      '\u8bf1\u9975\u5207\u6362', '\u706b\u529b\u7ebf', '\u7206\u70b8\u5149\u80fd',
      '\u53d7\u63a7\u70b9\u5c04', '\u7cbe\u51c6\u5de5\u5177', '\u56db\u9762\u53d7\u654c',
      '\u9996\u9886\u89c4\u683c', '\u76ee\u6807\u9501\u5b9a', '\u4e00\u4e3a\u5168',
      '\u72c2\u4e71', '\u91d1\u8272\u4e09\u89d2', '\u5251\u903b\u8f91', '\u91cd\u5efa',
      '\u5ac9\u5992\u523a\u5ba2', '\u5ac9\u5992\u519b\u706b', '\u81ea\u52a8\u88c5\u586b\u67aa\u5957'
    ],
    effectKeywords: [
      'increased damage', 'bonus damage', 'damage bonus', 'precision hits',
      'final blows increase', 'reloads this weapon', 'overflow the magazine',
      '\u63d0\u9ad8\u4f24\u5bb3', '\u989d\u5916\u4f24\u5bb3', '\u4f24\u5bb3\u52a0\u6210',
      '\u7cbe\u51c6\u547d\u4e2d', '\u6700\u540e\u4e00\u51fb\u63d0\u9ad8',
      '\u91cd\u65b0\u88c5\u586b\u6b64\u6b66\u5668', '\u5f39\u836f\u5bb9\u91cf'
    ]
  },
  {
    id: 'pvp',
    mode: 'pvp',
    label: 'PvP',
    role: 'dueling',
    keywords: [
      'rangefinder', 'opening shot', 'eye of the storm', 'zen moment',
      'moving target', 'keep away', 'slideshot', 'slideways', 'snapshot sights',
      'dynamic sway reduction', 'tap the trigger', 'perpetual motion',
      'killing wind', 'threat detector', 'under pressure', 'firmly planted',
      '\u6d4b\u8ddd\u4eea', '\u9996\u53d1\u5c04\u51fb', '\u98ce\u66b4\u4e4b\u773c',
      '\u7985\u610f\u65f6\u523b', '\u79fb\u52a8\u76ee\u6807', '\u8fdc\u79bb',
      '\u6ed1\u884c\u5c04\u51fb', '\u6ed1\u52a8\u65b9\u5f0f', '\u5feb\u7167\u77c4\u51c6\u955c',
      '\u52a8\u6001\u51cf\u6446', '\u6263\u52a8\u6273\u673a', '\u6c38\u52a8\u4e0d\u6b62',
      '\u6740\u622e\u4e4b\u98ce', '\u5a01\u80c1\u63a2\u6d4b\u5668', '\u538b\u529b\u4e4b\u4e0b',
      '\u7a33\u56fa\u6839\u57fa'
    ],
    effectKeywords: [
      'accuracy', 'aim assist', 'range', 'stability', 'handling', 'duel',
      'while moving', 'while sliding', 'when crouched',
      '\u7cbe\u51c6\u5ea6', '\u8f85\u52a9\u7784\u51c6', '\u5c04\u7a0b', '\u7a33\u5b9a\u6027',
      '\u64cd\u63a7\u6027', '\u79fb\u52a8\u65f6', '\u6ed1\u884c\u65f6', '\u8e72\u4e0b\u65f6'
    ]
  }
];

export function buildRollRecommendations(gearIndex, overlays = []) {
  const perkByHash = buildPerkMap(gearIndex);
  const generated = new Map();

  for (const weaponRecord of gearIndex.weapons || []) {
    const sockets = recommendationSockets(weaponRecord, perkByHash);
    if (sockets.length < 2) continue;
    generated.set(Number(weaponRecord.hash), {
      weaponHash: Number(weaponRecord.hash),
      recommendations: PROFILES.map((profile) => buildProfile(profile, sockets))
    });
  }

  for (const overlay of overlays || []) {
    const weaponHash = Number(overlay?.weaponHash || overlay?.hash);
    if (!Number.isFinite(weaponHash) || !Array.isArray(overlay?.recommendations)) continue;
    if (overlay.mergeStrategy === 'append') {
      const current = generated.get(weaponHash) || { weaponHash, recommendations: [] };
      generated.set(weaponHash, {
        ...current,
        weaponHash,
        recommendations: mergeRecommendations(current.recommendations, overlay.recommendations)
      });
      continue;
    }
    generated.set(weaponHash, { ...overlay, weaponHash });
  }

  return Array.from(generated.values()).sort((a, b) => a.weaponHash - b.weaponHash);
}

function mergeRecommendations(base = [], additions = []) {
  const byId = new Map();
  for (const recommendation of [...base, ...additions]) {
    const id = String(recommendation?.id || '').trim();
    if (!id) continue;
    byId.set(id, recommendation);
  }
  return Array.from(byId.values());
}

function buildPerkMap(gearIndex) {
  const byHash = new Map();
  for (const item of (gearIndex.items || []).filter((entry) => entry.kind === 'perk')) {
    byHash.set(Number(item.hash), item);
  }
  for (const plug of gearIndex.weaponPlugs || []) byHash.set(Number(plug.hash), plug);
  return byHash;
}

function recommendationSockets(weaponRecord, perkByHash) {
  return (weaponRecord.sockets || [])
    .filter((socket) => TRAIT_SOCKET_INDEXES.has(Number(socket.socketIndex)))
    .map((socket) => ({
      socketIndex: Number(socket.socketIndex),
      label: String(socket.label || ''),
      perks: basePerks(socket.perks || [], perkByHash)
    }))
    .filter((socket) => socket.perks.length);
}

function basePerks(entries, perkByHash) {
  const byPair = new Map();
  for (const entry of entries) {
    const perk = typeof entry === 'number' ? perkByHash.get(entry) : entry;
    if (!perk?.hash) continue;
    const key = perkPairKey(perk) || String(perk.hash);
    const current = byPair.get(key);
    if (!current || (current.enhanced && !perk.enhanced)) byPair.set(key, perk);
  }
  return Array.from(byPair.values());
}

function buildProfile(profile, sockets) {
  return {
    id: profile.id,
    mode: profile.mode,
    label: profile.label,
    source: 'local-heuristic',
    confidence: 'baseline',
    notes: '\u57fa\u4e8e Manifest \u8bcd\u6761\u6548\u679c\u81ea\u52a8\u751f\u6210\uff0c\u793e\u533a\u6570\u636e\u5bfc\u5165\u540e\u4f1a\u88ab\u8986\u76d6\u3002',
    sockets: sockets.map((socket) => ({
      socketIndex: socket.socketIndex,
      label: socket.label,
      role: profile.role,
      perkHashes: selectPerks(socket.perks, profile)
    }))
  };
}

function selectPerks(perks, profile) {
  return perks
    .map((perk, index) => ({ perk, index, score: perkScore(perk, profile) }))
    .sort((a, b) => b.score - a.score || a.index - b.index || Number(a.perk.hash) - Number(b.perk.hash))
    .slice(0, MAX_PERKS_PER_SOCKET)
    .map((entry) => Number(entry.perk.hash));
}

function perkScore(perk, profile) {
  const name = normalizeText(perk.name || '');
  const description = normalizeText(perk.description || '');
  let score = 0;
  for (const keyword of profile.keywords) {
    const normalized = normalizeText(keyword);
    if (name.includes(normalized)) score += 12;
    else if (description.includes(normalized)) score += 5;
  }
  for (const keyword of profile.effectKeywords) {
    if (description.includes(normalizeText(keyword))) score += 2;
  }
  return score;
}
