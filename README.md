# Destiny2 Checkinfo

## 项目主体和功能

Destiny2 Checkinfo 是一个面向《命运 2》玩家的 Web 工具，目标是把组队信息、公开玩家生涯、装备 / Perk / 来源提示和后续攻略内容整合到一个轻量页面中。

当前主要功能：

- 展示小黑盒命运 2 组队工具的组队信息。
- 每 30 秒自动刷新组队列表，可手动开关，也可手动刷新。
- 自动识别 `名称#数字代码` 格式的游戏用户名。
- 一键复制 `/j 名称#代码`，方便直接在游戏内加入队伍。
- 查询任意公开棒鸡玩家生涯，不需要玩家本人登录。
- 展示玩家角色、基础统计、Raid、地牢、PvP 分模式数据。
- 展示锻造解锁进度。
- 搜索武器、护甲、Perk，并查看武器 Perk 池、普通 / 强化差异、护甲套装效果。
- 支持 Perk 反查可出武器。
- 基于棒鸡 Manifest 提供武器来源提示，作为参考信息，不视为精确掉落表。
- 预留攻略 / 资讯库页面，后续用于整理地图、Raid、地牢机制、图文和外部视频内容。

线上地址：

- [Cloudflare Workers 线上版本](https://destiny2-fireteam-dashboard.tw9jigtk.workers.dev)

本地启动：

```powershell
Copy-Item .env.example .env
npm install
npm run activity:index
npm run gear:index
npm run build
npm start
```

打开：

```text
http://localhost:5173
```

前端开发（热更新 + API 联调）：

```powershell
npm run dev
```

Vite 在 `5173` 提供页面，`5174` 提供 `/api/*`。生产预览仍使用 `npm run build` + `npm start`。

常用页面：

- `/`：组队信息与简版玩家生涯查询
- `/career.html`：玩家生涯详情
- `/gear.html`：装备、Perk、来源提示查询
- `/guides.html`：攻略 / 资讯库

## 当前分支迭代变更

当前开发分支：

- [feature/pvp-history-career-layout](https://github.com/hub380/Destiny2-Checkinfo/tree/feature/pvp-history-career-layout)

与主分支对比：

- [main...feature/pvp-history-career-layout](https://github.com/hub380/Destiny2-Checkinfo/compare/main...feature/pvp-history-career-layout)

当前分支主要迭代：

- 前端重构为 Vite + React + TypeScript 多页面构建，保留 `/`、`/career.html`、`/gear.html`、`/guides.html`。
- 样式拆成 CSS Modules，降低单文件样式维护压力。
- 后端统一聚合 `/api/*` 数据，前端只消费整理后的 DTO。
- 玩家生涯从组队页拆出独立页面，同时保留组队页内简版查询。
- Raid / 地牢按具体活动展示，并支持变体、Solo、无暇等标记。
- PvP 加入分模式数据展示。
- 加入锻造进度，并改为更适合大数据量展示的弹窗 / 分组结构。
- 装备搜索合并武器、护甲、Perk 查询入口。
- 加入 Perk 反查武器能力。
- 加入普通 / 强化 Perk 差异展示。
- 加入武器来源提示，过滤 hash、Manifest 版本号、发布分组等噪点。
- 活动名称和图片加入静态活动索引、KV 缓存和按需补漏逻辑，减少 `活动 数字代码` 的显示。
- 接入 Cloudflare KV、R2，R2 用于玩家大型历史快照和攻略内容。
- 新增攻略 / 资讯库骨架，支持 R2 中的攻略索引、详情、媒体和外部视频占位。

相关接口保持稳定：

- `/api/fireteams`
- `/api/destiny/summary`
- `/api/destiny/details`
- `/api/destiny/endgame`
- `/api/destiny/career`
- `/api/gear/search`
- `/api/gear/item`
- `/api/gear/perk-weapons`
- `/api/guides`
- `/api/guides/:slug`

## 项目起源和出发点

项目起因为个人使用的、可不登录小黑盒官方平台的组队工具离线了一段时间，又恰好赶上 AI 浪潮，于是尝试使用 CodeX 进行项目开发。

本人并非专业程序员，只是一名《命运 2》的忠实玩家。项目开发过程中，幸得游戏公会中的全栈工程师玩家，也就是本仓库共同所有人 Atcher 进行把关审核：

- [Atcher / zc16399](https://github.com/zc16399)

项目最初的目的很简单：做一个不登录也可以获取游戏组队信息，并快速复制 `/j 玩家名#代码` 加入游戏队伍的组队工具。

后续随着实际使用需求逐步拓展，项目增加了：

- 玩家游戏生涯查询
- Raid / 地牢 / PvP 数据展示
- 装备、Perk、来源提示查询
- 锻造进度查询
- 攻略 / 资讯库规划

更多内容和功能欢迎通过 Issue 讨论：

- [提交 Issue](https://github.com/hub380/Destiny2-Checkinfo/issues)

## 鸣谢、参考和引用

特别鸣谢：

- [Cloudflare](https://www.cloudflare.com/)：赛博大善人，提供 Workers、KV、R2 等线上部署和缓存能力。
- [小黑盒语音](https://chat.xiaoheihe.cn/)：组队信息来源。
- [Taskeren/D2TeamUp](https://github.com/Taskeren/D2TeamUp)：组队信息接口来源参考。
- [Bungie.Net API](https://bungie-net.github.io/)：提供命运 2 玩家、Manifest、活动、装备等公开数据能力。对于命运玩家而言，Bungie 带来了革新和热爱，也带来了唏嘘与不甘。
- [Bungie-net/api](https://github.com/Bungie-net/api)：官方 API schema 与文档来源。
- [joshhunt/destinyDataExplorer](https://github.com/joshhunt/destinyDataExplorer)：用于理解 Destiny Manifest 数据结构和数据探索方式的重要参考。
- [Destiny Item Manager](https://github.com/DestinyItemManager/DIM)：命运 2 社区工具标杆，装备数据表达和交互体验值得长期参考。
- [D2Foundry](https://d2foundry.gg/)：武器、Perk、数值展示体验的重要参考。
- [Vite](https://vite.dev/)、[React](https://react.dev/)、[TypeScript](https://www.typescriptlang.org/)：当前前端构建基础。

说明：

- 小黑盒组队工具没有稳定公开接口文档，本项目不会提交私人 Cookie、私有凭据或绕过鉴权逻辑。
- 公开玩家查询不需要 OAuth 登录；涉及个人账号敏感数据的能力，后续若加入会另行设计登录和权限边界。
- 武器来源提示来自棒鸡 Manifest 的可读来源字段，只能作为参考，不保证等同于精确活动掉落表。

## `src/lib` 目录结构

后端共享逻辑集中在 `src/lib/`，按领域与基础设施分层：

```text
src/lib/
  bungie/          Bungie API 客户端、玩家名解析、统计格式化（`index.js` barrel）
  cache/           Worker 内存 / KV / R2 多层缓存与 TTL 配置
  http/            HTTP 工具、JSON 响应与 CORS
  utils/           文本、时间、环境变量、并发控制
  shared/          跨域常量（如 CACHE_VERSION）
  storage/         R2 读写（生涯快照、攻略对象）
  integrations/    小黑盒组队、Heybox 数据解析
  destiny/         玩家生涯、组队、终局、详情等领域 API
  gear/            装备索引构建、搜索、Perk 反查、Worker 依赖注入
  guides/          攻略索引、详情与媒体代理
```

入口约定：

- Worker / 本地 API：`src/app/index.js`（路由在 `src/app/router.js`）
- 后端 import 别名：`#lib/*` → `src/lib/*`（`package.json` `imports`，用于 Worker / `server/index.js`）
- 前端 / 测试 import 别名：`@frontend/*` → `src/frontend/*`；`@lib/*` → `src/lib/*`（Vite / Vitest / tsconfig）
- 各领域模块通过各目录下的 `index.js` 对外导出（含 `bungie`、`utils`、`http`、`cache`、`integrations`、`storage`、`shared`）
- 装备 CLI：`npm run gear:index` 直接引用 `src/lib/gear/index.js` 的 `buildGearIndex`
- 从单体文件重新切片（可选）：将快照放到 `src/lib/destiny-handlers.source.js` 或 `src/lib/gear/.gear-core.source.js`，再运行 `npm run codegen:destiny` / `npm run codegen:gear`

## 仓库根目录结构

根目录只保留配置、入口约定与构建产物目录；页面 HTML 与本地服务、CLI 脚本按职责分目录：

```text
pages/                 Vite 多页面 HTML 入口（构建后映射到 dist/*.html）
server/index.js        本地静态资源 + /api 代理（生产预览用 npm start）
scripts/
  data/                静态数据索引构建（activity、gear）
  guides/              攻略内容校验与 R2 上传
  gear/                装备索引发布到 R2
  codegen/             从单体快照重新切片 destiny / gear 模块
src/                   Worker 应用、前端、共享 lib
content/guides/        攻略 JSON 与媒体源文件
public/                静态资源与构建出的 data/*.json
```

命名约定：

- `pages/<route>.html` ↔ `src/frontend/pages/<name>/`（页面名与 HTML 文件名一致）
- `scripts/<领域>/<动作>.js`（如 `guides/validate.js`、`gear/publish-r2.js`）
- npm script：`领域:动作`（如 `guides:validate`、`gear:index`、`codegen:destiny`）

## `src/frontend` 目录结构

前端按 **样式 / 组件 / 页面 / 数据层** 分层，命名与后端 `@lib` 别名对称：

```text
src/frontend/
  styles/          global.css、ui.module.css（布局基座）、motion.module.css（动效）
  ui/              barrel：重导出 lib + components（页面统一 `from '@frontend/ui'`）
  lib/             api、types、cn、format、constants、career-merge
  components/
    layout/        AppShell、Header、Notice、MetricCard、MiniStat
    search/        PlayerSearchBox
    icons/         SVG 图标
    motion/        FadeIn、StaggerList、LoadingPulse
  hooks/           各页面数据 hooks
  pages/
    home/          index.tsx（入口）、HomePage.tsx、home.module.css
    career/        CareerPage、career + crafting 样式
    gear/          GearPage、gear.module.css
    fireteam/      FireteamPage、fireteam.module.css
    guides/        GuidesPage、guides.module.css
```

约定：

- 页面入口：各 `pages/<name>/index.tsx` 挂载对应 `*Page.tsx`；`pages/<name>.html` 引用 `/src/frontend/pages/<name>/index.tsx`
- import 别名：`@frontend/*` → `src/frontend/*`（Vite + tsconfig）
- 页面样式：`createPageCn(本地 module.css)` 自动合并 `styles/ui` + `styles/motion`
- 布局：`AppShell` + `FadeIn` / `StaggerList` / `LoadingPulse` 统一动效

## 开发和部署补充

本地前端开发：

```powershell
npm run frontend:dev
```

构建：

```powershell
npm run build
```

更新活动静态索引：

```powershell
npm run activity:index
```

更新装备静态索引：

```powershell
npm run gear:index
```

攻略 / 资讯内容源放在 `content/guides/`。先校验再上传到 R2：

```powershell
npm run guides:validate
npm run guides:upload
```

Cloudflare Worker 本地调试：

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run build
npm run worker:dev
```

部署前先把棒鸡 API Key 设置为 Worker Secret：

```powershell
npx wrangler secret put BUNGIE_API_KEY
```

部署：

```powershell
npm run build
npm run worker:deploy
```

可选缓存：

- KV：用于热点玩家查询、活动定义、装备索引等 JSON 缓存。
- R2：用于玩家大型历史快照、攻略 JSON、封面、图片和媒体元数据。
- Worker Cache：用于边缘短期缓存。

## 开源协议

本项目代码采用 [MIT License](./LICENSE) 开源。

《命运 2》、Destiny 2、Bungie、小黑盒及相关名称、图标、图片、游戏数据、接口数据归各自权利方所有。本项目仅作为玩家社区工具进行数据整理与展示。
