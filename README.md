# 微服务架构图 · EdgeOne 全栈 Demo

前端静态页面 + EdgeOne **Cloud Functions** 真实可调用的后端 API，并附带一张与线上一致的纯静态全景架构图。可免费部署到 EdgeOne Pages / Makers。

## 目录结构

```
.
├── index.html                      # 动态版：登录 + 调用 5 个 API + 内嵌全景弹窗
├── microservice-architecture.html  # 纯静态全景架构图（独立页面，同站托管）
├── edgeone.json                   # EdgeOne 配置：/api/* 禁用缓存
├── package.json                   # type:module，Node >= 18
├── cloud-functions/               # EdgeOne Cloud Functions（无服务器后端）
│   ├── _store.js                 # 共享内存数据（用户/订单等）
│   └── api/
│       ├── auth.js               # POST /api/auth        鉴权签发 token
│       ├── user/[id].js          # GET  /api/user/:id    查询用户资料
│       ├── order.js              # POST /api/order       创建订单
│       ├── payment.js            # POST /api/payment     支付
│       └── notify.js            # POST /api/notify      通知
└── .gitignore
```

## 本地预览（Mock 模式）

直接双击打开 `index.html`（`file://` 协议）即进入 **Local preview - using Mock API data**：
无需任何后端即可体验完整交互（登录、下单、支付、通知，并实时画出调用路径图）。

调试强制 Mock：在任意 URL 后加 `?mock=1`。

## 部署到 EdgeOne（免费版，正式站点）

1. 在本地 `git init` 并提交本目录全部文件（见下方命令）。
2. 推送到你的 Git 仓库（GitHub / GitLab / 腾讯工蜂）。
3. 打开 [EdgeOne Makers 控制台](https://console.tencentcloud.com/edgeone/makers) → **新建项目** → 连接该 Git 仓库 → 框架选「无/Others」→ 部署。
4. 部署完成后会分配正式域名（如 `xxx.edgeone.app` 或 `xxx.edgeone.dev`），即为**正式站点**；
   原测试域名 `showtest.edgeone.dev` 可保留为预览或下线。
5. 域名判定逻辑见 `index.html` 顶部：`*.edgeone.dev` / `*.edgeone.app` / `https` 一律走真实 Cloud Functions，绝不回退 Mock。

> 免费版永久可用，包含 Cloud Functions + 全球 CDN + 自定义域名。

## 线上环境行为

- `index.html` 检测到线上域名 → 调用真实 `/api/*` Cloud Functions。
- 调用失败时如实报错（不会静默降级到 Mock）。
- 「查看全景架构图」按钮打开与 `microservice-architecture.html` 完全一致的全景视图。
