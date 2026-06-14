# Destiny 2 Fireteam Dashboard

一个本地 Web 项目，用于展示小黑盒命运 2 组队信息，并通过棒鸡 API 查询公开玩家生涯数据。

## 功能

- 展示小黑盒命运 2 组队数据源里的组队信息
- 每 30 秒自动刷新，可开关，也可手动刷新
- 识别 `名称#数字代码` 格式的游戏用户名
- 一键复制 `/j 名称#代码`
- 通过棒鸡官方 API 查询任意公开玩家档案、角色和常用生涯统计

## 启动

```powershell
Copy-Item .env.example .env
npm start
```

打开 `http://localhost:5173`。

## 配置

编辑 `.env`：

- `BUNGIE_API_KEY`：棒鸡应用的 API Key。申请地址：`https://www.bungie.net/en/Application`。查询公开玩家不需要 OAuth 登录。
- `HEYBOX_SOURCE_URL`：小黑盒组队数据源 URL，默认使用命运 2 组队接口 `https://api.xiaoheihe.cn/game/common_team_v2/home?appid=1085660`。
- `HEYBOX_SOURCE_HEADERS`：请求小黑盒数据源时使用的头部 JSON。若数据源需要登录态，请只填你有权使用的 Cookie。

如果没有配置 `HEYBOX_SOURCE_URL`，前端会显示演示数据，方便先验证交互。

## 部署到 Cloudflare Workers

本项目已包含 `wrangler.toml` 和 `src/worker.js`，可以作为 Worker + Static Assets 部署。

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm run worker:dev
```

本地 `.dev.vars` 里填 `BUNGIE_API_KEY`。不要提交 `.dev.vars`。

部署前先把棒鸡 API Key 设置成 Cloudflare Worker Secret：

```powershell
npx wrangler secret put BUNGIE_API_KEY
npm run worker:deploy
```

可选缓存优化：

- 首选 KV：玩家基础资料和 Raid/地牢完整历史都是 JSON，适合放在 KV 中跨 Worker 实例复用。创建命令：`npx wrangler kv namespace create CAREER_CACHE`，然后把返回的 `id` 填到 `wrangler.toml` 的 `[[kv_namespaces]]`。
- 可选 R2：如果你想长期保留较大的历史快照，可以创建 `CAREER_R2` 绑定。当前代码会优先读边缘 Cache 和 KV，只有完整 Raid/地牢历史会额外写入 R2。
- 不配置 KV/R2 也能运行：Worker 会使用 `caches.default` 和单实例内存缓存，只是冷启动或不同边缘节点之间不能完全复用缓存。
- 可用 `SUMMARY_CACHE_TTL_SECONDS` 和 `ENDGAME_CACHE_TTL_SECONDS` 调整缓存时间。默认基础资料 300 秒，完整 Raid/地牢历史 900 秒。活动定义名称/图片默认缓存 604800 秒，并发默认 4。

当前公开玩家查询不需要 OAuth，不需要 `client_id`、`client_secret` 或 `state`。

## 说明

小黑盒组队工具没有稳定公开接口文档，本项目没有硬编码私有凭据或绕过鉴权逻辑。后端会尽量归一化常见 JSON 字段，并从文本里提取 `名称#代码` 用户名。
