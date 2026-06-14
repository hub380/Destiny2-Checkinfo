const BUNGIE_BASE_URL = 'https://www.bungie.net';
const WEAPON_CATEGORY = 1;
const ARMOR_CATEGORY = 20;
const KINETIC_WEAPON = 2;
const ENERGY_WEAPON = 3;
const POWER_WEAPON = 4;
const HELMET = 45;
const ARMS = 46;
const CHEST = 47;
const LEGS = 48;
const CLASS_ITEM = 49;
const ITEM_TYPE_ARMOR = 2;
const ITEM_TYPE_WEAPON = 3;
const TRAIT_CATEGORY = 3708671066;
const EMPTY_TRAIT_SOCKET = '空特征插槽';
const ADEPT_SUFFIX = '（专家）';
const GEAR_INDEX_VERSION = 'gear-index-v4';

export async function getGearSearch(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  if (!query) {
    throw httpError(400, 'INVALID_GEAR_QUERY', '请输入武器、护甲或 perk 名称');
  }

  const kind = normalizeGearKind(body?.kind || body?.type || 'all');
  const limit = clampNumber(body?.limit, 1, 120, 60);
  const cached = await getGearIndex(deps);
  const terms = normalizeText(query);

  const candidates = cached.value.items.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false;
    return item.searchText.includes(terms) || String(item.hash) === query;
  });

  const items = candidates
    .sort((a, b) => scoreGearItem(a, terms, query) - scoreGearItem(b, terms, query) || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit)
    .map(publicGearItem);

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: cached.value.manifestVersion,
    query,
    kind,
    total: candidates.length,
    items,
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

export async function getGearItem(body, deps) {
  requireApiKey(deps);
  const hash = cleanText(body?.hash || '');
  if (!hash) {
    throw httpError(400, 'INVALID_GEAR_HASH', '请输入装备 hash');
  }

  const cached = await getGearIndex(deps);
  const index = cached.value;
  const item = index.items.find((entry) => String(entry.hash) === hash);
  if (!item) {
    throw httpError(404, 'GEAR_ITEM_NOT_FOUND', '没有找到这个装备');
  }

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    item: publicGearItem(item),
    detail: publicGearDetail(item, index),
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

export async function getPerkWeapons(body, deps) {
  requireApiKey(deps);
  const query = cleanText(body?.query || body?.name || '');
  const hash = cleanText(body?.hash || '');
  if (!query && !hash) {
    throw httpError(400, 'INVALID_PERK_QUERY', '请输入 perk 名称或 hash');
  }

  const limit = clampNumber(body?.limit, 1, 120, 80);
  const cached = await getGearIndex(deps);
  const index = cached.value;
  const terms = normalizeText(query);
  const perkMatches = index.items
    .filter((item) => item.kind === 'perk')
    .filter((item) => (hash ? String(item.hash) === hash : item.searchText.includes(terms)))
    .sort((a, b) => scoreGearItem(a, terms, hash || query) - scoreGearItem(b, terms, hash || query) || a.name.localeCompare(b.name, 'zh-CN'));

  const perkHashes = new Set(perkMatches.map((item) => item.hash));
  const perkByHash = perkMap(index);
  const groups = new Map();

  for (const weapon of index.weapons) {
    const sockets = publicWeaponSockets(weapon, perkByHash, perkHashes);
    const matchedPerks = uniqueByHash(sockets.flatMap((socket) => socket.perks.filter((perk) => perk.matched)));

    if (!matchedPerks.length) continue;

    const key = [weapon.baseName, weapon.weaponType, weapon.ammo, weapon.element].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        name: weapon.baseName,
        weaponType: weapon.weaponType,
        ammo: weapon.ammo,
        element: weapon.element,
        variants: [],
        canRoll: {
          normal: false,
          enhanced: false
        }
      });
    }

    const group = groups.get(key);
    const variant = {
      hash: weapon.hash,
      name: weapon.name,
      adept: weapon.adept,
      icon: weapon.icon,
      stats: weapon.stats || [],
      screenshot: weapon.screenshot || '',
      sockets,
      matchedPerks: matchedPerks.map(publicPerkRef)
    };
    for (const perk of matchedPerks) {
      group.canRoll.normal = group.canRoll.normal || !perk.enhanced;
      group.canRoll.enhanced = group.canRoll.enhanced || perk.enhanced || perk.enhancedMatched || Boolean(perk.enhancedOptions?.length);
    }
    group.variants.push(variant);
  }

  const weapons = Array.from(groups.values())
    .map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) => Number(a.adept) - Number(b.adept) || a.name.localeCompare(b.name, 'zh-CN'))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    manifestVersion: index.manifestVersion,
    query: query || hash,
    perks: perkMatches.map(publicGearItem),
    total: groups.size,
    weapons,
    cache: {
      gearIndex: cached.status,
      gearIndexCachedAt: cached.cachedAt,
      gearIndexTtlSeconds: cached.ttlSeconds
    }
  };
}

