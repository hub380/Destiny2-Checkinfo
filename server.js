import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGearItem, getGearSearch, getPerkWeapons } from './src/gear-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = path.join(__dirname, 'public');
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const HEYBOX_MAX_BYTES = Number(process.env.HEYBOX_MAX_BYTES || 2_000_000);
const DEFAULT_HEYBOX_SOURCE_URL = 'https://api.xiaoheihe.cn/game/common_team_v2/home?appid=1085660';
const ACTIVITY_DEFINITION_CACHE = new Map();
const CAREER_SUMMARY_CACHE = new Map();
const ENDGAME_CACHE = new Map();
const GEAR_INDEX_CACHE = new Map();
const PROFILE_DETAIL_CACHE = new Map();
const ITEM_DEFINITION_CACHE = new Map();
const CACHE_VERSION = '2026-06-13-endgame-v2';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const SAMPLE_FIRETEAMS = [
  {
    id: 'demo-1',
    source: 'demo',
    title: '宗师日落 需要清怪稳定',
    activity: 'PvE / 宗师',
    content: '缺 1，带反勇士，语音可不开。',
    author: '示例队长',
    username: 'GuardianCN#2333',
    joinCommand: '/j GuardianCN#2333',
    slots: { current: 2, max: 3 },
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    tags: ['演示数据']
  },
  {
    id: 'demo-2',
    source: 'demo',
    title: '救赎边缘教学车',
    activity: 'Raid / 6 人',
    content: '新手可来，耐心教学，缺 2。',
    author: '示例队长',
    username: 'LightKeeper#1024',
    joinCommand: '/j LightKeeper#1024',
    slots: { current: 4, max: 6 },
    createdAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    tags: ['演示数据']
  }
];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      writeCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === '/api/config-public' && req.method === 'GET') {
      sendJson(res, 200, {
        hasBungieApiKey: Boolean(process.env.BUNGIE_API_KEY),
        hasHeyboxSource: true,
        refreshSeconds: 30
      });
      return;
    }

    if (url.pathname === '/api/fireteams' && req.method === 'GET') {
      const result = await getFireteams();
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/gear/search' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getGearSearch(body, nodeGearDeps());
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/gear/item' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getGearItem(body, nodeGearDeps());
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/gear/perk-weapons' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getPerkWeapons(body, nodeGearDeps());
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/destiny/summary' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getDestinySummary(body);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/destiny/endgame' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getDestinyEndgame(body);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/destiny/details' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getDestinyDetails(body);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/destiny/career' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await getDestinyCareer(body);
      sendJson(res, 200, result);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Unexpected server error'
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Destiny 2 Fireteam Dashboard running at http://localhost:${PORT}`);
});

async function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const decoded = decodeURIComponent(normalizedPath);
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, decoded));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    throw httpError(403, 'FORBIDDEN', 'Forbidden');
  }

  if (!existsSync(absolutePath)) {
    throw httpError(404, 'NOT_FOUND', 'Not found');
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const content = await readFile(absolutePath);
  res.writeHead(200, {
    'content-type': MIME_TYPES[ext] || 'application/octet-stream',
    'cache-control': 'no-cache'
  });
  res.end(content);
}

function sendJson(res, status, payload) {
  writeCorsHeaders(res);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache'
  });
  res.end(JSON.stringify(payload));
}

function writeCorsHeaders(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) {
      throw httpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
    }
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

