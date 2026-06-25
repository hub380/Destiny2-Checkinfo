# Plan: 装备索引 v2 拆分

## 目标

将 `public/data/gear-index-zh-chs.json`（单体 14MB）拆分为按需读取的小文件结构，降低冷启动内存压力，加快各查询路径的响应速度。

**核心约束：**

- 前端 API 接口不变（`/api/gear/search`、`/api/gear/item`、`/api/gear/perk-weapons`）
- Worker 生产环境使用**全 R2 方案**，不依赖静态资产包提供装备数据
- 本地开发 / Node.js 服务器使用本地文件系统，无需 R2/KV
- 开源贡献者只需 `BUNGIE_API_KEY`，运行 `npm run gear:index` 即可本地运行

---

## 文件布局

### R2 对象路径（Worker 生产）

```
gear-cache/v2/{locale}/latest.json
gear-cache/v2/{locale}/{manifestVersion}/meta.json
gear-cache/v2/{locale}/{manifestVersion}/source-aliases.json
gear-cache/v2/{locale}/{manifestVersion}/search/weapons.json
gear-cache/v2/{locale}/{manifestVersion}/search/armors.json
gear-cache/v2/{locale}/{manifestVersion}/search/perks.json
gear-cache/v2/{locale}/{manifestVersion}/items/{bucket}/{hash}.json
gear-cache/v2/{locale}/{manifestVersion}/perk-weapons/{perkHash}.json
gear-cache/v2/{locale}/{manifestVersion}/sources/{sourceKey}.json
```

`{bucket}` = `String(hash % 100).padStart(2, '0')`（00–99，共 100 个目录）

### 本地 / 服务器路径（`npm run gear:index` 生成）

```
public/data/gear/
  latest.json
  meta.json
  source-aliases.json
  search/weapons.json
  search/armors.json
  search/perks.json
  items/{bucket}/{hash}.json       ← gitignore
  perk-weapons/{perkHash}.json     ← gitignore
  sources/{sourceKey}.json         ← gitignore
```

`npm run build` 将 `public/` 复制到 `dist/`，`server/index.js` 从 `dist/data/gear/` 读取。

---

## 数据 Schema

### `latest.json`

```json
{
  "schemaVersion": 2,
  "locale": "zh-chs",
  "manifestVersion": "244122.26.06.10.2000-1-bnet.65386",
  "root": "gear-cache/v2/zh-chs/244122.26.06.10.2000-1-bnet.65386",
  "generatedAt": "2026-06-25T04:30:00.000Z",
  "search": {
    "weapons": "search/weapons.json",
    "armors": "search/armors.json",
    "perks": "search/perks.json"
  }
}
```

### `search/weapons.json`（搜索层，不含完整详情）

```json
{
  "schemaVersion": 2,
  "kind": "weapon-search-index",
  "items": [
    {
      "hash": 2443900000,
      "kind": "weapon",
      "name": "灾变",
      "baseName": "灾变",
      "icon": "https://www.bungie.net/...",
      "tier": "传说",
      "weaponType": "线性融合步枪",
      "ammo": "重型",
      "element": "烈日",
      "adept": false,
      "sourceHints": [],
      "searchText": "灾变 线性融合步枪 烈日 重型 门徒誓约"
    }
  ]
}
```

`search/armors.json` 结构同理，保留 `hasSetBonus`、`setBonusName`（构建期从 armors 预填）、`slot`、`className`。

`search/perks.json` 每条保留 `hash`、`kind`、`name`、`icon`、`type`、`enhanced`、`category`、`searchText`。

### `items/{bucket}/{hash}.json`（单件详情）

**武器：**