async function getGearIndex(deps) {
  const locale = deps.locale || 'zh-chs';
  const cacheKey = ['gear', GEAR_INDEX_VERSION, locale].join(':');
  return deps.getCachedJson(
    cacheKey,
    deps.cacheTtlSeconds || 604800,
    async () => (await loadStaticGearIndex(deps)) || buildGearIndex(deps),
    { persistLarge: true, noClone: true, memoryOnly: true }
  );
}

async function loadStaticGearIndex(deps) {
  if (deps.disableStaticIndex || typeof deps.loadStaticGearIndex !== 'function') return null;
  const index = await deps.loadStaticGearIndex();
  if (!index?.items || !index?.weapons) return null;
  return index;
}

export async function buildGearIndex(deps) {
  const locale = deps.locale || 'zh-chs';
  const manifest = await bungieFetchJson('/Platform/Destiny2/Manifest/', deps);
  const paths =
    manifest.Response?.jsonWorldComponentContentPaths?.[locale] ||
    manifest.Response?.jsonWorldComponentContentPaths?.['zh-chs'] ||
    manifest.Response?.jsonWorldComponentContentPaths?.en;

  if (!paths?.DestinyInventoryItemDefinition || !paths?.DestinyPlugSetDefinition) {
    throw httpError(502, 'MANIFEST_PATH_MISSING', 'Bungie Manifest 缺少装备定义表');
  }

  const [items, plugSets, damageTypes, statDefs, itemSets, sandboxPerks, collectibles, recordDefs] = await Promise.all([
    bungieFetchJson(paths.DestinyInventoryItemDefinition, deps),
    bungieFetchJson(paths.DestinyPlugSetDefinition, deps),
    paths.DestinyDamageTypeDefinition ? bungieFetchJson(paths.DestinyDamageTypeDefinition, deps) : Promise.resolve({}),
    paths.DestinyStatDefinition ? bungieFetchJson(paths.DestinyStatDefinition, deps) : Promise.resolve({}),
    paths.DestinyEquipableItemSetDefinition ? bungieFetchJson(paths.DestinyEquipableItemSetDefinition, deps) : Promise.resolve({}),
    paths.DestinySandboxPerkDefinition ? bungieFetchJson(paths.DestinySandboxPerkDefinition, deps) : Promise.resolve({}),
    paths.DestinyCollectibleDefinition ? bungieFetchJson(paths.DestinyCollectibleDefinition, deps) : Promise.resolve({}),
    paths.DestinyRecordDefinition ? bungieFetchJson(paths.DestinyRecordDefinition, deps) : Promise.resolve({})
  ]);

  const records = [];
  const weapons = [];
  const armors = [];
  const weaponPlugs = new Map();
  const itemSetByItemHash = makeItemSetMap(itemSets, sandboxPerks);
  const craftingInfoByHash = makeCraftingInfoMap(items, collectibles, recordDefs);
  const craftables = makeCraftableRecords(items, craftingInfoByHash);

  for (const definition of Object.values(items)) {
    if (!definition || definition.redacted) continue;

    if (isWeapon(definition)) {
      const item = makeWeaponItem(definition, damageTypes, craftingInfoByHash);
      records.push(item);
      weapons.push(makeWeaponRecord(definition, item, items, plugSets, statDefs, weaponPlugs, craftingInfoByHash));
      continue;
    }

    if (isArmor(definition)) {
      const item = makeArmorItem(definition);
      records.push(item);
      armors.push(makeArmorRecord(definition, item, items, itemSetByItemHash, statDefs));
      continue;
    }

    if (isTraitPlug(definition)) {
      records.push(makePerkItem(definition, statDefs));
    }
  }

  return {
    indexVersion: GEAR_INDEX_VERSION,
    locale,
    manifestVersion: manifest.Response?.version || null,
    builtAt: new Date().toISOString(),
    items: records,
    weapons,
    armors,
    craftables,
    weaponPlugs: Array.from(weaponPlugs.values())
  };
}

