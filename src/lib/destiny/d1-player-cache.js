/**
 * D1 持久化缓存：Bungie 玩家名 → membershipType + membershipId 映射
 * TTL 24 小时，减少 SearchDestinyPlayerByBungieName 重复调用
 */

const D1_TTL_MS = 86_400_000; // 24 小时

/**
 * 从 D1 读取玩家名解析结果
 * @returns {{ membershipType: string, membershipId: string, memberships: object[] } | null}
 */
export async function getPlayerNameFromD1(bungieName, env) {
  const db = env.PLAYER_NAMES_DB;
  if (!db) return null;
  try {
    const row = await db
      .prepare(
        'SELECT membership_type, membership_id, memberships_json FROM player_names WHERE bungie_name = ? AND expires_at > ?'
      )
      .bind(bungieName, Date.now())
      .first();
    if (!row) return null;
    return {
      membershipType: row.membership_type,
      membershipId: row.membership_id,
      memberships: tryParseJsonArray(row.memberships_json)
    };
  } catch {
    return null; // D1 故障不影响主流程
  }
}

/**
 * 写入玩家名解析结果到 D1（后台执行，不阻塞响应）
 * @param {string} bungieName - e.g. "Guardian#1234"
 * @param {{ membershipType: string|number, membershipId: string }} primaryMembership
 * @param {object[]} memberships - 所有关联账号
 */
export async function putPlayerNameToD1(bungieName, primaryMembership, memberships, env, ctx) {
  const db = env.PLAYER_NAMES_DB;
  if (!db) return;
  const now = Date.now();
  const expiresAt = now + D1_TTL_MS;
  const write = db
    .prepare(
      `INSERT OR REPLACE INTO player_names
       (bungie_name, membership_type, membership_id, memberships_json, cached_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      bungieName,
      String(primaryMembership.membershipType),
      String(primaryMembership.membershipId),
      JSON.stringify(memberships || []),
      now,
      expiresAt
    )
    .run();

  if (ctx?.waitUntil) {
    ctx.waitUntil(write.catch(() => {}));
  } else {
    write.catch(() => {});
  }
}

function tryParseJsonArray(text) {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