```json
{
  "schemaVersion": 2,
  "kind": "weapon-detail",
  "hash": 2443900000,
  "name": "灾变",
  "baseName": "灾变",
  "icon": "https://www.bungie.net/...",
  "screenshot": "https://www.bungie.net/...",
  "weaponType": "线性融合步枪",
  "ammo": "重型",
  "element": "烈日",
  "adept": false,
  "stats": [{ "hash": 4284893193, "name": "充能时间", "value": 533, "displayMaximum": 100 }],
  "sockets": {
    "0": { "socketIndex": 0, "label": "框架 / 固有", "perks": [1458010786] },
    "3": { "socketIndex": 3, "label": "第 4 列", "perks": [1556840489, 460017080] }
  },
  "sourceHints": [{ "kind": "collectible", "label": "收藏品来源", "text": "门徒誓约", "hash": 0, "confidence": "hint" }],
  "crafting": null
}
```

`sockets[*].perks` 仍存 perk hash 列表，perk 完整数据由调用方从 `search/perks.json`（已在内存）解析，无需二次读取。

**护甲：**

```json
{
  "schemaVersion": 2,
  "kind": "armor-detail",
  "hash": 987654321,
  "name": "示例胸甲",
  "icon": "https://www.bungie.net/...",
  "type": "胸甲",
  "slot": "胸甲",
  "className": "泰坦",
  "tier": "传说",
  "stats": [],
  "setBonus": null,
  "intrinsicPerks": [],
  "sourceHints": []
}
```

### `perk-weapons/{perkHash}.json`（轻量反查，不含完整武器详情）

```json
{
  "schemaVersion": 2,
  "kind": "perk-weapons",
  "perkHash": 1556840489,
  "perkName": "诱导推销",
  "total": 86,
  "weapons": [
    {
      "hash": 2443900000,
      "name": "灾变",
      "baseName": "灾变",
      "icon": "https://www.bungie.net/...",
      "weaponType": "线性融合步枪",
      "ammo": "重型",
      "element": "烈日",
      "adept": false,
      "matchedColumns": ["第 4 列"],
      "canRoll": { "normal": true, "enhanced": true }
    }
  ]
}
```

### `sources/{sourceKey}.json`

`sourceKey` = Bungie `sourceHash`，以十进制字符串表示，例如 `160129377`。

```json
{
  "schemaVersion": 2,
  "kind": "source-items",
  "sourceKey": "160129377",
  "name": "国王的陨落突袭",
  "aliases": [],
  "items": [
    {
      "hash": 222111333,
      "kind": "weapon",
      "name": "末日先知",
      "icon": "https://www.bungie.net/...",
      "weaponType": "斥候步枪"
    }
  ],
  "encounters": []
}
```

`encounters` 初始为空数组，留作人工 overlay 扩展。

### `source-aliases.json`

```json
{
  "schemaVersion": 2,
  "aliases": {
    "kf": "160129377",
    "国王陨落": "160129377",
    "kings fall": "160129377"
  }
}
```

初始由构建脚本生成空对象，人工维护后提交 git。

---

## 任务列表

### Task 1 — 常量与版本标识

**文件：** `src/lib/gear/constants.js`

新增：

```js
export const GEAR_INDEX_V2 = 'gear-v2';
export const GEAR_V2_SCHEMA = 2;
export const GEAR_ITEM_BUCKET_COUNT = 100; // hash % 100
```

`GEAR_INDEX_VERSION`（旧单体版本）保留，供 fallback 使用。

---

### Task 2 — 构建期拆分写入器

**新建文件：** `src/lib/gear/split-writer.js`

接收现有 `buildGearIndex` 的返回值（包含 `items`、`weapons`、`armors`、`weaponPlugs`、`craftables`、`manifestVersion`），输出 v2 分片结构。

**导出函数：**

```js
/**
 * 将 index 对象拆分写入 outputDir。
 * outputDir 应为 public/data/gear/ 的绝对路径。
 */
export async function writeGearIndexV2(index, outputDir)
```

**内部逻辑：**

