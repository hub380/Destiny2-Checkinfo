# 装备索引拆分方案草案

## 背景

当前 `public/data/gear-index-zh-chs.json` 是单体压缩 JSON，体积约 14.6 MB。虽然文件只有 1 行，但后端的装备搜索、装备详情、perk 反查都会加载同一份全量索引，Workers 冷启动、内存占用和 R2/KV 缓存效率都会受影响。

拆分目标不是把一个大 JSON 换成另一个大 JSON，而是把不同查询路径需要的数据拆开。搜索只读轻量搜索索引，详情只读单件装备分片，perk 反查只读预计算的轻量反查结果。

## 修正后的关键判断

### 1. 不使用中文首字前缀路由

当前搜索语义是 `searchText.includes(terms)`，不是名称前缀搜索。按中文首字切分会漏结果。

典型反例：

- 搜索 `门徒誓约` 时，`灾变` 的 `searchText` 包含 `门徒誓约`，但如果它只放在 `灾` 字分片，按前缀路由不会加载这个分片。
- 搜索 `枪管`、`烈日`、`重型`、活动名、来源名时，都可能命中跨大量名称前缀的装备。

因此搜索索引应优先按现有接口已经支持的 `kind` 维度切分，而不是按名称首字切分。

### 2. `perk-weapons/{perkHash}.json` 不能保存完整武器详情

某些通用 perk 会命中大量武器。例如 `螺旋膛线` 可能命中 1000+ 件武器。如果每件武器都带 `stats + sockets + screenshot`，单个 `perk-weapons` 文件可能超过 2 MB。

因此 perk 反查分片只保存轻量 weapon ref 和命中信息。用户点击具体武器后，再调用 `/api/gear/item` 读取单件装备详情。

## 设计目标

- 前端 API 不变，继续调用 `/api/gear/search`、`/api/gear/item`、`/api/gear/perk-weapons`。
- 前端不感知 Bungie Manifest、R2 分片、hash 解析细节。
- 后端返回 DTO 保持稳定，分片只是后端内部实现。
- 搜索分片保持轻量，不携带完整 sockets、stats、screenshot。
- R2 存 canonical 分片，KV 和内存只缓存热点小对象。
- Bungie Manifest 自动生成基础数据，人工 overlay 只补 Bungie 不稳定或缺失的来源、别名、关卡掉落。

## 推荐对象布局

```text
gear-cache/v2/zh-chs/latest.json
gear-cache/v2/zh-chs/{manifestVersion}/meta.json
gear-cache/v2/zh-chs/{manifestVersion}/source-aliases.json
gear-cache/v2/zh-chs/{manifestVersion}/search/weapons.json
gear-cache/v2/zh-chs/{manifestVersion}/search/armors.json
gear-cache/v2/zh-chs/{manifestVersion}/search/perks.json
gear-cache/v2/zh-chs/{manifestVersion}/items/{bucket}/{hash}.json
gear-cache/v2/zh-chs/{manifestVersion}/perk-weapons/{perkHash}.json
gear-cache/v2/zh-chs/{manifestVersion}/sources/{sourceKey}.json
gear-cache/v2/zh-chs/{manifestVersion}/armor-sets/{setHash}.json
```

如果 `search/weapons.json` 后续仍然过大，可以再按 hash bucket 切成 `search/weapons/00.json` 到 `search/weapons/0f.json`。但默认 `kind=weapon` 或 `kind=all` 的子串搜索仍需要扫描所有 weapon bucket，hash bucket 只用于降低单对象体积和 R2 单次读取压力，不用于减少总扫描范围。

## 预期文件规模

