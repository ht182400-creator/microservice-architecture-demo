# 微服务架构图 Demo · 云主机代建部署文档

> **目标服务器**：宝塔 Windows 面板（BT.CN）云主机  
> **公网 IP**：`82.156.71.231`  
> **配置**：CPU 2 核 / 内存 2 GB / 系统盘 40 GB  
> **部署日期**：2026-07-10  
> **项目仓库**：`https://github.com/ht182400-creator/microservice-architecture-demo.git`（分支 `main`）

---

## 一、部署架构总览

```
                    ┌─────────────────────────────┐
                    │   用户浏览器                  │
                    │  https://你的域名/            │
                    └──────┬──────────────────────┘
                           │ HTTPS (Let's Encrypt / 宝塔SSL)
                           ▼
              ┌──────────────────────────────────┐
              │  宝塔 Windows 面板                │
              │  82.156.71.231 :443 (Nginx)      │
              │         反向代理 → :3000          │
              └──────────────┬───────────────────┘
                             │
              ┌──────────────▼───────────────────┐
              │  Node.js / Express (server.js)    │
              │  PM2 托管，端口 3000              │
              │                                  │
              │  /api/auth     POST  登录鉴权     │
              │  /api/user/:id GET   查用户(需Token)│
              │  /api/order    POST  创建订单     │
              │  /api/payment  POST  支付        │
              │  /api/notify   POST  发通知       │
              │  /            GET   前端首页       │
              │  /micro...html GET   全景架构图    │
              └──────────────────────────────────┘
```

**核心原则**：同一份前端 `index.html`，被服务器托管后自动走真实后端 API（`USE_MOCK=false`），无需改任何代码。

---

## 二、前置条件（在服务器上确认）

### 2.1 系统环境检查

通过**宝塔面板终端**或 **远程桌面 (RDP)** 连入服务器后，逐项确认：

| # | 检查项 | 命令 / 操作 | 预期结果 |
|---|--------|-------------|----------|
| 1 | 操作系统版本 | `ver` 或查看「此电脑→属性」 | Windows Server 2019/2022 |
| 2 | 宝塔面板版本 | 浏览器打开宝塔面板 URL | ≥ 8.x |
| 3 | Node.js 是否已装 | `node -v` | ≥ 18.x |
| 4 | npm 版本 | `npm -v` | ≥ 9.x |
| 5 | Git 是否已装 | `git --version` | 2.x+ |
| 6 | 端口 3000 是否空闲 | `netstat -an \| findstr ":3000"` | 无输出（未被占用） |
| 7 | 端口 80/443 是否开放 | 宝塔面板 → 安全 → 防火墙 | 已放行 |

### 2.2 若缺少依赖，安装方法

```powershell
# Node.js（若未安装）
# 方式 A：从 https://nodejs.org 下载 LTS (.msi) 安装包，双击安装
# 方式 B：用 winget
winget install OpenJS.NodeJS.LTS

# Git（Windows 版本）
winget install Git.Git

# 安装完后**重启终端**（或重新 RDP），再验证：
node -v   # 应输出 v20.x 或 v22.x
npm -v
git --version
```

---

## 三、代码部署（6 步）

以下命令均在**服务器 PowerShell（管理员）** 中执行：

```powershell
# ============================================================
# 第 1 步：创建项目目录
# ============================================================
New-Item -ItemType Directory -Path "D:\www\micro-arch" -Force
Set-Location "D:\www\micro-arch"

# ============================================================
# 第 2 步：克隆代码
# ============================================================
git clone https://github.com/ht182400-creator/microservice-architecture-demo.git .
git checkout main

# ============================================================
# 第 3 步：安装依赖
# ============================================================
npm install --omit=dev

# ============================================================
# 第 4 步：验证服务能启动（先手动跑一次看日志）
# ============================================================
$env:PORT="3000"
node server.js
# 看到 "微服务架构图 Demo 后端已启动: http://localhost:3000" 后 Ctrl+C 停止
```

```powershell
# ============================================================
# 第 5 步：全局安装 PM2 并启动守护进程
# ============================================================
npm install -g pm2-windows-upgrade  # Windows 兼容层（首次需要）
pm2 start server.js --name micro-arch
pm2 save                            # 保存当前进程列表

# 确认运行状态：
pm2 list                           # 应显示 micro-arch │ online
pm2 logs micro-arch --lines 20     # 查看最近日志

# ============================================================
# 第 6 步：设置 PM2 开机自启（Windows 计划任务方式）
# ============================================================
# PM2 在 Windows 上没有原生 startup 子命令，改用计划任务：
# 创建启动脚本 D:\www\micro-arch\start-pm2.bat：
@"
@echo off
cd /d D:\www\micro-arch
pm2 resurrect
"@ | Out-File -Encoding ASCII "D:\www\micro-arch\start-pm2.bat"

# 注册为开机自启计划任务：
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c D:\www\micro-arch\start-pm2.bat"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "PM2-MicroArch" -Action $action -Trigger $trigger -Settings $settings -Description "PM2 auto-start for micro-arch demo" -RunLevel Highest
```