1. 生成 `latest.json` 和 `meta.json`
2. 生成 `source-aliases.json`（空 aliases 对象，若已存在则保留现有内容不覆盖）
3. 生成 `search/weapons.json`：遍历 `index.items`，过滤 `kind === 'weapon'`，每条保留搜索展示字段（`hash`、`kind`、`name`、`baseName`、`icon`、`tier`、`weaponType`、`ammo`、`element`、`adept`、`sourceHints`、`searchText`），**不包含** stats/sockets/screenshot
4. 生成 `search/armors.json`：过滤 `kind === 'armor'`，预填 `setBonusName`（从 `index.armors` 查找），保留搜索展示字段
5. 生成 `search/perks.json`：过滤 `kind === 'perk'`
6. 生成 `items/{bucket}/{hash}.json`：
   - 武器：从 `index.weapons` 查找对应记录，写入完整 weapon-detail
   - 护甲：从 `index.armors` 查找对应记录，写入完整 armor-detail
7. 生成 `perk-weapons/{perkHash}.json`：遍历 `index.weapons`，构建 `perkHash → weapons[]` 倒排 Map，每条 weapon 只保留轻量字段 + `matchedColumns` + `canRoll`
8. 生成 `sources/{sourceKey}.json`：按 `sourceHash` 聚合 items，每条只保留轻量引用字段

**约束：**

- 单件文件只使用 `JSON.stringify(obj)`（无缩进），减小体积
- 写文件前确保目录存在（`mkdirSync(dir, { recursive: true })`）
- `source-aliases.json` 采用 merge 策略：读取已有文件 → 合并新生成的 sourceKey → 写回，人工维护的别名不丢失

---

### Task 3 — 更新构建脚本

**文件：** `scripts/data/build-gear-index.js`

在现有逻辑末尾调用 `writeGearIndexV2`：

```js
import { writeGearIndexV2 } from '../../src/lib/gear/split-writer.js';

// 现有逻辑不变，保留写 gear-index-{locale}.json（单体文件，向后兼容）

const gearV2Dir = path.join(rootDir, 'public', 'data', 'gear');
await writeGearIndexV2(index, gearV2Dir);
console.log(`Wrote v2 split files to ${path.relative(rootDir, gearV2Dir)}/`);
```

---

### Task 4 — 更新 .gitignore

**文件：** `.gitignore`

新增：

```
# 装备索引 v2 生成文件（运行 npm run gear:index 生成）
public/data/gear/items/
public/data/gear/perk-weapons/
public/data/gear/sources/
```

`public/data/gear/search/`、`latest.json`、`meta.json`、`source-aliases.json` **不** 加入 gitignore，提交 git。

---

### Task 5 — 新增 Deps 接口抽象

**新建文件：** `src/lib/gear/deps.js`

仅文档注释，定义 deps 对象接口：

```js
/**
 * GearDeps 接口（由 worker-deps.js 和 server-deps.js 分别实现）
 *
 * @typedef {Object} GearDeps
 * @property {string} locale
 * @property {number} cacheTtlSeconds
 * @property {(path: string) => Promise<object|null>} readGearFile
 *   读取相对于 gear 根目录的文件（如 "search/weapons.json"）。
 *   返回解析后的 JSON 对象，文件不存在时返回 null。
 * @property {(key: string, ttl: number, producer: () => Promise<any>, options?: object) => Promise<any>} getCachedJson
 */
```

---

### Task 6 — 服务器 Deps 实现

**新建文件：** `src/lib/gear/server-deps.js`

```js
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MEM_CACHE = new Map();

export function serverGearDeps(distDir, options = {}) {
  const locale = options.locale || 'zh-chs';
  const gearDir = join(distDir, 'data', 'gear');

  return {
    locale,
    cacheTtlSeconds: options.cacheTtlSeconds || 604800,

    readGearFile: async (path) => {
      const full = join(gearDir, path);
      if (!existsSync(full)) return null;
      return JSON.parse(await readFile(full, 'utf8'));
    },

    getCachedJson: async (key, ttl, producer, opts = {}) => {
      const now = Date.now();
      const cached = MEM_CACHE.get(key);
      if (cached && cached.expiresAt > now) {
        return { value: cached.value, status: 'hit-memory', cachedAt: cached.cachedAt, ttlSeconds: ttl };
      }
      const value = await producer();
      const cachedAt = new Date().toISOString();
      MEM_CACHE.set(key, { value, cachedAt, expiresAt: now + ttl * 1000 });
      return { value, status: 'miss', cachedAt, ttlSeconds: ttl };
    }
  };
}
```