async function requestText(url, options = {}) {
  const { maxBytes = HEYBOX_MAX_BYTES, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    const text = await response.text();
    if (text.length > maxBytes) {
      throw httpError(502, 'SOURCE_TOO_LARGE', `Source response is larger than ${maxBytes} bytes`);
    }
    return { response, text };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw httpError(504, 'REQUEST_TIMEOUT', 'External request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getFireteams() {
  const configuredUrl = process.env.HEYBOX_SOURCE_URL || DEFAULT_HEYBOX_SOURCE_URL;

  const headers = parseJsonEnv('HEYBOX_SOURCE_HEADERS', {});
  const method = (process.env.HEYBOX_SOURCE_METHOD || 'GET').toUpperCase();
  const body = process.env.HEYBOX_SOURCE_BODY || undefined;

  const { response, text } = await requestText(configuredUrl, {
    method,
    headers: {
      accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
      'user-agent': 'Mozilla/5.0 Destiny2FireteamDashboard/1.0',
      ...headers
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : body
  });

  if (!response.ok) {
    throw httpError(response.status, 'HEYBOX_SOURCE_ERROR', `小黑盒数据源返回 HTTP ${response.status}`);
  }

  const normalized = normalizeHeyboxPayload(text, response.headers.get('content-type') || '', configuredUrl);

  return {
    source: 'heybox',
    sourceUrl: configuredUrl,
    parser: normalized.parser,
    updatedAt: new Date().toISOString(),
    warning: normalized.warning,
    items: normalized.items
  };
}

function normalizeHeyboxPayload(text, contentType, sourceUrl) {
  const payloads = [];
  const directJson = tryParseJson(text);
  if (directJson) {
    const xiaoheiheItems = normalizeXiaoheiheHomePayload(directJson, sourceUrl);
    if (xiaoheiheItems.length) {
      return {
        parser: 'xiaoheihe-common-team-v2',
        warning: directJson.status && directJson.status !== 'ok' ? directJson.msg || '小黑盒接口返回异常状态。' : undefined,
        items: xiaoheiheItems
      };
    }
    payloads.push({ payload: directJson, parser: 'json' });
  }

  if (!directJson && /html|text/i.test(contentType)) {
    for (const jsonText of extractEmbeddedJson(text)) {
      const parsed = tryParseJson(jsonText);
      if (parsed) payloads.push({ payload: parsed, parser: 'embedded-json' });
    }
  }

  for (const item of payloads) {
    const normalized = normalizeFireteamsFromJson(item.payload, sourceUrl);
    if (normalized.length) {
      return {
        parser: item.parser,
        items: normalized
      };
    }
  }

  const fromText = normalizeFireteamsFromText(text, sourceUrl);
  return {
    parser: 'text',
    warning: fromText.length ? undefined : '已读取数据源，但没有识别到组队条目。请检查 HEYBOX_SOURCE_URL 或字段结构。',
    items: fromText
  };
}

function normalizeXiaoheiheHomePayload(payload, sourceUrl) {
  const list = payload?.result?.team_list;
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => item && !item.is_room_delete)
    .map((item, index) => mapXiaoheiheTeam(item, index, sourceUrl))
    .filter(Boolean)
    .sort((a, b) => Number(a.expired) - Number(b.expired) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function mapXiaoheiheTeam(item, index, sourceUrl) {
  const content = cleanText(item.content_text || '');
  const tagTexts = Array.isArray(item.tags) ? item.tags.map((tag) => cleanText(tag.desc)).filter(Boolean) : [];
  const lightTags = tagTexts.filter((tag) => /^光等/.test(tag));
  const activityTags = tagTexts.filter((tag) => !/^光等/.test(tag));
  const expired = Boolean(item.is_expired || Number(item.remain_seconds) <= 0);
  const stateTag = item.is_full ? '已满' : expired ? '已过期' : stateLabel(item.display_state);
  const username = extractDestinyName(item.game_id || '') || extractDestinyName(content);
  const title = content ? content.slice(0, 54) : activityTags.join(' / ') || '小黑盒组队';
  const tags = [...activityTags, ...lightTags, stateTag].filter(Boolean);
  const slots = parseXiaoheiheSlots(item, content, activityTags);

  return {
    id: String(item.link_id || stableId(content, username, index)),
    source: 'heybox',
    title,
    activity: activityTags.join(' / '),
    content,
    author: item.user?.username || '',
    username,
    joinCommand: username ? `/j ${username}` : '',
    slots,
    link: buildXiaoheiheLink(item, sourceUrl),
    createdAt: parseTime(item.modify_at) || null,
    tags,
    expired,
    remainingSeconds: Number(item.remain_seconds || 0),
    avatar: item.user?.avatar || item.user?.avartar || ''
  };
}

function stateLabel(displayState) {
  const map = {
    online: '在线',
    chat: '可聊天'
  };
  return map[displayState] || '';
}

function parseXiaoheiheSlots(item, content, activityTags) {
  const eq = String(content || '').match(/(\d{1,2})\s*=\s*(\d{1,2})/);
  if (eq) {
    const current = Number(eq[1]);
    const missing = Number(eq[2]);
    return { current, max: current + missing };
  }

  const slash = String(content || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (slash) return { current: Number(slash[1]), max: Number(slash[2]) };

  const missing = String(content || '').match(/缺\s*(\d{1,2})/);
  if (missing) {
    const max = activityTags.some((tag) => /玻璃|救赎|门徒|花园|遗愿|深岩|梦魇|克洛塔|突袭|raid/i.test(tag)) ? 6 : 3;
    const left = Number(missing[1]);
    return { current: Math.max(max - left, 0), max };
  }

  return null;
}

function buildXiaoheiheLink(item, sourceUrl) {
  const pattern = process.env.HEYBOX_ITEM_URL_PATTERN;
  if (pattern && item.link_id) return pattern.replace('{id}', encodeURIComponent(item.link_id));
  return sourceUrl;
}

function tryParseJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractEmbeddedJson(html) {
  const results = [];
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1]) results.push(decodeHtml(nextData[1]));

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    const script = decodeHtml(match[1].trim());
    const assignment = script.match(/(?:window\.)?(?:__INITIAL_STATE__|__NUXT__|__APOLLO_STATE__)\s*=\s*({[\s\S]*?});?\s*$/);
    if (assignment?.[1]) results.push(assignment[1]);
  }
  return results.slice(0, 10);
}

function normalizeFireteamsFromJson(payload, sourceUrl) {
  const candidates = [];
  collectArrayCandidates(payload, candidates);
  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    const mapped = candidate.array
      .map((item, index) => mapFireteamItem(item, index, sourceUrl))
      .filter(Boolean);
    const deduped = dedupeFireteams(mapped);
    if (deduped.length) return deduped.slice(0, 80);
  }
  return [];
}

function collectArrayCandidates(value, candidates, pathName = 'root', depth = 0) {
  if (depth > 8 || value == null) return;

  if (Array.isArray(value)) {
    const objectItems = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (objectItems.length) {
      const score = scoreCandidateArray(objectItems, pathName);
      if (score > 0) candidates.push({ array: objectItems, pathName, score });
    }
    for (const item of value.slice(0, 40)) {
      collectArrayCandidates(item, candidates, pathName, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectArrayCandidates(child, candidates, `${pathName}.${key}`, depth + 1);
    }
  }
}

function scoreCandidateArray(items, pathName) {
  const pathScore = /team|fireteam|group|room|post|topic|list|data|recruit|activity|组队|队伍/i.test(pathName) ? 8 : 0;
  const sample = items.slice(0, 6);
  let score = pathScore + Math.min(items.length, 12);

  for (const item of sample) {
    const keys = flattenKeys(item).join(' ').toLowerCase();
    const text = collectStrings(item, 20).join(' ');
    if (/title|subject|content|desc|message|text|activity|mission|room|team|author|nickname|creator|user/.test(keys)) score += 6;
    if (/bungie|destiny|steam|game|display|account|username|player/.test(keys)) score += 5;
    if (/组队|队伍|副本|raid|日落|地牢|宗师|熔炉|试炼|raid|dungeon|gm/i.test(text)) score += 6;
    if (extractDestinyName(text)) score += 10;
  }

  return score;
}

function flattenKeys(value, depth = 0, keys = []) {
  if (!value || typeof value !== 'object' || depth > 4) return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    if (child && typeof child === 'object') flattenKeys(child, depth + 1, keys);
  }
  return keys;
}

function mapFireteamItem(item, index, sourceUrl) {
  const strings = collectStrings(item, 80).map(cleanText).filter(Boolean);
  const allText = strings.join('\n');
  const username = extractDestinyName(
    findValueByNames(item, [
      'bungiename',
      'destinyname',
      'gamename',
      'gameusername',
      'gameuserid',
      'steamname',
      'platformdisplayname',
      'displayname',
      'account',
      'contact'
    ]) || allText
  );

  const title =
    cleanText(findValueByNames(item, ['title', 'subject', 'topic', 'roomname', 'teamname', 'activityname', 'name'])) ||
    buildTitle(strings);
  const content =
    cleanText(findValueByNames(item, ['content', 'description', 'desc', 'body', 'message', 'text', 'detail', 'remark', 'requirement'])) ||
    buildContent(strings, title);
  const activity = cleanText(findValueByNames(item, ['activity', 'activityname', 'mode', 'mission', 'map', 'category', 'tag', 'type']));
  const author = cleanText(findValueByNames(item, ['nickname', 'username', 'author', 'creator', 'owner', 'poster', 'publisher']));
  const id = String(findValueByNames(item, ['id', 'postid', 'topicid', 'roomid', 'teamid']) || stableId(title, content, index));
  const link = buildItemLink(item, sourceUrl, id);
  const createdAt = parseTime(findValueByNames(item, ['createdat', 'createtime', 'created', 'time', 'timestamp', 'publishat', 'publishtime']));
  const slots = parseSlots(item, allText);
  const tags = collectTags(item, activity);

  if (!title && !content && !username) return null;

  return {
    id,
    source: 'heybox',
    title: title || '未命名组队',
    activity,
    content,
    author,
    username,
    joinCommand: username ? `/j ${username}` : '',
    slots,
    link,
    createdAt,
    tags
  };
}

function findValueByNames(value, names, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 7) return '';
  const wanted = new Set(names.map(normalizeKey));

  for (const [key, child] of Object.entries(value)) {
    if (wanted.has(normalizeKey(key)) && isScalar(child)) return String(child);
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      const found = findValueByNames(child, names, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function collectStrings(value, limit = 80, depth = 0, out = []) {
  if (out.length >= limit || value == null || depth > 8) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = cleanText(String(value));
    if (text && text.length <= 500) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) collectStrings(item, limit, depth + 1, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) collectStrings(child, limit, depth + 1, out);
  }
  return out;
}

function buildTitle(strings) {
  const preferred = strings.find((text) => /组队|队伍|raid|日落|地牢|宗师|试炼|熔炉|副本|dungeon|gm/i.test(text));
  return cleanText(preferred || strings.find((text) => text.length >= 4 && text.length <= 80) || '');
}

function buildContent(strings, title) {
  return strings
    .filter((text) => text !== title)
    .filter((text) => !/^https?:\/\//i.test(text))
    .slice(0, 4)
    .join(' / ')
    .slice(0, 300);
}

function extractDestinyName(text) {
  const normalized = cleanText(String(text || '').replace(/^\/j\s+/i, ''));
  const strict = normalized.match(/(?:^|[\s:：,，;；])([A-Za-z0-9_\-.()[\]\u4e00-\u9fff ]{1,32}#\d{3,8})(?=$|[\s,，;；])/u);
  if (strict?.[1]) return strict[1].trim();
  const loose = normalized.match(/([^\s#,:：，;；]{1,32}#\d{3,8})/u);
  return loose?.[1]?.trim() || '';
}

function parseSlots(item, text) {
  const current = Number(findValueByNames(item, ['current', 'currentplayers', 'currentcount', 'membercount', 'joined', 'joinedcount']));
  const max = Number(findValueByNames(item, ['max', 'maxplayers', 'maxcount', 'capacity', 'total', 'totalcount']));
  if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
    return { current, max };
  }

  const slash = String(text || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (slash) return { current: Number(slash[1]), max: Number(slash[2]) };

  const missing = String(text || '').match(/缺\s*(\d{1,2})/);
  const activityMax = /raid|突袭|救赎|门徒|花园|遗愿|玻璃|深岩|梦魇|克洛塔/i.test(text) ? 6 : 3;
  if (missing) {
    const left = Number(missing[1]);
    return { current: Math.max(activityMax - left, 0), max: activityMax };
  }
  return null;
}

function collectTags(item, activity) {
  const tags = new Set();
  if (activity) tags.add(activity);
  const raw = findValueByNames(item, ['tags', 'labels', 'taglist']);
  if (raw) {
    for (const part of String(raw).split(/[,，/| ]+/)) {
      const text = cleanText(part);
      if (text && text.length <= 16) tags.add(text);
    }
  }
  return Array.from(tags).slice(0, 6);
}

function parseTime(value) {
  if (!value) return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (number > 1_000_000_000_000) return new Date(number).toISOString();
    if (number > 1_000_000_000) return new Date(number * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function buildItemLink(item, sourceUrl, id) {
  const direct = findValueByNames(item, ['url', 'link', 'shareurl', 'sharelink', 'weburl']);
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const pattern = process.env.HEYBOX_ITEM_URL_PATTERN;
  if (pattern && id) return pattern.replace('{id}', encodeURIComponent(id));
  return sourceUrl;
}

function stableId(title, content, index) {
  const seed = `${title}|${content}|${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `item-${hash.toString(36)}`;
}

function dedupeFireteams(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.username || ''}|${item.title || ''}|${item.content || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeFireteamsFromText(html, sourceUrl) {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\r/g, '\n')
  );

  const chunks = text
    .split(/\n{2,}| {4,}/)
    .map(cleanText)
    .filter((chunk) => chunk.length >= 8 && chunk.length <= 600)
    .filter((chunk) => extractDestinyName(chunk) || /组队|队伍|raid|日落|地牢|宗师|试炼|熔炉|缺\s*\d/i.test(chunk));

  return dedupeFireteams(
    chunks.slice(0, 80).map((chunk, index) => {
      const username = extractDestinyName(chunk);
      return {
        id: stableId(chunk, '', index),
        source: 'heybox',
        title: buildTitle([chunk]) || '小黑盒组队',
        activity: '',
        content: chunk,
        author: '',
        username,
        joinCommand: username ? `/j ${username}` : '',
        slots: parseSlots({}, chunk),
        link: sourceUrl,
        createdAt: null,
        tags: []
      };
    })
  );
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(500, 'INVALID_ENV_JSON', `${name} must be valid JSON`);
  }
}

async function getDestinyCareer(body) {
  const career = await getDestinySummary(body);
  const endgamePayload = await getDestinyEndgame({
    membershipType: career.account.membershipType,
    membershipId: career.account.membershipId,
    characters: career.characters
  });
  return attachEndgameToCareer(career, endgamePayload);
}

async function getDestinySummary(body) {
  const apiKey = process.env.BUNGIE_API_KEY;
  if (!apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先在 .env 中配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const parsedName = parseBungieName(body?.bungieName || body?.name || '');
  if (!parsedName) {
    throw httpError(400, 'INVALID_BUNGIE_NAME', '请输入棒鸡名称，格式为 名称#数字代码');
  }

  const membershipType = process.env.BUNGIE_MEMBERSHIP_TYPE || '-1';
  const cacheKey = [
    'summary',
    CACHE_VERSION,
    process.env.BUNGIE_LOCALE || 'zh-chs',
    membershipType,
    parsedName.displayName.toLocaleLowerCase(),
    parsedName.displayNameCode
  ].join(':');
  const cached = await getCachedJson(CAREER_SUMMARY_CACHE, cacheKey, summaryCacheTtlSeconds(), async () => {
    const search = await bungieFetch(`/Platform/Destiny2/SearchDestinyPlayerByBungieName/${membershipType}/`, {
      method: 'POST',
      body: JSON.stringify(parsedName)
    });

    const memberships = Array.isArray(search.Response) ? search.Response : [];
    if (!memberships.length) {
      throw httpError(404, 'PLAYER_NOT_FOUND', '没有找到这个棒鸡玩家');
    }

    const selected = selectMembership(memberships);
    const [profile, stats] = await Promise.all([
      bungieFetch(
        `/Platform/Destiny2/${selected.membershipType}/Profile/${selected.membershipId}/?components=100,200`,
        { method: 'GET' }
      ),
      bungieFetch(`/Platform/Destiny2/${selected.membershipType}/Account/${selected.membershipId}/Stats/`, {
        method: 'GET'
      })
    ]);

    return summarizeCareer(parsedName, selected, memberships, profile.Response || {}, stats.Response || {});
  });

  const career = cached.value;
  career.cache = {
    ...(career.cache || {}),
    summary: cached.status,
    summaryCachedAt: cached.cachedAt,
    summaryTtlSeconds: cached.ttlSeconds
  };
  return career;
}

async function getDestinyEndgame(body) {
  const apiKey = process.env.BUNGIE_API_KEY;
  if (!apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先在 .env 中配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveEndgameTarget(body);
  const modes = normalizeEndgameModes(body?.modes || body?.mode);
  const pageLimit = Number(process.env.ENDGAME_HISTORY_PAGE_LIMIT || 50);
  const pageSize = Number(process.env.ENDGAME_HISTORY_PAGE_SIZE || 250);
  const characterIds = target.characters.map((character) => character.id).filter(Boolean).sort().join(',');
  const cacheKey = [
    'endgame',
    CACHE_VERSION,
    process.env.BUNGIE_LOCALE || 'zh-chs',
    pageLimit,
    pageSize,
    modes.join(','),
    target.membership.membershipType,
    target.membership.membershipId,
    characterIds
  ].join(':');

  const cached = await getCachedJson(ENDGAME_CACHE, cacheKey, endgameCacheTtlSeconds(), async () =>
    getEndgameCareer(target.membership, target.characters, modes)
  );
  const endgame = cached.value;

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    account: {
      membershipType: target.membership.membershipType,
      membershipId: target.membership.membershipId
    },
    endgame,
    statsPatch: buildEndgameStatsPatch(endgame),
    cache: {
      endgame: cached.status,
      endgameCachedAt: cached.cachedAt,
      endgameTtlSeconds: cached.ttlSeconds
    }
  };
}

async function getDestinyDetails(body) {
  const apiKey = process.env.BUNGIE_API_KEY;
  if (!apiKey) {
    throw httpError(400, 'BUNGIE_API_KEY_MISSING', '请先在 .env 中配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯');
  }

  const target = await resolveDetailsTarget(body);
  const cacheKey = [
    'profile-details-v3',
    CACHE_VERSION,
    process.env.BUNGIE_LOCALE || 'zh-chs',
    target.membership.membershipType,
    target.membership.membershipId
  ].join(':');

  const cached = await getCachedJson(PROFILE_DETAIL_CACHE, cacheKey, summaryCacheTtlSeconds(), async () => {
    const profile = await bungieFetch(
      `/Platform/Destiny2/${target.membership.membershipType}/Profile/${target.membership.membershipId}/?components=900,1300`,
      { method: 'GET' }
    );
    return summarizeDestinyDetails(target.membership, profile.Response || {});
  });

  return {
    updatedAt: cached.cachedAt || new Date().toISOString(),
    account: {
      membershipType: target.membership.membershipType,
      membershipId: target.membership.membershipId
    },
    details: cached.value,
    cache: {
      details: cached.status,
      detailsCachedAt: cached.cachedAt,
      detailsTtlSeconds: cached.ttlSeconds
    }
  };
}

async function resolveDetailsTarget(body) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    return {
      membership: {
        membershipType,
        membershipId
      }
    };
  }

  const career = await getDestinySummary(body);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    }
  };
}

async function resolveEndgameTarget(body) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    const membership = {
      membershipType,
      membershipId
    };
    let characters = normalizeCharacterRefs(body?.characters);
    if (!characters.length) {
      characters = await fetchCharacterRefs(membership);
    }
    return { membership, characters };
  }

  const career = await getDestinySummary(body);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    },
    characters: normalizeCharacterRefs(career.characters)
  };
}

async function fetchCharacterRefs(membership) {
  const profile = await bungieFetch(
    `/Platform/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200`,
    { method: 'GET' }
  );
  return normalizeCharacterRefs(Object.values(profile.Response?.characters?.data || {}));
}

function normalizeCharacterRefs(characters) {
  return (Array.isArray(characters) ? characters : [])
    .map((character) => ({
      id: String(character?.id || character?.characterId || '')
    }))
    .filter((character) => character.id);
}

function attachEndgameToCareer(career, endgamePayload) {
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

function normalizeEndgameModes(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : ['raid', 'dungeon'];
  const modes = raw.map((item) => String(item || '').toLowerCase()).filter((item) => item === 'raid' || item === 'dungeon');
  return Array.from(new Set(modes.length ? modes : ['raid', 'dungeon']));
}

function buildEndgameStatsPatch(endgame) {
  const patch = {};
  if (endgame.raid?.total) patch.raid = endgame.raid.total;
  if (endgame.dungeon?.total) patch.dungeon = endgame.dungeon.total;
  return patch;
}

async function summarizeDestinyDetails(membership, profileResponse) {
  const recordsComponent = profileResponse.profileRecords || {};
  const craftablesComponent = profileResponse.characterCraftables || {};
  const crafting = await summarizeCrafting(craftablesComponent.data || {}, recordsComponent.data?.records || {});
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

function summarizeRecords(records, privacy) {
  const allRecords = Object.values(records.records || {});
  const visibleRecords = allRecords.filter((record) => (Number(record.state || 0) & 16) === 0);
  const completedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 4) === 0);
  const redeemedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 1) !== 0);
  return {
    privacy: privacyLabel(privacy),
    score: numberStat(records.score || 0),
    activeScore: numberStat(records.activeScore || records.score || 0),
    legacyScore: numberStat(records.legacyScore || 0),
    lifetimeScore: numberStat(records.lifetimeScore || 0),
    recordCount: numberStat(visibleRecords.length),
    completedRecords: numberStat(completedRecords.length),
    redeemedRecords: numberStat(redeemedRecords.length),
    completionRate: percentStat(numberStat(completedRecords.length), numberStat(visibleRecords.length))
  };
}

async function summarizeCrafting(characterCraftables, profileRecords = {}) {
  const aggregate = new Map();
  for (const [characterId, component] of Object.entries(characterCraftables || {})) {
    for (const [hash, craftable] of Object.entries(component?.craftables || {})) {
      const item = aggregate.get(hash) || {
        hash,
        visible: false,
        unlocked: false,
        failedRequirementCount: 0,
        socketCount: 0,
        plugCount: 0,
        unlockedPlugCount: 0,
        characterIds: new Set()
      };
      const visible = Boolean(craftable.visible);
      const recipeUnlocked = visible && !hasFailures(craftable.failedRequirementIndexes);
      const sockets = Array.isArray(craftable.sockets) ? craftable.sockets : [];
      let plugCount = 0;
      let unlockedPlugCount = 0;
      for (const socket of sockets) {
        for (const plug of socket.plugs || []) {
          plugCount += 1;
          if (!hasFailures(plug.failedRequirementIndexes)) unlockedPlugCount += 1;
        }
      }

      item.visible = item.visible || visible;
      item.unlocked = item.unlocked || recipeUnlocked;
      item.failedRequirementCount = Math.max(item.failedRequirementCount, Array.isArray(craftable.failedRequirementIndexes) ? craftable.failedRequirementIndexes.length : 0);
      item.socketCount = Math.max(item.socketCount, sockets.length);
      item.plugCount = Math.max(item.plugCount, plugCount);
      item.unlockedPlugCount = Math.max(item.unlockedPlugCount, unlockedPlugCount);
      item.characterIds.add(characterId);
      aggregate.set(hash, item);
    }
  }

  const entries = Array.from(aggregate.values()).filter((item) => item.visible);
  const enriched = await enrichCraftableItems(entries, profileRecords);
  const unlocked = entries.filter((item) => item.unlocked).length;
  const plugCount = entries.reduce((sum, item) => sum + item.plugCount, 0);
  const unlockedPlugCount = entries.reduce((sum, item) => sum + item.unlockedPlugCount, 0);

  return {
    total: numberStat(entries.length),
    unlocked: numberStat(unlocked),
    locked: numberStat(Math.max(0, entries.length - unlocked)),
    completionRate: percentStat(numberStat(unlocked), numberStat(entries.length)),
    plugTotal: numberStat(plugCount),
    plugUnlocked: numberStat(unlockedPlugCount),
    plugCompletionRate: percentStat(numberStat(unlockedPlugCount), numberStat(plugCount)),
    items: enriched
  };
}

async function enrichCraftableItems(items, profileRecords = {}) {
  const selected = items
    .sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.unlockedPlugCount - a.unlockedPlugCount || Number(a.hash) - Number(b.hash))
    .slice(0, 260);
  const definitions = await getInventoryItemDefinitions(selected.map((item) => item.hash));
  return selected.map((item) => {
    const definition = definitions.get(String(item.hash)) || {};
    const craftingInfo = definition.craftingInfo || {};
    const pattern = craftingPatternProgress(craftingInfo, profileRecords, item.unlocked);
    return {
      hash: item.hash,
      name: cleanText(definition.displayProperties?.name) || `装备 ${item.hash}`,
      type: definition.itemTypeDisplayName || '',
      icon: inventoryItemIcon(definition),
      tier: definition.inventory?.tierTypeName || '',
      source: cleanText(craftingInfo.source) || '其他来源',
      sourceHash: craftingInfo.sourceHash || 0,
      patternRecordHash: craftingInfo.patternRecordHash || 0,
      patternObjectiveHash: craftingInfo.patternObjectiveHash || 0,
      pattern,
      visible: Boolean(item.visible),
      unlocked: Boolean(item.unlocked),
      failedRequirementCount: numberStat(item.failedRequirementCount),
      socketCount: numberStat(item.socketCount),
      plugCount: numberStat(item.plugCount),
      unlockedPlugCount: numberStat(item.unlockedPlugCount),
      plugCompletionRate: percentStat(numberStat(item.unlockedPlugCount), numberStat(item.plugCount)),
      characterCount: numberStat(item.characterIds.size)
    };
  });
}

async function getInventoryItemDefinitions(hashes) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean).map(String)));
  const staticItems = await loadStaticGearItems();
  const byHash = new Map(staticItems.map((item) => [String(item.hash), item]));
  const entries = await mapWithConcurrency(uniqueHashes, activityDefinitionConcurrency(), async (hash) => {
    if (ITEM_DEFINITION_CACHE.has(hash)) return [hash, ITEM_DEFINITION_CACHE.get(hash)];
    const staticItem = byHash.get(hash);
    const definition = staticItem
      ? staticGearDefinition(staticItem)
      : (await bungieFetch(`/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/?lc=${encodeURIComponent(process.env.BUNGIE_LOCALE || 'zh-chs')}`, { method: 'GET' })).Response || {};
    ITEM_DEFINITION_CACHE.set(hash, definition);
    return [hash, definition];
  });
  return new Map(entries);
}

async function loadStaticGearItems() {
  const locale = process.env.BUNGIE_LOCALE || 'zh-chs';
  const cacheKey = ['static-gear-items', CACHE_VERSION, locale].join(':');
  const cached = GEAR_INDEX_CACHE.get(cacheKey);
  if (cached) return cached;
  const filePath = path.join(PUBLIC_DIR, 'data', `gear-index-${locale}.json`);
  if (!existsSync(filePath)) return [];
  const index = JSON.parse(await readFile(filePath, 'utf8'));
  const items = [
    ...(index.items || []).filter((item) => item.kind === 'weapon'),
    ...(index.craftables || [])
  ];
  GEAR_INDEX_CACHE.set(cacheKey, items);
  return items;
}

function staticGearDefinition(item) {
  return {
    displayProperties: {
      name: item.name,
      icon: item.icon || ''
    },
    itemTypeDisplayName: item.weaponType || item.type || '',
    inventory: {
      tierTypeName: item.tier || ''
    },
    craftingInfo: {
      source: item.source || '',
      sourceHash: item.sourceHash || 0,
      patternRecordHash: item.patternRecordHash || 0,
      patternObjectiveHash: item.patternObjectiveHash || 0,
      outputItemHash: item.outputItemHash || 0,
      outputCollectibleHash: item.outputCollectibleHash || 0,
      watermark: item.watermark || ''
    }
  };
}

function craftingPatternProgress(craftingInfo, profileRecords, unlocked) {
  const recordHash = craftingInfo.patternRecordHash ? String(craftingInfo.patternRecordHash) : '';
  const objectiveHash = craftingInfo.patternObjectiveHash ? String(craftingInfo.patternObjectiveHash) : '';
  const record = recordHash ? profileRecords?.[recordHash] : null;
  const objective = (record?.objectives || []).find((entry) => String(entry.objectiveHash) === objectiveHash) || record?.objectives?.[0] || null;
  if (!objective) {
    const fallback = unlocked ? 1 : 0;
    return {
      current: numberStat(fallback),
      required: numberStat(unlocked ? 1 : 0),
      complete: Boolean(unlocked),
      label: unlocked ? '1/1' : '-',
      percent: unlocked ? 100 : 0
    };
  }

  const required = Math.max(0, Number(objective.completionValue || 0));
  const current = Math.max(0, Math.min(required || Number(objective.progress || 0), Number(objective.progress || 0)));
  const complete = Boolean(objective.complete) || (required > 0 && current >= required);
  return {
    current: numberStat(current),
    required: numberStat(required),
    complete,
    label: required > 0 ? `${current}/${required}` : '-',
    percent: required > 0 ? Math.max(0, Math.min(100, (current / required) * 100)) : 0
  };
}

function inventoryItemIcon(definition) {
  const icon = definition.displayProperties?.icon || '';
  if (!icon) return '';
  return icon.startsWith('http') ? icon : `https://www.bungie.net${icon}`;
}

function hasFailures(value) {
  return Array.isArray(value) && value.length > 0;
}

function privacyLabel(value) {
  const number = Number(value);
  if (number === 1) return 'public';
  if (number === 2) return 'private';
  return 'none';
}

async function getCachedJson(cache, key, ttlSeconds, producer) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return {
      value: cloneJson(cached.value),
      status: 'hit',
      cachedAt: cached.cachedAt,
      ttlSeconds
    };
  }

  const value = await producer();
  const cachedAt = new Date().toISOString();
  cache.set(key, {
    value: cloneJson(value),
    cachedAt,
    expiresAt: now + ttlSeconds * 1000
  });
  return {
    value: cloneJson(value),
    status: 'miss',
    cachedAt,
    ttlSeconds
  };
}

function summaryCacheTtlSeconds() {
  return positiveNumber(process.env.SUMMARY_CACHE_TTL_SECONDS, positiveNumber(process.env.CAREER_CACHE_TTL_SECONDS, 300));
}

function endgameCacheTtlSeconds() {
  return positiveNumber(process.env.ENDGAME_CACHE_TTL_SECONDS, positiveNumber(process.env.CAREER_CACHE_TTL_SECONDS, 900));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function nodeGearDeps() {
  const locale = process.env.BUNGIE_LOCALE || 'zh-chs';
  return {
    apiKey: process.env.BUNGIE_API_KEY,
    locale,
    timeoutMs: positiveNumber(process.env.GEAR_MANIFEST_TIMEOUT_MS, positiveNumber(process.env.REQUEST_TIMEOUT_MS, 30000)),
    maxBytes: positiveNumber(process.env.GEAR_MANIFEST_MAX_BYTES, 80_000_000),
    cacheTtlSeconds: positiveNumber(process.env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),
    loadStaticGearIndex: async () => {
      const filePath = path.join(PUBLIC_DIR, 'data', `gear-index-${locale}.json`);
      if (!existsSync(filePath)) return null;
      return JSON.parse(await readFile(filePath, 'utf8'));
    },
    getCachedJson: (key, ttlSeconds, producer) => getCachedJson(GEAR_INDEX_CACHE, key, ttlSeconds, producer)
  };
}

function parseBungieName(input) {
  const text = cleanText(input);
  const match = text.match(/^(.{1,32})#(\d{3,8})$/u);
  if (!match) return null;
  return {
    displayName: match[1].trim(),
    displayNameCode: Number(match[2])
  };
}

function selectMembership(memberships) {
  return (
    memberships.find((item) => Number(item.crossSaveOverride) > 0 && Number(item.crossSaveOverride) === Number(item.membershipType)) ||
    memberships.find((item) => Number(item.crossSaveOverride) > 0) ||
    memberships[0]
  );
}

async function bungieFetch(pathname, options = {}) {
  const { response, text } = await requestText(`https://www.bungie.net${pathname}`, {
    ...options,
    maxBytes: positiveNumber(process.env.BUNGIE_MAX_BYTES, 20_000_000),
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.BUNGIE_API_KEY,
      'accept-language': process.env.BUNGIE_LOCALE || 'zh-chs',
      ...(options.headers || {})
    }
  });

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw httpError(502, 'BUNGIE_INVALID_JSON', 'Bungie API returned invalid JSON');
  }

  if (!response.ok || (payload.ErrorCode && payload.ErrorCode !== 1)) {
    throw httpError(response.ok ? 502 : response.status || 502, 'BUNGIE_API_ERROR', payload.Message || `Bungie API returned HTTP ${response.status}`);
  }
  return payload;
}

function summarizeCareer(query, membership, memberships, profileResponse, statsResponse) {
  const profile = profileResponse.profile?.data || {};
  const characters = Object.values(profileResponse.characters?.data || {}).map((character) => ({
    id: character.characterId,
    className: className(character.classType),
    raceName: raceName(character.raceType),
    genderName: genderName(character.genderType),
    light: character.light,
    level: character.levelProgression?.level,
    emblemPath: character.emblemPath ? `https://www.bungie.net${character.emblemPath}` : '',
    minutesPlayedTotal: Number(character.minutesPlayedTotal || 0),
    dateLastPlayed: character.dateLastPlayed
  }));

  const merged = statsResponse.mergedAllCharacters?.results || {};
  const overall = merged.merged?.allTime || {};
  const pve = merged.allPvE?.allTime || {};
  const pvp = merged.allPvP?.allTime || {};
  const raid = findModeBucket(merged, ['raid', 'allRaid']);
  const dungeon = findModeBucket(merged, ['dungeon', 'allDungeon']);

  return {
    queriedName: `${query.displayName}#${query.displayNameCode}`,
    updatedAt: new Date().toISOString(),
    account: {
      displayName: displayMembershipName(membership),
      membershipType: membership.membershipType,
      membershipTypeName: membershipTypeName(membership.membershipType),
      membershipId: membership.membershipId,
      crossSaveOverride: membership.crossSaveOverride || 0,
      linkedAccounts: memberships.map((item) => ({
        displayName: displayMembershipName(item),
        membershipType: item.membershipType,
        membershipTypeName: membershipTypeName(item.membershipType),
        membershipId: item.membershipId,
        crossSaveOverride: item.crossSaveOverride || 0
      }))
    },
    profile: {
      dateLastPlayed: profile.dateLastPlayed || null,
      guardianRank: profile.currentGuardianRank || null,
      lifetimeHighestGuardianRank: profile.lifetimeHighestGuardianRank || null,
      characterCount: characters.length,
      maxLight: characters.reduce((max, character) => Math.max(max, Number(character.light || 0)), 0),
      totalMinutesPlayed: characters.reduce((sum, character) => sum + Number(character.minutesPlayedTotal || 0), 0)
    },
    characters,
    stats: {
      overall: pickStats(overall),
      pve: pickStats(pve),
      pvp: pickStats(pvp),
      raid: pickEndgameStats(raid),
      dungeon: pickEndgameStats(dungeon)
    }
  };
}

async function getEndgameCareer(membership, characters, modes = ['raid', 'dungeon']) {
  const pageLimit = Number(process.env.ENDGAME_HISTORY_PAGE_LIMIT || 50);
  const pageSize = Number(process.env.ENDGAME_HISTORY_PAGE_SIZE || 250);
  const modeConfig = {
    raid: { apiMode: 4, hashes: new Map() },
    dungeon: { apiMode: 82, hashes: new Map() }
  };
  const selectedModes = normalizeEndgameModes(modes);
  const warnings = [];

  await Promise.all(
    characters.flatMap((character) =>
      selectedModes.map((modeName) =>
        collectEndgameHistory(
          membership,
          character.id,
          modeName,
          modeConfig[modeName].apiMode,
          pageSize,
          pageLimit,
          modeConfig[modeName].hashes,
          warnings
        )
      )
    )
  );

  const hashes = selectedModes.flatMap((modeName) => [...modeConfig[modeName].hashes.keys()]);
  const definitions = await getActivityDefinitions(hashes, warnings);

  const result = {
    pageLimit,
    pageSize,
    warnings
  };
  for (const modeName of selectedModes) {
    result[modeName] = buildEndgameMode(modeName, modeConfig[modeName].hashes, definitions);
  }
  return result;
}

async function collectEndgameHistory(membership, characterId, modeName, mode, pageSize, pageLimit, output, warnings) {
  for (let page = 0; page < pageLimit; page += 1) {
    const payload = await bungieFetch(
      `/Platform/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${pageSize}&page=${page}`,
      { method: 'GET' }
    );
    const activities = Array.isArray(payload.Response?.activities) ? payload.Response.activities : [];
    for (const activity of activities) {
      addEndgameActivity(output, activity, characterId, modeName);
    }
    if (activities.length < pageSize) return;
  }

  warnings.push(`${modeName}:${characterId} reached page limit ${pageLimit}`);
}

function addEndgameActivity(output, activity, characterId, modeName) {
  const hash = String(activity.activityDetails?.referenceId || activity.activityDetails?.directorActivityHash || '');
  if (!hash) return;

  if (!output.has(hash)) {
    output.set(hash, {
      hash,
      mode: modeName,
      attempts: 0,
      clears: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      seconds: 0,
      soloClears: 0,
      soloFlawlessClears: 0,
      bestSeconds: null,
      lastPlayed: null,
      characters: new Set()
    });
  }

  const item = output.get(hash);
  const values = activity.values || {};
  const completed = statValue(values.completed) > 0;
  const playerCount = statValue(values.playerCount);
  const deaths = statValue(values.deaths);
  const isSolo = completed && playerCount === 1;
  const isSoloFlawless = isSolo && deaths === 0;
  const seconds = statValue(values.timePlayedSeconds) || statValue(values.activityDurationSeconds);
  item.attempts += 1;
  item.clears += completed ? 1 : 0;
  item.kills += statValue(values.kills);
  item.deaths += deaths;
  item.assists += statValue(values.assists);
  item.seconds += seconds;
  item.soloClears += isSolo ? 1 : 0;
  item.soloFlawlessClears += isSoloFlawless ? 1 : 0;
  item.characters.add(characterId);

  if (completed && seconds > 0 && (item.bestSeconds == null || seconds < item.bestSeconds)) {
    item.bestSeconds = seconds;
  }
  if (activity.period && (!item.lastPlayed || new Date(activity.period) > new Date(item.lastPlayed))) {
    item.lastPlayed = activity.period;
  }
}

async function getActivityDefinitions(hashes, warnings) {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean)));
  const entries = await mapWithConcurrency(
    uniqueHashes,
    activityDefinitionConcurrency(),
    async (hash) => {
      if (ACTIVITY_DEFINITION_CACHE.has(hash)) return [hash, ACTIVITY_DEFINITION_CACHE.get(hash)];
      try {
        const payload = await bungieFetch(`/Platform/Destiny2/Manifest/DestinyActivityDefinition/${hash}/?lc=zh-chs`, { method: 'GET' });
        const definition = payload.Response || {};
        const mapped = {
          name: cleanText(definition.displayProperties?.name) || `活动 ${hash}`,
          description: cleanText(definition.displayProperties?.description),
          image: definition.pgcrImage ? `https://www.bungie.net${definition.pgcrImage}` : '',
          activityTypeHash: definition.activityTypeHash || null
        };
        ACTIVITY_DEFINITION_CACHE.set(hash, mapped);
        return [hash, mapped];
      } catch (error) {
        warnings.push(`activity:${hash}:${error.code || error.message}`);
        return [hash, { name: `活动 ${hash}`, description: '', image: '', activityTypeHash: null }];
      }
    }
  );
  return new Map(entries);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function activityDefinitionConcurrency() {
  return Math.max(1, Math.min(6, positiveNumber(process.env.ACTIVITY_DEFINITION_CONCURRENCY, 4)));
}

function buildEndgameMode(modeName, hashGroups, definitions) {
  const byName = new Map();

  for (const item of hashGroups.values()) {
    const definition = definitions.get(item.hash) || {};
    const name = normalizeEndgameActivityName(definition.name || `活动 ${item.hash}`);
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        mode: modeName,
        attempts: 0,
        clears: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        seconds: 0,
        soloClears: 0,
        soloFlawlessClears: 0,
        bestSeconds: null,
        lastPlayed: null,
        image: definition.image || '',
        hashes: new Set(),
        characterIds: new Set(),
        variants: []
      });
    }

    const group = byName.get(name);
    const variant = formatEndgameVariant(item, definition);
    group.attempts += item.attempts;
    group.clears += item.clears;
    group.kills += item.kills;
    group.deaths += item.deaths;
    group.assists += item.assists;
    group.seconds += item.seconds;
    group.soloClears += item.soloClears;
    group.soloFlawlessClears += item.soloFlawlessClears;
    group.hashes.add(item.hash);
    for (const characterId of item.characters) group.characterIds.add(characterId);
    group.variants.push(variant);
    if (!group.image && definition.image) group.image = definition.image;
    if (item.bestSeconds != null && (group.bestSeconds == null || item.bestSeconds < group.bestSeconds)) {
      group.bestSeconds = item.bestSeconds;
    }
    if (item.lastPlayed && (!group.lastPlayed || new Date(item.lastPlayed) > new Date(group.lastPlayed))) {
      group.lastPlayed = item.lastPlayed;
    }
  }

  const activities = Array.from(byName.values())
    .map((item) => formatEndgameActivity(item))
    .sort((a, b) => b.clears.value - a.clears.value || b.attempts.value - a.attempts.value || a.name.localeCompare(b.name, 'zh-CN'));

  const rawTotal = activities.reduce(
    (total, item) => {
      total.attempts += item.attempts.value;
      total.clears += item.clears.value;
      total.kills += item.kills.value;
      total.deaths += item.deaths.value;
      total.assists += item.assists.value;
      total.seconds += item.seconds.value;
      return total;
    },
    { attempts: 0, clears: 0, kills: 0, deaths: 0, assists: 0, seconds: 0 }
  );

  return {
    total: formatEndgameTotal(rawTotal),
    activities
  };
}

function formatEndgameActivity(item) {
  const base = formatEndgameTotal(item);
  const variants = item.variants
    .sort((a, b) => b.clears.value - a.clears.value || b.attempts.value - a.attempts.value || a.name.localeCompare(b.name, 'zh-CN'));
  return {
    name: item.name,
    mode: item.mode,
    image: item.image,
    variantCount: item.hashes.size,
    variants,
    characterCount: item.characterIds.size,
    lastPlayed: item.lastPlayed,
    bestSeconds: item.bestSeconds == null ? null : numberStat(item.bestSeconds),
    bestTime: item.bestSeconds == null ? null : secondsDisplayStat(item.bestSeconds),
    ...base
  };
}

function formatEndgameVariant(item, definition) {
  const base = formatEndgameTotal(item);
  return {
    hash: item.hash,
    name: cleanText(definition.name) || `活动 ${item.hash}`,
    image: definition.image || '',
    lastPlayed: item.lastPlayed,
    bestSeconds: item.bestSeconds == null ? null : numberStat(item.bestSeconds),
    bestTime: item.bestSeconds == null ? null : secondsDisplayStat(item.bestSeconds),
    ...base
  };
}

function formatEndgameTotal(item) {
  const attempts = Number(item.attempts || 0);
  const clears = Number(item.clears || 0);
  const kills = Number(item.kills || 0);
  const deaths = Number(item.deaths || 0);
  const seconds = Number(item.seconds || 0);
  const soloClears = Number(item.soloClears || 0);
  const soloFlawlessClears = Number(item.soloFlawlessClears || 0);
  return {
    activitiesEntered: numberStat(attempts),
    attempts: numberStat(attempts),
    clears: numberStat(clears),
    activitiesCleared: numberStat(clears),
    kills: numberStat(kills),
    deaths: numberStat(deaths),
    assists: numberStat(Number(item.assists || 0)),
    soloClears: numberStat(soloClears),
    soloFlawlessClears: numberStat(soloFlawlessClears),
    secondsPlayed: secondsDisplayStat(seconds),
    seconds: numberStat(seconds),
    hours: decimalStat(seconds / 3600, 1),
    kd: ratioStat(kills, deaths),
    completionRate: percentStat(numberStat(clears), numberStat(attempts))
  };
}

function normalizeEndgameActivityName(name) {
  return cleanText(name)
    .replace(/:\s*(标准|普通|大师|传说|英雄|自定义)$/u, '')
    .replace(/\s+\((标准|普通|大师|传说|英雄|自定义)\)$/u, '');
}

function statValue(entry) {
  const value = Number(entry?.basic?.value ?? entry?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function findModeBucket(results, names) {
  for (const name of names) {
    if (results?.[name]?.allTime) return results[name].allTime;
  }

  const normalizedNames = new Set(names.map((name) => normalizeStatModeKey(name)));
  for (const [key, value] of Object.entries(results || {})) {
    if (normalizedNames.has(normalizeStatModeKey(key)) && value?.allTime) {
      return value.allTime;
    }
  }
  return {};
}

function normalizeStatModeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickEndgameStats(bucket) {
  const base = pickStats(bucket);
  const clears = base.activitiesCleared || base.activitiesWon;
  return {
    ...base,
    clears,
    completionRate: percentStat(clears, base.activitiesEntered)
  };
}

function pickStats(bucket) {
  return {
    activitiesEntered: stat(bucket, 'activitiesEntered'),
    activitiesCleared: stat(bucket, 'activitiesCleared'),
    activitiesWon: stat(bucket, 'activitiesWon'),
    kills: stat(bucket, 'kills'),
    deaths: stat(bucket, 'deaths'),
    assists: stat(bucket, 'assists'),
    kd: stat(bucket, 'killsDeathsRatio'),
    kda: stat(bucket, 'killsDeathsAssists'),
    efficiency: stat(bucket, 'efficiency'),
    precisionKills: stat(bucket, 'precisionKills'),
    resurrectionsPerformed: stat(bucket, 'resurrectionsPerformed'),
    secondsPlayed: stat(bucket, 'secondsPlayed') || stat(bucket, 'totalActivityDurationSeconds')
  };
}

function percentStat(numerator, denominator) {
  const top = Number(numerator?.value);
  const bottom = Number(denominator?.value);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return null;
  const value = (top / bottom) * 100;
  return {
    value,
    displayValue: `${value.toFixed(1)}%`
  };
}

function numberStat(value) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(number)
  };
}

function decimalStat(value, digits = 2) {
  const number = Number(value || 0);
  return {
    value: number,
    displayValue: new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(number)
  };
}

function ratioStat(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (bottom <= 0) return top > 0 ? decimalStat(top, 2) : null;
  return decimalStat(top / bottom, 2);
}

function secondsDisplayStat(seconds) {
  const value = Number(seconds || 0);
  if (!value) return { value: 0, displayValue: '-' };
  const hours = value / 3600;
  if (hours >= 1) return { value, displayValue: `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(hours)} 小时` };
  const minutes = Math.round(value / 60);
  return { value, displayValue: `${minutes} 分钟` };
}

function stat(bucket, key) {
  const entry = bucket?.[key];
  if (!entry?.basic) return null;
  return {
    value: entry.basic.value,
    displayValue: entry.basic.displayValue
  };
}

function displayMembershipName(item) {
  if (item.bungieGlobalDisplayName) {
    return `${item.bungieGlobalDisplayName}#${String(item.bungieGlobalDisplayNameCode || '').padStart(4, '0')}`;
  }
  if (item.displayNameCode) return `${item.displayName}#${item.displayNameCode}`;
  return item.displayName || item.membershipId;
}

function membershipTypeName(type) {
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

function className(type) {
  return ['泰坦', '猎人', '术士'][Number(type)] || '未知职业';
}

function raceName(type) {
  return ['人类', '觉醒者', 'EXO'][Number(type)] || '未知种族';
}

function genderName(type) {
  return ['男性', '女性'][Number(type)] || '未知';
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
