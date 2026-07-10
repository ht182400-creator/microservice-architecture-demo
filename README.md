# 微服务架构图 · 全栈 Demo

前端静态页面 + **真实可调用的后端 API**，并附带一张与线上一致的纯静态全景架构图。

后端有两种等价运行方式，任选其一：

- **方式 A（推荐，免运维）**：部署到 EdgeOne Pages / Makers 的 **Cloud Functions**（无服务器，免费）。
- **方式 B（自有服务器）**：用本项目附带的 **Node / Express 服务器**（`server.js`）自己托管。

两种方式的 API 行为完全一致（鉴权、下单、支付、通知逻辑相同）。

## 目录结构

```
.
├── index.html                      # 动态版：登录 + 调用 5 个 API + 内嵌全景弹窗
├── microservice-architecture.html  # 纯静态全景架构图（独立页面，同站托管）
├── server.js                      # 方式 B：自托管 Node/Express 后端（替代 Cloud Functions）
├── package.json                   # type:module，含 express 依赖与 start 脚本
├── edgeone.json                   # EdgeOne 配置：/api/* 禁用缓存（仅方式 A 用到）
├── cloud-functions/               # 方式 A：EdgeOne Cloud Functions（仅 EdgeOne 部署用）
│   ├── _store.js                 # 共享内存数据（用户/订单等）
│   └── api/
│       ├── auth.js               # POST /api/auth        鉴权签发 token
│       ├── user/[id].js          # GET  /api/user/:id    查询用户资料
│       ├── order.js              # POST /api/order       创建订单
│       ├── payment.js            # POST /api/payment     支付
│       └── notify.js            # POST /api/notify      通知
├── Dockerfile                     # 方式 B 生产镜像（可选）
└── .gitignore
```

> 说明：`cloud-functions/` 只在方式 A（EdgeOne）生效；方式 B 由 `server.js` 直接实现同样的 5 个接口。两个目录可共存，互不影响。

## 本地预览（Mock 模式，无需任何后端）

直接双击打开 `index.html`（`file://` 协议）即进入 **Local preview - using Mock API data**：
无需后端即可体验完整交互（登录、下单、支付、通知，并实时画出调用路径图）。

调试强制 Mock：在任意 URL 后加 `?mock=1`。

---

## 方式 B：自托管 Node / Express 后端（不用 EdgeOne）

### 1. 安装与启动

```bash
npm install          # 安装 express
npm start            # 等价于 node server.js
# 自定义端口： PORT=8080 npm start
```

启动后访问：

- 前端首页：      http://localhost:3000/
- 静态全景图：    http://localhost:3000/microservice-architecture.html
- API 健康检查：  `curl -X POST http://localhost:3000/api/auth -H "Content-Type: application/json" -d '{"username":"u1001","password":"pass123"}'`

### 2. 前端如何知道走真实后端？

`index.html` 顶部判定：**只有 `file://` 直接打开、或 URL 带 `?mock=1` 时才用 Mock**；
凡是"被某个服务器托管"的页面（包括你自己的 `localhost:3000`、局域网 IP、任意域名），一律走真实后端 API。
所以方式 B 开箱即用，无需改任何代码。

### 3. 生产部署（任选）

**① PM2（最省事，单台服务器）**

```bash
npm install -g pm2
pm2 start server.js --name micro-arch
pm2 save && pm2 startup     # 开机自启
```

**② Docker（容器化）**

`Dockerfile` 已提供：

```bash
docker build -t micro-arch .
docker run -d --name micro-arch -p 3000:3000 micro-arch
```

**③ Nginx 反代（已有 Nginx 时）**

```nginx
server {
    listen 80;
    server_name your.domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

之后把 `your.domain.com` 解析到这台服务器即可。后端端口、CORS（已对 `*` 放开）均无需改动。

---

## 方式 A：部署到 EdgeOne（免费版，无服务器）

1. 在本地 `git init` 并提交本目录全部文件（见下方命令）。
2. 推送到你的 Git 仓库（GitHub / GitLab / 腾讯工蜂）。
3. 打开 [EdgeOne Makers 控制台](https://console.tencentcloud.com/edgeone/makers) → **新建项目** → 连接该 Git 仓库 → 框架选「无/Others」→ 部署。
4. 部署完成后分配正式域名（如 `xxx.edgeone.app`），即为**正式站点**。
5. 域名判定逻辑见 `index.html` 顶部：只要页面由服务器托管（含 EdgeOne），就走真实 Cloud Functions。

> 免费版永久可用，含 Cloud Functions + 全球 CDN + 自定义域名。
> 注意：默认预览域 `*.edgeone.cool` 仅 3 小时时效；绑定**自定义域名**且加速区域选「全球可用区（不含中国大陆）」可免备案长期访问。

## 线上环境行为（两种后端一致）

- 页面由服务器托管 → 调用真实 `/api/*` 后端。
- 调用失败时如实报错（不会静默降级到 Mock）。
- 「查看全景架构图」按钮打开与 `microservice-architecture.html` 完全一致的全景视图。

## 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `u1001`（或 `zhangsan@example.com`） | `pass123` | pro |
| `u1002`（或 `lisi@example.com`） | `pass456` | free |

## 提交到 Git 的常用命令

```bash
git add -A
git -c user.email=you@example.com -c user.name=you commit -m "update"
git push
```