---

### Task 7 — Worker Deps 全 R2 实现

**文件：** `src/lib/gear/worker-deps.js`

**完全重写**，移除 `loadStaticGearIndex`，改为 `readGearFile` + `getLatestVersion` 缓存：

```js
import { httpError, positiveNumber } from '../http/index.js';
import { getWorkerCachedJson } from '../cache/index.js';

const DEFAULT_LOCALE = 'zh-chs';
const DEFAULT_GEAR_PREFIX = 'gear-cache';

export function workerGearDeps(env, ctx) {
  const locale = String(env.BUNGIE_LOCALE || DEFAULT_LOCALE).toLowerCase();
  const prefix = trimSlashes(env.R2_GEAR_PREFIX || DEFAULT_GEAR_PREFIX);

  return {
    locale,
    apiKey: env.BUNGIE_API_KEY,
    cacheTtlSeconds: positiveNumber(env.GEAR_INDEX_CACHE_TTL_SECONDS, 604800),

    readGearFile: async (path) => {
      const version = await getCachedLatestVersion(locale, prefix, env, ctx);
      if (!version) return null;
      const r2Key = `${prefix}/v2/${locale}/${version}/${path}`;
      if (!env.CAREER_R2?.get) return null;
      const obj = await env.CAREER_R2.get(r2Key);
      return obj ? obj.json() : null;
    },

    getCachedJson: (key, ttl, producer, options) =>
      getWorkerCachedJson(key, ttl, producer, env, ctx, options)
  };
}

async function getCachedLatestVersion(locale, prefix, env, ctx) {
  const kvKey = `gear-v2:latest-version:${locale}`;
  const cached = await getWorkerCachedJson(
    kvKey,
    300, // latest.json 缓存 5 分钟
    async () => {
      if (!env.CAREER_R2?.get) return null;
      const obj = await env.CAREER_R2.get(`${prefix}/v2/${locale}/latest.json`);
      if (!obj) return null;
      const latest = await obj.json();
      return latest?.manifestVersion || null;
    },
    env, ctx,
    { memoryOnly: false }
  );
  return cached.value;
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}
```

---

### Task 8 — 索引缓存层重写

**文件：** `src/lib/gear/index-cache.js`

移除 `getGearIndex`（整体索引），新增面向查询路径的加载函数：

