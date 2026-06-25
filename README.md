# Destiny2 Checkinfo

## 项目主体和功能

Destiny2 Checkinfo 是一个面向《命运 2》玩家的 Web 工具，把组队信息、公开玩家生涯、装备 / Perk / 来源提示和攻略内容整合到一组轻量多页应用中。

### 功能一览

| 能力 | 页面 | 说明 |
|------|------|------|
| 小黑盒组队列表 | `/` | 30s 自动刷新（可关）、筛选、复制 `/j 名称#代码`、点击用户名查棒鸡生涯 |
| 简版玩家生涯 | `/` | 侧栏预览：光等、Raid/地牢汇总、角色列表；完整数据见 `career.html` |
| 完整玩家生涯 | `/career.html` | 摘要 + 渐进加载 Raid/地牢/PvP 历史、锻造进度弹窗、成就记录 |
| 棒鸡当前队伍 | `/fireteam.html` | 查询玩家当前公开队伍，成员生涯对比，渐进加载终局数据 |
| 装备 / Perk 搜索 | `/gear.html` | 武器/护甲/Perk 统一搜索、详情、Perk 反查武器、来源提示 |
| 攻略 / 资讯库 | `/guides.html` | 分类与搜索、深链打开详情；内容来自 R2（需上传管线） |

其他要点：

- 查询公开棒鸡玩家**不需要** OAuth 登录；仅需在服务端配置 `BUNGIE_API_KEY`。
- 武器来源提示来自 Manifest 可读字段，**仅供参考**，不等同于精确掉落表。
- 小黑盒组队无稳定公开文档；项目不提交私人 Cookie 或绕过鉴权逻辑。