function makeCraftingInfoMap(items, collectibles, recordDefs) {
  const patternRecords = new Map();
  for (const record of Object.values(recordDefs || {})) {
    const name = displayName(record);
    const description = cleanText(displayDescription(record)).toLowerCase();
    if (!name || !Array.isArray(record.objectiveHashes) || !record.objectiveHashes.length) continue;
    if (!isPatternRecordDescription(description)) continue;
    if (!patternRecords.has(name)) {
      patternRecords.set(name, {
        hash: Number(record.hash),
        objectiveHash: Number(record.objectiveHashes[0])
      });
    }
  }

  const output = new Map();
  for (const definition of Object.values(items || {})) {
    if (!definition || definition.redacted || !definition.crafting?.outputItemHash) continue;
    const hash = Number(definition.hash);
    const name = displayName(definition);
    const outputDefinition = items[String(definition.crafting.outputItemHash)] || definition;
    const collectibleHash = Number(outputDefinition.collectibleHash || definition.collectibleHash || 0);
    const collectible = collectibleHash ? collectibles?.[String(collectibleHash)] : null;
    const patternRecord = patternRecords.get(name) || patternRecords.get(displayName(outputDefinition)) || null;
    output.set(hash, {
      source: cleanSourceLabel(collectible?.sourceString) || cleanSourceLabel(outputDefinition.displaySource) || sourceFromTraits(definition),
      sourceHash: Number(collectible?.sourceHash || 0),
      patternRecordHash: patternRecord?.hash || 0,
      patternObjectiveHash: patternRecord?.objectiveHash || 0,
      outputItemHash: Number(definition.crafting.outputItemHash || 0),
      outputCollectibleHash: collectibleHash,
      watermark: imageUrl(definition.iconWatermark || outputDefinition.iconWatermark || '')
    });
  }
  return output;
}

function makeCraftableRecords(items, craftingInfoByHash) {
  return Array.from(craftingInfoByHash.entries())
    .map(([hash, craftingInfo]) => {
      const definition = items[String(hash)];
      if (!definition || definition.redacted) return null;
      return {
        kind: 'craftable',
        hash,
        name: displayName(definition),
        icon: iconUrl(definition),
        type: definition.itemTypeDisplayName || '',
        weaponType: definition.itemTypeDisplayName || '',
        tier: definition.inventory?.tierTypeName || '',
        source: craftingInfo.source,
        sourceHash: craftingInfo.sourceHash,
        patternRecordHash: craftingInfo.patternRecordHash,
        patternObjectiveHash: craftingInfo.patternObjectiveHash,
        outputItemHash: craftingInfo.outputItemHash,
        outputCollectibleHash: craftingInfo.outputCollectibleHash,
        watermark: craftingInfo.watermark
      };
    })
    .filter(Boolean);
}

function isPatternRecordDescription(description) {
  if (!description) return false;
  return (
    (description.includes('深视') && description.includes('模式')) ||
    (description.includes('deepsight') && description.includes('pattern'))
  );
}

function cleanSourceLabel(value) {
  return cleanText(value)
    .replace(/^来源[:：]\s*/i, '')
    .replace(/^source[:：]\s*/i, '')
    .trim();
}