| 文件 | 目标体积 | 说明 |
|---|---:|---|
| `latest.json` | < 5 KB | 指向当前 manifest 版本和根路径 |
| `meta.json` | < 20 KB | 统计、生成时间、schema 信息 |
| `source-aliases.json` | < 80 KB | 活动中文、英文、简称映射 |
| `search/weapons.json` | 1-4 MB | 轻量武器搜索数据，不含完整详情 |
| `search/armors.json` | 1-3 MB | 轻量护甲搜索数据，带 set bonus 排序标记 |
| `search/perks.json` | 0.3-1 MB | 轻量 perk 搜索数据 |
| `items/{bucket}/{hash}.json` | 5-80 KB/个 | 单件装备详情 |
| `perk-weapons/{perkHash}.json` | 20 KB-2 MB/个 | 只保存轻量 weapon ref，通用 perk 仍可能偏大 |
| `sources/{sourceKey}.json` | 10-300 KB/个 | 活动掉落池和关卡掉落 |

## 搜索读取策略

`/api/gear/search` 根据 `kind` 决定读取哪些搜索分片：

| kind | 读取分片 |
|---|---|
| `weapon` | `search/weapons.json` |
| `armor` | `search/armors.json` |
| `perk` | `search/perks.json` |
| `all` | 三个搜索分片都读 |

这和当前 `searchText.includes(terms)` 语义一致。`source-aliases.json` 只用于识别活动来源并快速跳转到 `sources/{sourceKey}.json`，不能替代全文子串搜索。

## 示例 JSON

### latest.json

```json
{
  "schemaVersion": 2,
  "locale": "zh-chs",
  "manifestVersion": "244122.26.06.10.2000-1-bnet.65386",
  "root": "gear-cache/v2/zh-chs/244122.26.06.10.2000-1-bnet.65386",
  "generatedAt": "2026-06-25T04:30:00.000Z"
}
```

### meta.json

```json
{
  "schemaVersion": 2,
  "locale": "zh-chs",
  "manifestVersion": "244122.26.06.10.2000-1-bnet.65386",
  "generatedAt": "2026-06-25T04:30:00.000Z",
  "search": {
    "weapon": "search/weapons.json",
    "armor": "search/armors.json",
    "perk": "search/perks.json"
  },
  "counts": {
    "weapons": 1284,
    "armors": 2310,
    "perks": 2526,
    "sources": 146
  }
}
```