**第 5~6 步完成后**，访问 `http://82.156.71.231:3000/` 应该能看到前端页面（绿色 "Live - connected to backend server"）。

---

## 四、域名解析（DNS 配置）

将一个子域名指向这台服务器的公网 IP：

| 记录类型 | 主机记录 | 记录值 | 说明 |
|----------|----------|--------|------|
| A | `micro`（或你想用的前缀） | `82.156.71.231` | 例如得到 `micro.fable5.icu` |

操作位置：你购买 `fable5.icu` 的域名服务商管理后台 → DNS 解析管理 → 添加 A 记录。

> 示例：添加 A 记录 `micro` → `82.156.71.231`，生效后 `http://micro.fable5.icu` 即指向这台机器。

---

## 五、宝塔面板配置（反向代理 + SSL）

### 5.1 添加网站

1. 打开宝塔面板 → **网站** → **添加站点**
2. 域名填：`micro.fable5.icu`（替换为实际使用的域名）
3. 根目录设为：`D:\www\micro-arch`
4. PHP 版本选 **纯静态**
5. 点击提交

### 5.2 配置反向代理

1. 进入刚创建的站点 → **设置** → **反向代理**
2. 添加反向代理：
   - 代理名称：`micro-arch-backend`
   - 目标URL：`http://127.0.0.1:3000`
   - 发送域名：`$host`
3. 保存

此时访问 `http://micro.fable5.icu/` 即可通过 Nginx 反向代理到 Node.js 后端。

### 5.3 开启 HTTPS（免费 SSL 证书）

1. 进入站点 → **SSL** → **Let's Encrypt**
2. 选择 **文件验证**方式
3. 勾选域名 → 申请证书
4. 申请成功后开启 **强制 HTTPS**

宝塔会自动处理证书续期（默认 60 天自动续签）。

> 若 DNS 尚未生效导致验证失败，等几分钟（通常 < 5 分钟）后重试。

---

## 六、线上验证清单

部署完成后，逐项执行以下验证：

### 6.1 前端可访问

```
浏览器打开 https://micro.fable5.icu/
✅ 页面正常加载
✅ 顶部显示绿色 "✓ Live - connected to backend server"
✅ 不是橙色 "Local preview"
```

### 6.2 API 联调（5 个接口）

在服务器上用 curl 或浏览器 F12 控制台 Network 面板验证：

```powershell
# ① 登录
curl -X POST https://micro.fable5.icu/api/auth -H "Content-Type: application/json" -d "{\"username\":\"u1001\",\"password\":\"pass123\""
# ✅ 期望：200, 返回 token + user(张三/pro)

# ② 查用户（需带 Token，把上一步返回的 token 替换进去）
curl https://micro.fable5.icu/api/user/u1001 -H "Authorization: Bearer <上一步的token>"
# ✅ 期望：200, 返回用户资料含 fetchedAt

# ③ 无 Token 访问应被拒
curl https://micro.fable5.icu/api/user/u1001
# ✅ 期望：401, {"error":"未授权：缺少 Bearer Token"}

# ④ 下单
curl -X POST https://micro.fable5.icu/api/order -H "Content-Type: application/json" -d "{\"userId\":\"u1001\",\"items\":[{\"name\":\"Demo\",\"price\":10,\"qty\":2},{\"name\":\"Pro\",\"price\":5,\"qty\":1}]}"
# ✅ 期望：201, orderId=ORD-xxxxxx, total=25

# ⑤ 支付（orderId 用上一步返回的）
curl -X POST https://micro.fable5.icu/api/payment -H "Content-Type: application/json" -d "{\"orderId\":\"<上一步orderId>\",\"method\":\"wechat\"}"
# ✅ 期望：201, paymentId=PAY-xxxxxx, status=PAID

# ⑥ 通知
curl -X POST https://micro.fable5.icu/api/notify -H "Content-Type: application/json" -d "{\"userId\":\"u1001\",\"message\":\"订单支付完成\"}"
# ✅ 期望：201, notificationId=NTF-xxxxxx, delivered=true
```