function sourceFromTraits(definition) {
  const release = (definition.traitIds || []).find((trait) => String(trait).startsWith('releases.'));
  return release ? release.replace(/^releases\./, '').replace(/\./g, ' ') : '';
}

function makeWeaponItem(definition, damageTypes, craftingInfoByHash = new Map()) {
  const ammo = ammoLabel(definition);
  const element = elementLabel(definition, damageTypes);
  const craftingInfo = craftingInfoByHash.get(Number(definition.hash));
  const item = {
    kind: 'weapon',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '武器',
    weaponType: definition.itemTypeDisplayName || '',
    ammo,
    element,
    tier: definition.inventory?.tierTypeName || '',
    adept: isAdept(displayName(definition)),
    description: cleanText(displayDescription(definition))
  };
  if (craftingInfo) {
    Object.assign(item, {
      craftable: true,
      source: craftingInfo.source,
      sourceHash: craftingInfo.sourceHash,
      patternRecordHash: craftingInfo.patternRecordHash,
      patternObjectiveHash: craftingInfo.patternObjectiveHash,
      outputItemHash: craftingInfo.outputItemHash,
      outputCollectibleHash: craftingInfo.outputCollectibleHash,
      watermark: craftingInfo.watermark
    });
  }
  item.searchText = makeSearchText(item);
  return item;
}

function makeArmorItem(definition) {
  const item = {
    kind: 'armor',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '护甲',
    slot: armorSlotLabel(definition),
    className: classTypeLabel(definition.classType),
    tier: definition.inventory?.tierTypeName || '',
    description: cleanText(displayDescription(definition))
  };
  item.searchText = makeSearchText(item);
  return item;
}

function makePerkItem(definition, statDefs) {
  const item = {
    kind: 'perk',
    hash: Number(definition.hash),
    name: displayName(definition),
    icon: iconUrl(definition),
    type: definition.itemTypeDisplayName || '特性',
    enhanced: isEnhancedPerk(definition),
    description: cleanText(displayDescription(definition)),
    category: definition.plug?.plugCategoryIdentifier || '',
    stats: formatInvestmentStats(definition, statDefs)
  };
  item.searchText = makeSearchText(item);
  return item;
}

function makeWeaponRecord(definition, item, items, plugSets, statDefs, weaponPlugs, craftingInfoByHash = new Map()) {
  const sockets = [];
  const entries = definition.sockets?.socketEntries || [];
  const craftingInfo = craftingInfoByHash.get(Number(definition.hash));
  for (let index = 0; index < entries.length; index += 1) {
    const hashes = plugHashesForSocket(entries[index], plugSets);
    const perks = hashes
      .map((hash) => items[String(hash)])
      .filter(Boolean)
      .filter(isWeaponSocketPlug)
      .map((plug) => {
        addWeaponPlug(weaponPlugs, plug, statDefs);
        return Number(plug.hash);
      });

    if (perks.length) {
      sockets.push({
        socketIndex: index,
        label: weaponSocketLabel(index, perks, items),
        perks: uniqueNumbers(perks)
      });
    }
  }

  return {
    hash: item.hash,
    name: item.name,
    baseName: baseWeaponName(item.name),
    icon: item.icon,
    weaponType: item.weaponType,
    ammo: item.ammo,
    element: item.element,
    adept: item.adept,
    stats: formatStats(definition, statDefs),
    screenshot: imageUrl(definition.screenshot),
    sockets,
    crafting: craftingInfo || null
  };
}

function makeArmorRecord(definition, item, items, itemSetByItemHash, statDefs) {
  return {
    hash: item.hash,
    name: item.name,
    icon: item.icon,
    type: item.type,
    slot: item.slot,
    className: item.className,
    tier: item.tier,
    stats: formatStats(definition, statDefs),
    setBonus: itemSetByItemHash.get(item.hash) || null,
    intrinsicPerks: armorIntrinsicPerks(definition, items)
  };
}