### search/weapons.json

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
      "icon": "/common/destiny2_content/icons/example.png",
      "tier": "传说",
      "weaponType": "线性融合步枪",
      "ammo": "重型",
      "element": "烈日",
      "sourceKeys": ["raid/vow-of-the-disciple"],
      "sourceNames": ["门徒誓约"],
      "searchText": "灾变 线性融合步枪 烈日 重型 门徒誓约 cataclysmic vow of the disciple",
      "detailPath": "items/24/2443900000.json",
      "flags": {
        "isAdept": false,
        "isExotic": false,
        "isCraftable": true
      }
    }
  ]
}
```

### search/armors.json

```json
{
  "schemaVersion": 2,
  "kind": "armor-search-index",
  "items": [
    {
      "hash": 987654321,
      "kind": "armor",
      "name": "示例胸甲",
      "icon": "/common/destiny2_content/icons/armor.png",
      "tier": "传说",
      "armorType": "胸甲",
      "classType": "泰坦",
      "sourceKeys": ["episode/revenant"],
      "sourceNames": ["亡灵回声"],
      "searchText": "示例胸甲 泰坦 胸甲 亡灵回声",
      "detailPath": "items/98/987654321.json",
      "armorSetHash": 111222333,
      "flags": {
        "hasSetBonus": true
      }
    }
  ]
}
```

### search/perks.json

```json
{
  "schemaVersion": 2,
  "kind": "perk-search-index",
  "items": [
    {
      "hash": 1556840489,
      "kind": "perk",
      "name": "诱导推销",
      "icon": "/common/destiny2_content/icons/perk.png",
      "searchText": "诱导推销 bait and switch",
      "perkWeaponsPath": "perk-weapons/1556840489.json"
    }
  ]
}
```

### items/24/2443900000.json

```json
{
  "schemaVersion": 2,
  "kind": "weapon-detail",
  "hash": 2443900000,
  "summary": {
    "name": "灾变",
    "icon": "/common/destiny2_content/icons/example.png",
    "screenshot": "/common/destiny2_content/screenshots/example.jpg",
    "weaponType": "线性融合步枪",
    "ammo": "重型",
    "element": "烈日",
    "sourceNames": ["门徒誓约"]
  },
  "stats": [
    { "name": "伤害", "value": 41 },
    { "name": "充能时间", "value": 533 },
    { "name": "稳定性", "value": 48 }
  ],
  "perkColumns": [
    {
      "name": "第 4 列",
      "perks": [
        {
          "hash": 1556840489,
          "name": "诱导推销",
          "enhanced": {
            "hash": 1556840490,
            "note": "强化后：持续时间增加"
          }
        }
      ]
    }
  ]
}
```

### perk-weapons/1556840489.json

```json
{
  "schemaVersion": 2,
  "kind": "perk-weapons",
  "perk": {
    "hash": 1556840489,
    "name": "诱导推销",
    "icon": "/common/destiny2_content/icons/perk.png"
  },
  "total": 86,
  "weapons": [
    {
      "hash": 2443900000,
      "name": "灾变",
      "icon": "/common/destiny2_content/icons/example.png",
      "weaponType": "线性融合步枪",
      "ammo": "重型",
      "element": "烈日",
      "sourceNames": ["门徒誓约"],
      "detailPath": "items/24/2443900000.json",
      "matchedColumns": ["第 4 列"],
      "canRoll": {
        "normal": true,
        "enhanced": true
      }
    }
  ]
}
```

### sources/raid-kings-fall.json

```json
{
  "schemaVersion": 2,
  "kind": "source-items",
  "sourceKey": "raid/kings-fall",
  "name": "国王的陨落",
  "aliases": ["国王陨落", "King's Fall", "kf"],
  "items": [
    {
      "hash": 222111333,
      "kind": "weapon",
      "name": "末日先知",
      "icon": "/common/destiny2_content/icons/weapon.png",
      "weaponType": "斥候步枪",
      "detailPath": "items/22/222111333.json"
    }
  ],
  "encounters": [
    {
      "key": "warpriest",
      "name": "战争祭司",
      "drops": [222111333, 987654321]
    }
  ]
}
```

## 后端读取路径

- `/api/gear/search`：读取 `latest.json` -> `meta.json` -> 按 `kind` 读取 `search/weapons.json`、`search/armors.json`、`search/perks.json`。
- `/api/gear/item`：按 hash 直接读取 `items/{bucket}/{hash}.json`。
- `/api/gear/perk-weapons`：先用 `search/perks.json` 确认 perk hash，再读取 `perk-weapons/{perkHash}.json`。
- 活动掉落搜索：通过 `source-aliases.json` 或搜索分片中的 `sourceNames/searchText` 找到 `sourceKey`，再读取 `sources/{sourceKey}.json`。

## 生成策略

- `buildGearIndex` 继续从 Bungie Manifest 生成规范化中间模型。
- 新增 split writer，将中间模型写成 v2 分片。
- GitHub Actions 每周生成并上传 R2。
- 上传时写入 `latest.json` 指针，避免覆盖正在使用的旧版本。
- API loader 先支持 v2 分片，短期保留旧单体 JSON fallback。

## 需要人工 overlay 的内容

- 活动别名：如 `国王陨落`、`KF`、`King's Fall`。
- Raid/地牢具体关卡掉落。
- Bungie Manifest 中来源描述过泛或无法稳定映射的掉落来源。
- 中文社区常用简称。

## 待讨论问题

- `search/weapons.json` 是否先单文件落地，还是直接拆成 hash bucket。
- 默认 `kind=all` 是否接受一次读取 3 个 compact 分片，还是前端默认要求用户选择 kind。
- `perk-weapons` 对通用 perk 是否需要分页，例如 `?pageSize=100`。
- 活动掉落来源是否允许社区维护 overlay。
- 旧单体索引 fallback 保留多久。