线上地址：[Cloudflare Workers 线上版本](https://destiny2-fireteam-dashboard.tw9jigtk.workers.dev)

---

## 快速开始

**要求：** Node.js ≥ 18

```powershell
# 1. 环境变量（首次或更新模板后）
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# 编辑 .env，至少填入 BUNGIE_API_KEY（棒鸡开发者后台申请）

# 2. 依赖与静态数据（首次）
npm install
npm run activity:index
npm run gear:index

# 3. 开发模式（推荐：热更新 + API 联调）
npm run dev
```

- 页面：**http://localhost:5173**
- API：**http://localhost:5174/api/***（Vite 将 `/api` 代理到 5174）

生产预览（构建后本地静态服务）：

```powershell
npm run build
npm start
```

### 常用页面

| 路径 | 入口组件 | 用途 |
|------|-----------|------|
| `/`（`index.html`） | `HomePage` | 小黑盒组队 + 简版生涯 |
| `/career.html` | `CareerPage` | 完整玩家生涯 |
| `/gear.html` | `GearPage` | 装备、Perk、来源提示 |
| `/fireteam.html` | `FireteamPage` | Bungie 当前队伍 |
| `/guides.html` | `GuidesPage` | 攻略 / 资讯库 |

### 页面 URL 深链（可分享、支持浏览器前进/后退）

各页查询状态会同步到地址栏；`popstate` 时由统一 URL hooks 恢复状态。

| 页面 | 查询参数 | 示例 |
|------|-----------|------|
| 首页生涯 / `career.html` | `q` — 棒鸡名 `名称#数字` | `/career.html?q=Guardian%231234` |
| `fireteam.html` | `q` | `/fireteam.html?q=Guardian%231234` |
| `gear.html` | `q` 搜索词；`hash` 装备 hash | `/gear.html?q=锤击&hash=1234567890` |
| `guides.html` | `q` 搜索；`category` 分类；`slug` 打开详情 | `/guides.html?slug=example-raid-mechanics` |

首页锚点：`/#fireteams`、`/#career`（导航栏「小黑盒组队」指向 `/#fireteams`）。

---

## 环境变量

本地 API（`server/index.js`）读取根目录 `.env`；线上 Worker 使用 `wrangler.toml` 的 `[vars]` + Secret。完整列表见 `.env.example`。

| 分组 | 变量 | 用途 |
|------|------|------|
| Bungie | `BUNGIE_API_KEY` | **必填**（本地/线上），公开玩家与 Manifest |
| Bungie | `BUNGIE_LOCALE` | 默认 `zh-chs`，影响 Manifest 与展示文案 |
| Bungie | `BUNGIE_MEMBERSHIP_TYPE` | 默认 `-1`（全平台搜索） |
| Heybox | `HEYBOX_SOURCE_URL` 等 | 小黑盒组队源 URL、请求头、体积上限 |
| 缓存 TTL | `*_CACHE_TTL_SECONDS` | 摘要、终局、装备索引、攻略索引等 |
| 历史分页 | `ENDGAME_*`、`PVP_*` | Raid/地牢/PvP 历史拉取页数与每页条数 |
| R2 前缀 | `R2_SNAPSHOT_PREFIX` | 生涯大型快照对象前缀 |
| R2 前缀 | `R2_GUIDE_PREFIX` | 攻略索引与详情对象前缀（默认 `guides`） |
| R2 前缀 | `R2_GEAR_PREFIX` | 装备缓存对象前缀 |
| R2 | `R2_BUCKET` | 上传脚本用的 bucket 名（默认 `destiny2-checkinfo-data`） |
| R2 上传 | `R2_UPLOAD_LOCAL` | 设为 `1` 时 `guides:upload` 写入本地 wrangler R2 模拟 |

`.env` **不要**提交到 Git。线上密钥：

```powershell
npx wrangler secret put BUNGIE_API_KEY
```

---

## API 接口

路由定义：`src/app/router.js`。稳定路径如下（**已移除**旧别名 `/api/fireteams`，组队请用 `/api/heybox/teams`）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config-public` | 前端公开配置（是否已配 API Key、刷新间隔等） |
| GET | `/api/heybox/teams` | 小黑盒组队列表 |
| POST | `/api/destiny/summary` | 玩家生涯摘要（`bungieName`） |
| POST | `/api/destiny/details` | 锻造 / 成就等详情 |
| POST | `/api/destiny/endgame` | Raid / 地牢 / PvP 历史（`mode` 或 `modes`） |
| POST | `/api/destiny/player-search` | 棒鸡名称前缀搜索 |
| POST | `/api/destiny/fireteam` | Bungie **当前**公开队伍（非小黑盒列表） |
| POST | `/api/destiny/career` | 摘要 + 详情组合接口（部分场景一次性拉取） |
| POST | `/api/gear/search` | 装备 / Perk 搜索 |
| POST | `/api/gear/item` | 单件装备详情 |
| POST | `/api/gear/perk-weapons` | Perk 反查可出武器 |
| GET | `/api/gear/cache-status` | 装备索引缓存状态 |
| GET | `/api/guides` | 攻略索引列表 |
| GET | `/api/guides/:slug` | 攻略详情 JSON |
| GET | `/api/guides/:slug/media/*` | 攻略媒体代理 |

命名约定（代码侧）：

- **heybox** — 小黑盒组队数据源（UI 仍显示「小黑盒」）
- **bungie / destiny** — 棒鸡公开 API 与生涯逻辑
- **fireteam**（`/api/destiny/fireteam`）— 仅指 Bungie 当前队伍，与 heybox 组队列表区分

---

## 当前分支与架构

当前开发分支：[codex/merge-architecture-tests](https://github.com/hub380/Destiny2-Checkinfo/tree/codex/merge-architecture-tests)

与 `main` 对比：[compare/main...codex/merge-architecture-tests](https://github.com/hub380/Destiny2-Checkinfo/compare/main...codex/merge-architecture-tests)

### 前端

| 领域 | 说明 |
|------|------|
| 构建 | Vite 多页 + React 19 + TypeScript；`pages/*.html` → 独立 bundle |
| 布局 | `AppShell`、`Header`（含主题切换）、CSS Modules + `ui` / `motion` 令牌 |
| 生涯 | `useCareerSearchFlow` 统一首页与 `career.html`；`useCareerQuery` 渐进加载终局 |
| URL | `useUrlQuerySync` / `useUrlParamsSync` + `syncUrlParams`；`useUrlPopstate` |
| 玩家搜索 | `resolveBungieNameSubmit` — 无 `#` 时先前缀搜索再提交 |
| 首页拆分 | `FireteamFeedSection`、`CompactCareerPanel`、`HomeCareerSection` |
| Career 页 | `CareerInfoPanels`、`CareerEndgamePanels`、`CareerCraftingPanels` 等子组件 |
| Gear 页 | `GearDetailViews`、`gear-labels`；来源提示可展示 `source-aliases` 中的具体掉落关卡 |
| 终局加载 | `endgame-tasks.ts` — 生涯多 mode 并行、fireteam 成员顺序拉取 |
| 长列表 | `useWindowedSlice` — 首页组队 / 攻略默认 48 条 +「显示更多」 |
| 主题 | `useTheme` + Header `ThemeToggle`：跟随系统 / 浅色 / 深色（`localStorage: d2-theme`） |
| 体验 | 暗色对比度、`copyToClipboard`、图片 `lazy`、隐藏 tab 时暂停组队刷新 |

### 后端（`src/lib`）

| 领域 | 说明 |
|------|------|
| destiny | `summary-stats` / `summary-search`；`endgame-history` / `endgame-format` |
| details | `details-records.js`（成就统计）、`details-crafting.js`（锻造与定义拉取） |
| gear | v2 分片索引；`handlers.js` 聚合搜索 / 来源 / 详情 / perk 反查；`factories-*` 生成列表项与详情记录 |
| 集成 | `integrations/heybox-feed.js` — 小黑盒解析 |
| 缓存 | KV / R2 / Worker 内存多层；大型快照和装备 v2 索引走 R2 |

### 测试（Vitest）

```powershell
npm run test        # 一次性
npm run test:watch  # 监听
```

| 文件 | 覆盖 |
|------|------|
| `tests/frontend.test.js` | 玩家提交、endgame 格式化、生涯合并、锻造分组、format 工具 |
| `tests/lib.test.js` | 文本工具、heybox 解析、bungie/env 工具、统计格式化 |
| `tests/url.test.js` | `readUrlSearchParam`、`readUrlParams`、`syncUrlParams` |
| `tests/app.test.js` | API 集成、装备 v2 搜索 / 来源 / 详情 / perk 反查 |
| `tests/gear-*.test.js` | 装备索引拆分、缓存指针、本地 server deps |

当前约 **46** 项用例。PR 前建议：`npm run test`、`npm run build`、`npm run lint`。

---

## npm 脚本一览

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并发启动 API(5174) + Vite(5173) |
| `npm run frontend:dev` | 仅 Vite |
| `npm run api:dev` | 仅本地 API |
| `npm run build` | `tsc --noEmit` + Vite 生产构建 → `dist/` |
| `npm start` | 构建后 `server/index.js` 静态 + API |
| `npm run test` / `test:watch` | Vitest |
| `npm run lint` | ESLint |
| `npm run activity:index` | 构建活动静态索引 → `public/data/` |
| `npm run gear:index` | 构建装备 v2 索引 → `public/data/gear/` |
| `npm run gear:publish-r2` | 将装备 v2 分片索引通过 Wrangler R2 bulk put 发布到 R2 |
| `npm run guides:validate` | 校验 `content/guides/` 下 JSON 与媒体引用 |
| `npm run guides:upload` | 校验后通过 `wrangler r2 object put` 上传到 bucket |
| `npm run codegen:destiny` | 从单体快照重新切片 destiny 模块（可选） |
| `npm run worker:dev` | Wrangler 本地 Worker（需先 `npm run build`） |
| `npm run worker:deploy` | build 后移除 `dist/data/gear`，再部署 Worker + `dist` 静态资源 |

---

## 攻略内容管线

内容源目录：`content/guides/`（每篇攻略一个子目录，含 `guide.json` 与可选 `media/`）。

示例：`content/guides/example-raid-mechanics/`（Raid 机制示例，可用于验证列表与详情 UI）。

```powershell
# 1. 校验结构与索引
npm run guides:validate

# 2. 上传到 R2（需已登录 wrangler、bucket 与 wrangler.toml 一致）
npm run guides:upload

# 本地 wrangler R2 模拟（不上传到 Cloudflare 远程）
$env:R2_UPLOAD_LOCAL="1"; npm run guides:upload
```

上传后的对象路径（前缀由 `R2_GUIDE_PREFIX` 控制，默认 `guides`）：

- `{prefix}/index.json` — 列表索引
- `{prefix}/{slug}/guide.json` — 详情
- `{prefix}/{slug}/media/*` — 媒体文件

**索引为空时**攻略页会显示「攻略库暂无内容」——未执行 `guides:upload` 或未配置 Worker R2 binding 时属预期。线上需在 `wrangler.toml` 绑定 `CAREER_R2` bucket，并设置 `R2_GUIDE_PREFIX`。

---

## 界面与主题

- 默认跟随系统 `prefers-color-scheme`；顶栏 **主题** 按钮可切换：跟随系统 → 浅色 → 深色。
- 偏好保存在浏览器 `localStorage`（键 `d2-theme`）；强制深色通过 `html[data-theme="dark"]` 覆盖 CSS 变量。
- 组队列表在条数较多时默认只渲染 48 条，点击「显示更多」扩展（攻略列表同理）。

---

## `src/lib` 目录结构

```text
src/lib/
  bungie/          Bungie API 客户端、玩家名解析、统计格式化
  cache/           Worker 内存 / KV / R2 多层缓存
  http/            JSON 响应、CORS、请求体读取
  utils/           文本、时间、环境变量、并发
  shared/          跨域常量（如 CACHE_VERSION）
  storage/         R2 读写
  integrations/    heybox-feed.js、heybox.js（小黑盒组队）
  destiny/
    summary.js、summary-stats.js、summary-search.js
    endgame.js、endgame-history.js、endgame-format.js
    details.js、details-records.js、details-crafting.js
    fireteam.js、career.js、activities.js …
  gear/
    factories.js（re-export）、factories-items.js、factories-records.js
    build-index.js、search.js、public.js …
  guides/          攻略索引、详情、媒体代理
```

入口约定：

- Worker：`src/worker.js` → `src/app/index.js`，路由 `src/app/router.js`
- 后端 import：`#lib/*` → `src/lib/*`（`package.json` `imports`）
- 前端 / 测试：`@frontend/*`、`@lib/*`（Vite / Vitest / tsconfig）

---

## `src/frontend` 目录结构

```text
src/frontend/
  styles/          global.css、ui.module.css、各页 *.module.css
  ui/              barrel：lib + components 重导出
  lib/             api、types、url、format、clipboard、career-merge、endgame-tasks
  components/
    layout/        AppShell、Header、ThemeToggle、Notice、PageState …
    search/        PlayerSearchBox
    icons/、motion/
  hooks/
    useCareerSearchFlow、useCareerQuery、useHeyboxFeed
    useBungieFireteamLookup、useGearSearch、useGuidesLibrary
    useUrlQueryParam、useUrlPopstate、useWindowedSlice、useTheme
    usePlayerSearch
  pages/
    index/         HomePage、FireteamFeedSection、CompactCareerPanel、HomeCareerSection
    career/        CareerPage + Info / Endgame / Crafting 子组件
    gear/          GearPage、GearDetailViews
    fireteam/      FireteamPage
    guides/        GuidesPage
```

约定：`pages/<name>/index.tsx` 挂载 `*Page.tsx`；页面样式用 `createPageCn(本地 module.css)` 合并 `ui` + `motion`。

---

## 仓库根目录结构

```text
pages/                 Vite 多页面 HTML 入口（构建 → dist/pages/*.html）
server/index.js        本地静态 + /api（npm start / api:dev）
scripts/
  data/                activity、gear 静态索引构建
  guides/              validate.js、upload.js、content.js
  gear/                publish-r2.js
  codegen/             split-destiny.mjs
src/                   Worker、前端、共享 lib
content/guides/        攻略 JSON 与媒体源
public/                静态资源与 data/*.json
dist/                  构建产物（Worker ASSETS）
wrangler.toml          Cloudflare Worker 配置
```

---

## 开发与部署

### 日常开发

```powershell
npm run dev              # 推荐
npm run frontend:dev     # 仅前端（需另开 api:dev）
npm run api:dev          # 仅 API，端口 5174
```

### 构建与检查

```powershell
npm run build
npm run test
npm run lint
```

### 更新静态数据

```powershell
npm run activity:index
npm run gear:index
npm run gear:publish-r2   # 可选：同步装备索引到 R2
```

### Cloudflare Worker

```powershell
Copy-Item .dev.vars.example .dev.vars   # 本地 Worker 变量（若有）
npm run build
npm run worker:dev                      # 本地 Worker + dist 静态

npx wrangler secret put BUNGIE_API_KEY   # 部署前设置密钥
npm run worker:deploy
```

可选缓存层：

- **KV**（`CAREER_CACHE`）：热点玩家 JSON、活动定义等
- **R2**（`CAREER_R2`）：大型生涯快照、攻略、装备缓存
- **Worker Cache**：边缘短期缓存

Worker 定时任务：`wrangler.toml` 中 `crons`（每周二 06:17 UTC，用于后台维护任务）。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|-----------|------|
| 生涯查询报错 / 提示未配置 Key | 缺少 `BUNGIE_API_KEY` | 填写 `.env` 或 Worker Secret |
| 攻略页一直空 | R2 无索引 | `guides:validate` + `guides:upload`；检查 `R2_GUIDE_PREFIX` |
| 装备搜索无结果 | 未构建索引 | `npm run gear:index` |
| 开发时 API 404 | 未启动 API 或未代理 | 使用 `npm run dev`，不要只开 `frontend:dev` |
| 组队为演示数据 | Heybox 源不可达 | 检查 `HEYBOX_SOURCE_URL` 与网络；见接口返回 `source` 字段 |
| `guides:upload` 失败 | wrangler 未登录或 bucket 不存在 | `npx wrangler login`；确认 `R2_BUCKET` 与 `wrangler.toml` |

---

## 后续可优化方向（非阻塞）

| 优先级 | 项 | 说明 |
|--------|-----|------|
| P1 | 攻略内容 | 补充真实 Raid/地牢攻略并 `guides:upload` |
| P2 | Hook 集成测试 | `useGuidesLibrary` / `useGearSearch` 的 React 测试防 popstate 回归 |
| P3 | 真虚拟滚动 | 条数极大时可换 windowing 库替代「显示更多」 |

---

## 项目起源和出发点

项目起因为个人使用的、可不登录小黑盒官方平台的组队工具离线了一段时间，又恰好赶上 AI 浪潮，于是尝试使用 CodeX 进行项目开发。

本人并非专业程序员，只是一名《命运 2》的忠实玩家。项目开发过程中，幸得游戏公会中的全栈工程师玩家，也就是本仓库共同所有人 Atcher 进行把关审核：

- [Atcher / zc16399](https://github.com/zc16399)

项目最初的目的很简单：做一个不登录也可以获取游戏组队信息，并快速复制 `/j 玩家名#代码` 加入游戏队伍的组队工具。

后续随着实际使用需求逐步拓展，项目增加了玩家生涯、Raid / 地牢 / PvP、装备与 Perk 查询、锻造进度、攻略库等能力。

更多内容和功能欢迎通过 Issue 讨论：[提交 Issue](https://github.com/hub380/Destiny2-Checkinfo/issues)

---

## 鸣谢、参考和引用

特别鸣谢：

- [Cloudflare](https://www.cloudflare.com/)：Workers、KV、R2 等线上部署和缓存能力。
- [小黑盒语音](https://chat.xiaoheihe.cn/)：组队信息来源。
- [Taskeren/D2TeamUp](https://github.com/Taskeren/D2TeamUp)：组队信息接口来源参考。
- [Bungie.Net API](https://bungie-net.github.io/)：命运 2 公开数据能力。
- [Bungie-net/api](https://github.com/Bungie-net/api)：官方 API schema 与文档。
- [joshhunt/destinyDataExplorer](https://github.com/joshhunt/destinyDataExplorer)：Manifest 数据结构参考。
- [Destiny Item Manager](https://github.com/DestinyItemManager/DIM)：社区工具标杆。
- [D2Foundry](https://d2foundry.gg/)：武器、Perk 展示参考。
- [Vite](https://vite.dev/)、[React](https://react.dev/)、[TypeScript](https://www.typescriptlang.org/)：前端构建基础。

说明：

- 小黑盒组队工具没有稳定公开接口文档，本项目不会提交私人 Cookie、私有凭据或绕过鉴权逻辑。
- 公开玩家查询不需要 OAuth 登录；涉及个人账号敏感数据的能力，后续若加入会另行设计登录和权限边界。
- 武器来源提示来自棒鸡 Manifest 的可读来源字段，只能作为参考，不保证等同于精确活动掉落表。

---

## 开源协议

本项目代码采用 [MIT License](./LICENSE) 开源。

《命运 2》、Destiny 2、Bungie、小黑盒及相关名称、图标、图片、游戏数据、接口数据归各自权利方所有。本项目仅作为玩家社区工具进行数据整理与展示。