function resolveSocketPerks(socket, perkByHash) {
  return (socket.perks || [])
    .map((entry) => {
      if (typeof entry === 'number') return perkByHash.get(entry);
      if (entry?.hash) return perkByHash.get(entry.hash) || entry;
      return null;
    })
    .filter(Boolean);
}

function addWeaponPlug(output, definition, statDefs) {
  const hash = Number(definition.hash);
  if (!hash || output.has(hash)) return;
  output.set(hash, {
    hash,
    name: displayName(definition),
    type: definition.itemTypeDisplayName || '',
    enhanced: isEnhancedPerk(definition),
    icon: iconUrl(definition),
    description: cleanText(displayDescription(definition)),
    category: definition.plug?.plugCategoryIdentifier || '',
    stats: formatInvestmentStats(definition, statDefs)
  });
}

function isWeaponSocketPlug(definition) {
  const name = displayName(definition);
  if (!name || name === EMPTY_TRAIT_SOCKET || /^空/.test(name)) return false;
  const type = String(definition.itemTypeDisplayName || '');
  const category = String(definition.plug?.plugCategoryIdentifier || '').toLowerCase();
  const blockedText = `${type} ${category}`.toLowerCase();
  if (name === '机密' || type.includes('战斗特效')) return false;
  if (/shader|skin|ornament|tracker|masterwork|memento|kill_counter|catalyst|mod/.test(blockedText)) return false;
  if (type.includes('着色器') || type.includes('皮肤') || type.includes('追踪器') || type.includes('大师杰作') || type.includes('模组')) return false;
  return Boolean(type || displayDescription(definition));
}

function plugHashesForSocket(socket, plugSets) {
  const hashes = new Set();
  if (socket.singleInitialItemHash) hashes.add(Number(socket.singleInitialItemHash));
  for (const item of socket.reusablePlugItems || []) if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
  for (const item of socket.randomizedPlugItems || []) if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
  for (const plugSetHash of [socket.reusablePlugSetHash, socket.randomizedPlugSetHash]) {
    const set = plugSets[String(plugSetHash)];
    for (const item of set?.reusablePlugItems || []) {
      if (item.plugItemHash) hashes.add(Number(item.plugItemHash));
    }
  }
  return Array.from(hashes);
}

function makeItemSetMap(itemSets, sandboxPerks) {
  const map = new Map();
  for (const set of Object.values(itemSets || {})) {
    if (!set || set.redacted || !Array.isArray(set.setItems)) continue;
    const entry = {
      hash: Number(set.hash),
      name: displayName(set),
      perks: (set.setPerks || [])
        .map((perk) => {
          const definition = sandboxPerks[String(perk.sandboxPerkHash)] || {};
          return {
            requiredSetCount: Number(perk.requiredSetCount || 0),
            hash: Number(perk.sandboxPerkHash || 0),
            name: displayName(definition) || `${perk.requiredSetCount} 件套`,
            description: cleanText(displayDescription(definition))
          };
        })
        .filter((perk) => perk.requiredSetCount && (perk.name || perk.description))
        .sort((a, b) => a.requiredSetCount - b.requiredSetCount)
    };
    if (!entry.name && !entry.perks.length) continue;
    for (const hash of set.setItems) {
      map.set(Number(hash), entry);
    }
  }
  return map;
}

function armorIntrinsicPerks(definition, items) {
  const hashes = new Set();
  for (const socket of definition.sockets?.socketEntries || []) {
    if (socket.singleInitialItemHash) hashes.add(Number(socket.singleInitialItemHash));
  }
  return Array.from(hashes)
    .map((hash) => items[String(hash)])
    .filter((plug) => plug && !plug.redacted)
    .filter((plug) => isArmorIntrinsicPlug(plug))
    .map((plug) => ({
      hash: Number(plug.hash),
      name: displayName(plug),
      type: plug.itemTypeDisplayName || '',
      icon: iconUrl(plug),
      description: cleanText(displayDescription(plug))
    }))
    .filter((perk) => perk.name && !/^空/.test(perk.name));
}

function isArmorIntrinsicPlug(definition) {
  const type = String(definition.itemTypeDisplayName || '');
  const category = String(definition.plug?.plugCategoryIdentifier || '');
  return type.includes('护甲特性') || category === 'intrinsics';
}