### 6.3 全景架构图

```
浏览器打开 https://micro.fable5.icu/microservice-architecture.html
✅ 完整静态全景架构图正常展示
```

### 6.4 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `u1001`（或 `zhangsan@example.com`） | `pass123` | pro |
| `u1002`（或 `lisi@example.com`） | `pass456` | free |

---

## 七、日常运维命令

```powershell
# ===== 进程管理 =====
pm2 list                          # 查看所有托管进程及状态
pm2 logs micro-arch --lines 50    # 查看最近 50 行日志
pm2 restart micro-arch            # 重启（更新代码后）
pm2 stop micro-arch               # 停止
pm2 delete micro-arch             # 删除（彻底移除）

# ===== 更新代码 =====
Set-Location "D:\www\micro-arch"
git pull origin main              # 拉最新代码
npm install                       # 如有新依赖
pm2 restart micro-arch            # 重启生效

# ===== 回滚 =====
git log --oneline -10             # 查看最近提交
git revert HEAD                   # 回退上一个提交（或 git reset --hard <commit-hash>）
pm2 restart micro-arch

# ===== 宝塔面板常用 =====
# 网站 → 站点名 → 日志 → 查看 Nginx 访问/错误日志
# 安全 → 防火墙 → 管理 80/443 端口放行规则
# SSL → Let's Encrypt → 续期（一般自动，也可手动点）
```

---

## 八、故障排查速查

| 现象 | 可能原因 | 排查方法 |
|------|----------|----------|
| 访问超时 / 无法连接 | 防火墙未放行 80/443/3000 | 宝塔 → 安全 → 防火墙 → 检查放行规则；云厂商安全组也需放行 |
| 502 Bad Gateway | Node.js 进程未启动或崩溃 | `pm2 list` 查状态；`pm2 logs` 查错误日志 |
| 前端显示橙色 Local preview | 页面以 `file://` 打开或 URL 带 `?mock=1` | 确认通过域名/IP 访问而非直接双击 HTML 文件 |
| API 报 401 未授权 | 请求未携带 Bearer Token | 检查前端 `authHdr()` 是否正确附加 Authorization 头 |
| SSL 证书验证失败 | DNS 未生效或 CNAME 错误 | 用 `nslookup micro.fable5.icu` 确认解析到 82.156.71.231 |
| npm install 报错 | Node 版本过低 | `node -v` 确认 ≥ 18，否则升级 |
| pm2 启动失败 | 缺少 windows-upgrade | 先 `npm install -g pm2-windows-upgrade` 再试 |
| 端口冲突 3000 已占用 | 其他程序占用了 3000 | `netstat -ano \| findstr ":3000"` 找到 PID 结束它，或在 server.json 里改 PORT |

---

## 九、目录结构（服务器上最终形态）

```
D:\www\micro-arch\
├── .git/                          # Git 仓库（方便 pull 更新）
├── node_modules/                  # npm 依赖（express 等）
├── index.html                     # 动态前端（自动走真实后端）
├── microservice-architecture.html # 静态全景架构图
├── server.js                      # Express 后端（PM2 托管此文件）
├── package.json
├── package-lock.json
├── Dockerfile                     # 可选：容器化备用
├── edgeone.json                   # EdgeOne 配置（自托管模式不使用）
├── cloud-functions/               # EdgeOne CF（自托管模式不使用）
└── deploy/                        # 参考配置（Linux 用，Windows 主要参考思路）
    ├── setup-vps.sh               # Linux 一键脚本（本机不用）
    ├── ecosystem.config.js        # PM2 配置参考
    ├── microservice-arch.service  # systemd 参考（Windows 无 systemd）
    └── nginx-micro-arch.conf      # Nginx 反代参考（宝塔面板内配）
```

---

## 十、与 EdgeOne 部署的关系说明

本项目支持**两种独立部署路径**，互不干扰：

| 维度 | EdgeOne（方式 A） | 自托管这台机器（方式 B） |
|------|-------------------|------------------------|
| 当前地址 | `https://fable5.icu`（已在用） | `https://micro.fable5.icu`（本文档目标） |
| 后端 | Cloud Functions（Serverless） | Express（Node.js 常驻进程） |
| 数据 | 每次请求独立内存实例 | 单进程内存共享（本次会话内） |
| 运维 | 免运维，推送即部署 | 需自行维护进程/证书/系统 |
| 适用场景 | 正式对外、免运维 | 私有环境、自定义扩展 |

两套部署的**前端完全相同**，API 行为一致。可以同时在线运行，互不影响。
