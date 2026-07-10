# 微服务架构图 Demo —— 自托管后端镜像
FROM node:18-alpine

WORKDIR /app

# 先拷依赖清单，利用层缓存
COPY package.json ./
RUN npm install --omit=dev

# 再拷源码
COPY . .

# server.js 监听 3000；可用环境变量 PORT 覆盖
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
