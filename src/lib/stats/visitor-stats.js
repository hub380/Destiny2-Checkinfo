const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const STATIC_SKIP_RE = /^\/assets\/|\.(?:js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|webp|svg|gif|avif)$/i;

function extractIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    ''
  );
}

async function buildVisitorKey(ip, env) {
  const salt = env.VISITOR_HASH_SALT || env.BUNGIE_API_KEY || 'fixed-v1-salt';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildAndWrite(ip, env) {
  const visitorKey = await buildVisitorKey(ip, env);
  const now = Date.now();
  await env.PLAYER_NAMES_DB
    .prepare(
      `INSERT INTO visitor_keys (visitor_key, first_seen, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(visitor_key) DO UPDATE SET last_seen = excluded.last_seen`
    )
    .bind(visitorKey, now, now)
    .run();
}

export function trackVisitor(request, env = {}, ctx = {}) {
  if (!env.PLAYER_NAMES_DB) return;

  const url = new URL(request.url);
  if (STATIC_SKIP_RE.test(url.pathname)) return;

  const ip = extractIp(request);
  if (!ip) return;

  const task = buildAndWrite(ip, env).catch(() => {});
  if (typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(task);
    return;
  }
  void task;
}

export async function getVisitorStats(env = {}) {
  if (!env.PLAYER_NAMES_DB) {
    return { onlineCount: 0, totalCount: 0, startedAt: null };
  }
  const now = Date.now();
  const windowStart = now - ONLINE_WINDOW_MS;
  const [online, totals] = await Promise.all([
    env.PLAYER_NAMES_DB
      .prepare('SELECT COUNT(*) AS count FROM visitor_keys WHERE last_seen >= ?')
      .bind(windowStart)
      .first(),
    env.PLAYER_NAMES_DB
      .prepare('SELECT COUNT(*) AS total, MIN(first_seen) AS started_at FROM visitor_keys')
      .first()
  ]);
  return {
    onlineCount: Number(online?.count || 0),
    totalCount: Number(totals?.total || 0),
    startedAt: totals?.started_at ? Number(totals.started_at) : null
  };
}
