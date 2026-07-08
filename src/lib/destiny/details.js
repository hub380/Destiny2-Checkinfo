import { httpError } from '../http/index.js';
import {
  getWorkerCachedJson,
  summaryCacheTtlSeconds
} from '../cache/index.js';
import { CACHE_VERSION } from '../shared/index.js';
import { bungieFetch } from '../bungie/index.js';
import { privacyLabel } from './privacy.js';
import { resolveDetailsTarget } from './targets.js';
import { summarizeRecords } from './details-records.js';
import { summarizeCrafting } from './details-crafting.js';

export async function getDestinyDetails(body, env, ctx) {
  if (!env.BUNGIE_API_KEY) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveDetailsTarget(body, env, ctx);
  const cacheKey = [
    'profile-details-v5',
    CACHE_VERSION,
    env.BUNGIE_LOCALE || 'zh-chs',
    target.membership.membershipType,
    target.membership.membershipId
  ].join(':');

  const cached = await getWorkerCachedJson(
    cacheKey,
    summaryCacheTtlSeconds(env),
    async () => {
      const profile = await bungieFetch(
        `/Platform/Destiny2/${target.membership.membershipType}/Profile/${target.membership.membershipId}/?components=900,1300`,
        { method: 'GET' },
        env
      );
      return summarizeDestinyDetails(target.membership, profile.Response || {}, env, ctx);
    },
    env,
    ctx,
    { persistLarge: true }
  );

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    account: {
      membershipType: target.membership.membershipType,
      membershipId: target.membership.membershipId
    },
    details: cached.value,
    cache: {
      details: cached.status,
      hitLevel: cached.status,
      detailsHitLevel: cached.status,
      detailsCachedAt: cached.cachedAt,
      detailsTtlSeconds: cached.ttlSeconds,
      r2Key: cached.r2Key || '',
      byteSize: cached.byteSize || 0,
      detailsR2Key: cached.r2Key || '',
      detailsByteSize: cached.byteSize || 0
    }
  };
}

export async function summarizeDestinyDetails(membership, profileResponse, env, ctx) {
  const recordsComponent = profileResponse.profileRecords || {};
  const craftablesComponent = profileResponse.characterCraftables || {};
  const crafting = await summarizeCrafting(craftablesComponent.data || {}, env, ctx, recordsComponent.data?.records || {});
  return {
    records: summarizeRecords(recordsComponent.data || {}, recordsComponent.privacy),
    crafting: {
      ...crafting,
      privacy: privacyLabel(craftablesComponent.privacy)
    },
    privacy: {
      records: privacyLabel(recordsComponent.privacy),
      craftables: privacyLabel(craftablesComponent.privacy)
    },
    membership: {
      membershipType: membership.membershipType,
      membershipId: membership.membershipId
    }
  };
}

export { summarizeRecords } from './details-records.js';
export {
  summarizeCrafting,
  enrichCraftableItems,
  getInventoryItemDefinitions,
  loadStaticGearItems,
  inventoryItemIcon,
  craftingPatternProgress
} from './details-crafting.js';