function formatStats(definition, statDefs) {
  const stats = Object.values(definition.stats?.stats || {})
    .map((stat) => {
      const statDef = statDefs[String(stat.statHash)] || {};
      const name = displayName(statDef);
      const value = Number(stat.value || 0);
      const displayMaximum = Number(stat.displayMaximum || stat.maximum || 100);
      return {
        hash: Number(stat.statHash),
        name,
        value,
        displayMaximum,
        sort: Number(statDef.index || 0)
      };
    })
    .filter((stat) => stat.name && stat.value > 0)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'));
  return stats.map(({ sort, ...stat }) => stat);
}

function formatInvestmentStats(definition, statDefs) {
  return (definition.investmentStats || [])
    .map((stat) => {
      const statDef = statDefs[String(stat.statTypeHash)] || {};
      const name = displayName(statDef);
      const value = Number(stat.value || 0);
      return {
        hash: Number(stat.statTypeHash),
        name,
        value,
        conditionallyActive: Boolean(stat.isConditionallyActive)
      };
    })
    .filter((stat) => stat.name && stat.value !== 0);
}

function diffInvestmentStats(normalStats, enhancedStats) {
  const normalByHash = new Map(normalStats.map((stat) => [String(stat.hash), stat]));
  const enhancedByHash = new Map(enhancedStats.map((stat) => [String(stat.hash), stat]));
  const hashes = new Set([...normalByHash.keys(), ...enhancedByHash.keys()]);

  return Array.from(hashes)
    .map((hash) => {
      const normal = normalByHash.get(hash);
      const enhanced = enhancedByHash.get(hash);
      const normalValue = Number(normal?.value || 0);
      const enhancedValue = Number(enhanced?.value || 0);
      return {
        hash: Number(hash),
        name: enhanced?.name || normal?.name || hash,
        normal: normalValue,
        enhanced: enhancedValue,
        delta: enhancedValue - normalValue,
        conditionallyActive: Boolean(enhanced?.conditionallyActive || normal?.conditionallyActive)
      };
    })
    .filter((stat) => stat.delta !== 0);
}

function perkPairKey(perk) {
  const name = normalizeText(perk?.name || '');
  if (!name) return '';
  const category = normalizeText(perk?.category || basePerkType(perk?.type || ''));
  return `${name}|${category}`;
}

function basePerkType(type) {
  return cleanText(type)
    .replace(/^强化/, '')
    .replace('特征', '特性')
    .replace('利刃', '刀片')
    .replace('刀柄', '把手');
}

function weaponSocketLabel(index, perkHashes, items) {
  const perks = perkHashes.map((hash) => items[String(hash)]).filter(Boolean);
  if (perks.some((perk) => String(perk.itemTypeDisplayName || '').includes('固有'))) return '框架 / 固有';
  if (perks.some((perk) => String(perk.itemTypeDisplayName || '').includes('原始'))) return '起源特性';
  const typeCounts = new Map();
  for (const perk of perks) {
    const type = String(perk.itemTypeDisplayName || '').trim();
    if (!type || type === '特性' || type === '强化特征') continue;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }
  const [type] = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0] || [];
  if (type) return type;
  return `第 ${index + 1} 列`;
}