```js
import { GEAR_INDEX_V2 } from './constants.js';

/** 加载搜索层（按 kind）。kind: 'weapon' | 'armor' | 'perk' */
export async function getSearchShard(kind, deps) {
  const key = `gear-v2:search:${kind}:${deps.locale}`;
  return deps.getCachedJson(key, deps.cacheTtlSeconds, async () => {
    const data = await deps.readGearFile(`search/${kind}s.json`);
    if (!data?.items) throw new Error(`gear search shard "${kind}s.json" not found`);
    return data.items;
  }, { memoryOnly: true, noClone: true });
}

/** 加载全部搜索层（kind=all 时并发读取） */
export async function getAllSearchShards(deps) {
  const [weapons, armors, perks] = await Promise.all([
    getSearchShard('weapon', deps),
    getSearchShard('armor', deps),
    getSearchShard('perk', deps)
  ]);
  return {
    value: [...weapons.value, ...armors.value, ...perks.value],
    status: [weapons.status, armors.status, perks.status].join(',')
  };
}

/** 加载单件装备详情 */
export async function getItemDetail(hash, deps) {
  const bucket = String(Number(hash) % 100).padStart(2, '0');
  const key = `gear-v2:item:${hash}:${deps.locale}`;
  return deps.getCachedJson(key, deps.cacheTtlSeconds, async () => {
    const data = await deps.readGearFile(`items/${bucket}/${hash}.json`);
    return data || null;
  }, { memoryOnly: true, noClone: true });
}

/** 加载 perk 反查结果 */
export async function getPerkWeaponsFile(perkHash, deps) {
  const key = `gear-v2:perk-weapons:${perkHash}:${deps.locale}`;
  return deps.getCachedJson(key, deps.cacheTtlSeconds, async () => {
    const data = await deps.readGearFile(`perk-weapons/${perkHash}.json`);
    return data || null;
  }, { memoryOnly: true, noClone: true });
}

/** 加载来源索引 */
export async function getSourceFile(sourceKey, deps) {
  const key = `gear-v2:source:${sourceKey}:${deps.locale}`;
  return deps.getCachedJson(key, deps.cacheTtlSeconds, async () => {
    const data = await deps.readGearFile(`sources/${sourceKey}.json`);
    return data || null;
  }, { memoryOnly: true, noClone: true });
}

/** 加载来源别名表（小文件，缓存常驻） */
export async function getSourceAliases(deps) {
  const key = `gear-v2:source-aliases:${deps.locale}`;
  return deps.getCachedJson(key, 86400, async () => {
    const data = await deps.readGearFile('source-aliases.json');
    return data?.aliases || {};
  }, { memoryOnly: true, noClone: true });
}
```

---

### Task 9 — 更新 Handlers

**文件：** `src/lib/gear/handlers.js`

重写三个 handler，使用 Task 8 的新函数。接口（入参/出参 DTO）保持不变。

#### `getGearSearch(body, deps)`

```
1. kind = normalizeGearKind(body.kind || 'all')
2. 若 kind === 'all'：调用 getAllSearchShards(deps)
   若指定 kind：调用 getSearchShard(kind, deps)
3. 检查 source alias：getSourceAliases(deps)，若 query 匹配 → 加载 getSourceFile(sourceKey, deps) → 组装结果返回（跳过步骤 4-5）
4. 按 searchText.includes(terms) 过滤 items
5. 排序、截断、调用 publicGearItem 输出
```

perk 类型搜索结果展示时，`publicGearItem` 直接从 search shard 数据构造，无需 perkMap，因为 perk 展示字段已在 search/perks.json 中。

#### `getGearItem(body, deps)`

```
1. 在搜索层（对应 kind 的 shard）定位 item（只取 hash/kind/name 等轻量字段）
2. 调用 getItemDetail(hash, deps) 获取完整 detail
3. 武器 detail 中 sockets[*].perks 是 hash 数组 → 用 search/perks.json 中的 perk 数据展开
4. 返回 publicGearItem(item) + publicGearDetailV2(detail, perkShard)
```

新增 `publicGearDetailV2(detail, perkItems)` 函数（在 `public.js`）：

- 武器：展开 sockets，将 perk hash 解析为完整 perk 对象（从 perkItems Map）
- 护甲：直接返回 detail 字段

#### `getPerkWeapons(body, deps)`

```
1. 在 search/perks.json 中搜索匹配的 perk（text/hash），获取 perkHash 列表
2. 对每个 perkHash 调用 getPerkWeaponsFile(perkHash, deps)（并发）
3. 合并、去重、按 baseName 聚合 variants、截断
4. 返回
```

---

### Task 10 — 更新 server/index.js

**文件：** `server/index.js`

新增 import：

```js
import { serverGearDeps } from '../src/lib/gear/server-deps.js';
```

在 `nodeEnv()` 函数中追加 `GEAR_DEPS` 字段：

