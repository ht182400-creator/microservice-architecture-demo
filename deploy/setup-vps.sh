#!/usr/bin/env bash
#
# microservice-arch 一键部署到 Ubuntu / Debian 云主机（「自托管」方式 B）
#
# 前置条件：
#   1. 一台有公网 IP 的 Ubuntu/Debian 云主机（root 或 sudo 权限）
#   2. 一个域名，其 A 记录已指向该主机公网 IP
#
# 用法：
#   sudo bash setup-vps.sh your.domain.com            # 用 systemd 托管（默认）
#   sudo bash setup-vps.sh your.domain.com --pm2     # 改用 PM2 托管
#
# 脚本会依次：装依赖 → 确保 Node>=18 → 拉代码 → npm install → 写 Nginx 反代
#            → 注册进程守护（systemd 或 PM2）→ 申请 Let's Encrypt 证书开 HTTPS。
# 幂等友好：重复执行会更新代码并重建守护，不会重复安装系统包。
#
set -euo pipefail

# ---------- 参数 ----------
DOMAIN="${1:?用法: sudo bash setup-vps.sh your.domain.com [--pm2]}"
USE_PM2=0
[[ "${2:-}" == "--pm2" ]] && USE_PM2=1

APP_DIR="/opt/micro-arch"
REPO="https://github.com/ht182400-creator/microservice-architecture-demo.git"
BRANCH="main"
SERVICE_USER="www-data"
PORT=3000

echo "==> [1/7] 更新系统并安装基础依赖 (git, nginx, certbot, curl)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git nginx certbot python3-certbot-nginx curl ca-certificates gnupg

echo "==> [2/7] 确保 Node.js >= 18"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> [3/7] 拉取代码到 $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

echo "==> [4/7] 安装依赖"
cd "$APP_DIR"
npm install --omit=dev

echo "==> [5/7] 写入 Nginx 反代配置"
cat > /etc/nginx/sites-available/micro-arch <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
}
EOF
ln -sf /etc/nginx/sites-available/micro-arch /etc/nginx/sites-enabled/micro-arch
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ "$USE_PM2" -eq 1 ]; then
  echo "==> [6/7] 用 PM2 托管"
  npm install -g pm2
  pm2 start "$APP_DIR/deploy/ecosystem.config.js"
  pm2 save
  pm2 startup || true
else
  echo "==> [6/7] 用 systemd 托管"
  cp "$APP_DIR/deploy/microservice-arch.service" /etc/systemd/system/
  mkdir -p /var/log/micro-arch
  systemctl daemon-reload
  systemctl enable --now microservice-arch
fi

echo "==> [7/7] 申请 Let's Encrypt 证书并开启 HTTPS"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
  echo "（证书申请未成功：请确认域名 A 记录已生效指向本机，稍后手动执行：sudo certbot --nginx -d $DOMAIN）"
}

echo
echo "✅ 部署完成！"
echo "   前端首页:    https://${DOMAIN}/"
echo "   静态全景图:  https://${DOMAIN}/microservice-architecture.html"
if [ "$USE_PM2" -eq 1 ]; then
  echo "   进程检查:    pm2 ls"
  echo "   查看日志:    pm2 logs micro-arch"
else
  echo "   进程检查:    systemctl status microservice-arch"
  echo "   查看日志:    journalctl -u microservice-arch -f"
fi