async function bungieFetchJson(pathOrUrl, deps) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BUNGIE_BASE_URL}${pathOrUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs || 30000);
  const maxBytes = deps.maxBytes || 80_000_000;

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'x-api-key': deps.apiKey,
        'accept-language': deps.locale || 'zh-chs',
        'content-type': 'application/json'
      }
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw httpError(502, 'GEAR_SOURCE_TOO_LARGE', `Bungie Manifest response is larger than ${maxBytes} bytes`);
    }
    const text = await response.text();
    if (text.length > maxBytes) {
      throw httpError(502, 'GEAR_SOURCE_TOO_LARGE', `Bungie Manifest response is larger than ${maxBytes} bytes`);
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw httpError(502, 'BUNGIE_INVALID_JSON', 'Bungie API returned invalid JSON');
    }
    if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
      throw httpError(response.ok ? 502 : response.status || 502, 'BUNGIE_API_ERROR', payload.Message || `Bungie API returned HTTP ${response.status}`);
    }
    return payload.Response && pathOrUrl.includes('/Platform/') ? payload : payload;
  } catch (error) {
    if (error.name === 'AbortError') throw httpError(504, 'REQUEST_TIMEOUT', 'Bungie Manifest request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreGearItem(item, normalizedQuery, rawQuery) {
  if (String(item.hash) === rawQuery) return 0;
  if (normalizeText(item.name) === normalizedQuery) return 1;
  if (normalizeText(item.name).startsWith(normalizedQuery)) return 2;
  if (item.kind === 'weapon') return 3;
  if (item.kind === 'armor') return 4;
  return 5;
}

function publicGearItem(item) {
  const { searchText, ...publicItem } = item;
  return publicItem;
}

function publicGearDetail(item, index) {
  if (item.kind === 'weapon') {
    const record = index.weapons.find((weapon) => weapon.hash === item.hash);
    return record ? publicWeaponRecord(record, index) : null;
  }
  if (item.kind === 'armor') {
    return (index.armors || []).find((armor) => armor.hash === item.hash) || null;
  }
  return null;
}

function publicWeaponRecord(record, index, matchedHashes = new Set()) {
  return {
    hash: record.hash,
    name: record.name,
    baseName: record.baseName,
    icon: record.icon,
    weaponType: record.weaponType,
    ammo: record.ammo,
    element: record.element,
    adept: Boolean(record.adept),
    stats: record.stats || [],
    screenshot: record.screenshot || '',
    sockets: publicWeaponSockets(record, perkMap(index), matchedHashes)
  };
}

function publicWeaponSockets(record, perksByHash, matchedHashes = new Set()) {
  return (record.sockets || [])
    .map((socket) => ({
      socketIndex: socket.socketIndex,
      label: socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`,
      perks: publicSocketPerks(resolveSocketPerks(socket, perksByHash), matchedHashes)
    }))
    .filter((socket) => socket.perks.length);
}

function publicSocketPerks(perks, matchedHashes) {
  const normalByKey = new Map();
  const enhancedByKey = new Map();

  for (const perk of perks) {
    const key = perkPairKey(perk);
    if (!key) continue;
    if (perk.enhanced) {
      const entries = enhancedByKey.get(key) || [];
      if (!entries.some((entry) => entry.hash === perk.hash)) entries.push(perk);
      enhancedByKey.set(key, entries);
      continue;
    }
    if (!normalByKey.has(key)) normalByKey.set(key, perk);
  }

  const seenKeys = new Set();
  return perks
    .map((perk) => {
      const key = perkPairKey(perk);
      if (!key) return null;
      if (perk.enhanced && normalByKey.has(key)) return null;
      if (seenKeys.has(key)) return null;
      seenKeys.add(key);

      const enhancedOptions = perk.enhanced ? [] : (enhancedByKey.get(key) || []);
      const enhancedMatched = enhancedOptions.some((entry) => matchedHashes.has(entry.hash));
      return {
        ...publicPerkRef(perk),
        matched: matchedHashes.has(perk.hash) || enhancedMatched,
        enhancedMatched,
        enhancedOptions: enhancedOptions.map((entry) => publicEnhancedPerkRef(perk, entry))
      };
    })
    .filter(Boolean);
}

function perkMap(index) {
  return new Map([
    ...index.items.filter((item) => item.kind === 'perk').map((item) => [item.hash, item]),
    ...(index.weaponPlugs || []).map((item) => [item.hash, item])
  ]);
}

function publicPerkRef(perk) {
  return {
    hash: perk.hash,
    name: perk.name,
    type: perk.type,
    enhanced: Boolean(perk.enhanced),
    icon: perk.icon || '',
    description: perk.description || '',
    stats: Array.isArray(perk.stats) ? perk.stats : []
  };
}

function publicEnhancedPerkRef(normal, enhanced) {
  return {
    ...publicPerkRef(enhanced),
    statDiff: diffInvestmentStats(normal.stats || [], enhanced.stats || []),
    descriptionDiff: enhanced.description && enhanced.description !== normal.description ? enhanced.description : '',
    matched: false
  };
}

function requireApiKey(deps) {
  if (!deps.apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询装备数据');
  }
}

function normalizeGearKind(kind) {
  const value = String(kind || '').toLowerCase();
  if (['weapon', 'armor', 'perk', 'all'].includes(value)) return value;
  return 'all';
}

function isWeapon(definition) {
  return Number(definition.itemType) === ITEM_TYPE_WEAPON && hasCategory(definition, WEAPON_CATEGORY);
}

function isArmor(definition) {
  return Number(definition.itemType) === ITEM_TYPE_ARMOR && hasCategory(definition, ARMOR_CATEGORY);
}

function isTraitPlug(definition) {
  return (
    hasCategory(definition, TRAIT_CATEGORY) ||
    String(definition.itemTypeDisplayName || '').includes('特性') ||
    String(definition.itemTypeDisplayName || '').toLowerCase().includes('trait')
  );
}

function isEnhancedPerk(definition) {
  return String(definition.itemTypeDisplayName || '').includes('强化') || displayDescription(definition).includes('持续时间延长');
}

function ammoLabel(definition) {
  if (hasCategory(definition, KINETIC_WEAPON)) return '动能槽';
  if (hasCategory(definition, ENERGY_WEAPON)) return '能量槽';
  if (hasCategory(definition, POWER_WEAPON)) return '威能槽';
  return '';
}

function elementLabel(definition, damageTypes) {
  return (definition.damageTypeHashes || [])
    .map((hash) => displayName(damageTypes[String(hash)]))
    .filter(Boolean)
    .join(', ');
}

function armorSlotLabel(definition) {
  if (hasCategory(definition, HELMET)) return '头盔';
  if (hasCategory(definition, ARMS)) return '臂铠';
  if (hasCategory(definition, CHEST)) return '胸甲';
  if (hasCategory(definition, LEGS)) return '腿甲';
  if (hasCategory(definition, CLASS_ITEM)) return '职业物品';
  return definition.itemTypeDisplayName || '护甲';
}

function classTypeLabel(value) {
  const number = Number(value);
  if (number === 0) return '泰坦';
  if (number === 1) return '猎人';
  if (number === 2) return '术士';
  return '通用';
}

function isAdept(name) {
  return name.includes(ADEPT_SUFFIX) || /\(Adept\)/i.test(name);
}

function baseWeaponName(name) {
  return name.replace(ADEPT_SUFFIX, '').replace(/\s*\(Adept\)$/i, '');
}

function hasCategory(definition, hash) {
  return Array.isArray(definition.itemCategoryHashes) && definition.itemCategoryHashes.includes(hash);
}

function displayName(definition) {
  return cleanText(definition?.displayProperties?.name);
}

function displayDescription(definition) {
  return cleanText(definition?.displayProperties?.description || definition?.flavorText);
}

function iconUrl(definition) {
  const icon = definition?.displayProperties?.icon || definition?.iconImage || '';
  return imageUrl(icon);
}

function imageUrl(value) {
  const path = String(value || '');
  if (!path) return '';
  return path.startsWith('http') ? path : `${BUNGIE_BASE_URL}${path}`;
}

function makeSearchText(item) {
  return normalizeText([item.name, item.type, item.weaponType, item.ammo, item.element, item.slot, item.className, item.tier, item.description, item.hash].filter(Boolean).join(' '));
}

function normalizeText(value) {
  return cleanText(value)
    .toLocaleLowerCase('zh-CN')
    .normalize('NFKC');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function uniqueByHash(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item?.hash || seen.has(item.hash)) continue;
    seen.add(item.hash);
    output.push(item);
  }
  return output;
}

function uniqueNumbers(items) {
  return Array.from(new Set(items.filter((item) => Number.isFinite(Number(item))).map(Number)));
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