```js
function nodeEnv() {
  return {
    ...process.env,
    ASSETS: { fetch: fetchLocalAsset },
    GEAR_DEPS: serverGearDeps(DIST_DIR, {
      locale: process.env.BUNGIE_LOCALE || 'zh-chs'
    })
  };
}
```

在 `workerGearDeps` 中识别 `env.GEAR_DEPS`：

**文件：** `src/lib/gear/worker-deps.js`（追加判断）

```js
export function workerGearDeps(env, ctx) {
  // 本地 / 服务器：直接使用注入的 server deps
  if (env.GEAR_DEPS) return env.GEAR_DEPS;
  // CF Workers：使用 R2 全量方案
  // ...（Task 7 的完整实现）
}
```

---

### Task 11 — 更新发布脚本

**文件：** `scripts/gear/publish-r2.js`

重写为发布 v2 分片结构：

**逻辑：**

1. 读取 `public/data/gear/latest.json`，获取 `manifestVersion`
2. 遍历 `public/data/gear/` 下所有文件，按路径映射到 R2 key：
   - 本地 `public/data/gear/search/weapons.json`
   - → R2 `gear-cache/v2/zh-chs/{manifestVersion}/search/weapons.json`
3. 对 `items/`、`perk-weapons/`、`sources/` 下的文件做批量上传（并发控制，默认 10）
4. 最后上传 `latest.json` 到 `gear-cache/v2/zh-chs/latest.json`（原子性地更新指针）
5. 可选：更新 KV 中的 `gear-v2:latest-version:{locale}` 指针，加速 Worker 冷启动

```
GEAR_INDEX_FILE 环境变量改为 GEAR_V2_DIR，指向 public/data/gear/ 目录
```

---

### Task 12 — 更新 GitHub Actions

**文件：** `.github/workflows/gear-cache.yml`

构建步骤不变（`npm run gear:index`），发布步骤改为 v2：

```yaml
- name: Publish gear index v2 to R2
  run: npm run gear:publish-r2
  env:
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    BUNGIE_LOCALE: zh-chs
    R2_BUCKET: destiny2-checkinfo-data
    R2_GEAR_PREFIX: gear-cache
    GEAR_V2_DIR: public/data/gear
```

---

### Task 13 — 更新测试

**文件：** `tests/lib.test.js`、`tests/app.test.js`

- 在 `lib.test.js` 中为 `split-writer.js` 新增单元测试：给定最小 index 对象，验证文件输出结构
- 在 `app.test.js` 中新增集成测试（使用 `serverGearDeps` 指向测试 fixture 目录），验证三个 API 的输入输出

---

## 兼容过渡策略

- **v1 单体文件**（`public/data/gear-index-zh-chs.json`）在 v2 稳定前保留，构建脚本同时输出两份
- `workerGearDeps` 读取失败时（R2 未配置 / latest.json 不存在）可在日志中提示，但不 fallback 到 v1（Worker 全 R2，不做静默降级）
- `serverGearDeps` 读取失败时（文件不存在）向上抛出可读错误，提示运行 `npm run gear:index`
- v1 文件移除时间：待 v2 在生产稳定运行 2 周后

---

## 验收标准

| 检查项 | 方法 |
|---|---|
| `getGearSearch("灾变")` 返回正确结果 | `tests/app.test.js` |
| `getGearSearch("国王的陨落")` 返回 28 条 | `tests/app.test.js` |
| `getGearSearch("kf")` 经 alias 返回 source 结果 | `tests/app.test.js` |
| `getGearItem({hash})` 武器返回完整 perkColumns | `tests/app.test.js` |
| `getPerkWeapons({query:"诱导推销"})` 返回武器列表 | `tests/app.test.js` |
| Worker 冷启动搜索只读取一个 search shard | 查看 `cache.status` 字段 |
| 单件 item 文件平均体积 < 3KB | 构建脚本输出日志 |
| `npm run gear:index && npm run dev` 本地无报错 | 手动验证 |
| `npm run test` 全部通过 | CI |
