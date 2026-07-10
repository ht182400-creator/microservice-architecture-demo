// server.js —— 自托管 Node 后端服务器（替代 EdgeOne Cloud Functions）
// 运行：npm install && npm start   然后访问 http://localhost:3000
// 该服务器与 EdgeOne 版 cloud-functions/ 行为一致：
//   POST /api/auth        -> { token, user }
//   GET  /api/user/:id    -> { id, name, email, plan, role, fetchedAt } （需 Bearer Token）
//   POST /api/order       -> { orderId, total, status }
//   POST /api/payment     -> { paymentId, status, paidAt }
//   POST /api/notify      -> { notificationId, delivered }
// 并静态托管前端 index.html 与 microservice-architecture.html
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ 演示用「内存数据库」（对应 cloud-functions/_store.js） ============
// 真实部署请替换为 PostgreSQL / Redis 等外部存储（Serverless 实例内存不共享，
// 普通常驻服务器则可选内存、文件或数据库）。
const users = [
  { id: 'u1001', name: '张三', email: 'zhangsan@example.com', plan: 'pro', role: 'user' },
  { id: 'u1002', name: '李四', email: 'lisi@example.com', plan: 'free', role: 'user' },
];
// 演示密码（真实环境应存哈希，切勿明文）
const passwords = { u1001: 'pass123', u1002: 'pass456' };

function genId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8).toUpperCase();
}
function b64(s) {
  return Buffer.from(s, 'utf8').toString('base64');
}

// ============ Express 应用 ============
const app = express();
app.use(express.json());

// CORS：前端若从别的源（域名/端口）访问时放开；同源访问无需也可。
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function json(res, body, status) {
  res.status(status || 200).json(body);
}

// ============ 静态前端 ============
// 托管 index.html（动态版）与 microservice-architecture.html（静态全景图）
app.use(express.static(__dirname, { extensions: ['html'] }));

// ============ API 路由（与原 Cloud Functions 一一对应） ============

// 1) 鉴权服务：POST /api/auth
app.post('/api/auth', (req, res) => {
  const body = req.body || {};
  const username = body.username || '';
  const password = body.password || '';
  const user =
    users.find((u) => u.id === username) ||
    users.find((u) => u.email === username);

  if (!user || passwords[user.id] !== password) {
    return json(res, { error: '用户名或密码错误' }, 401);
  }
  const token = b64(user.id + ':' + Date.now());
  return json(res, {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      role: user.role,
    },
  });
});

// 2) 用户服务：GET /api/user/:id （需 Bearer Token）
app.get('/api/user/:id', (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (auth.indexOf('Bearer ') !== 0) {
    return json(res, { error: '未授权：缺少 Bearer Token' }, 401);
  }
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    return json(res, { error: '用户不存在: ' + req.params.id }, 404);
  }
  // 真实环境此处会查 PostgreSQL: SELECT * FROM users WHERE id = $1
  return json(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    role: user.role,
    fetchedAt: new Date().toISOString(),
  });
});

// 3) 订单服务：POST /api/order
app.post('/api/order', (req, res) => {
  const body = req.body || {};
  const userId = body.userId;
  const items = body.items || [];
  if (!userId) {
    return json(res, { error: '缺少 userId' }, 400);
  }
  const total = items.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
    0
  );
  // 真实环境此处会写 PostgreSQL 并发布 Kafka 事件
  const order = {
    orderId: genId('ORD-'),
    userId,
    items,
    total: Math.round(total * 100) / 100,
    status: 'CREATED',
    createdAt: new Date().toISOString(),
  };
  return json(res, order, 201);
});

// 4) 支付服务：POST /api/payment
app.post('/api/payment', (req, res) => {
  const body = req.body || {};
  const orderId = body.orderId;
  const method = body.method || 'wechat';
  if (!orderId) {
    return json(res, { error: '缺少 orderId' }, 400);
  }
  // 真实环境此处会调用微信/支付宝 SDK 并记账
  const pay = {
    paymentId: genId('PAY-'),
    orderId,
    method,
    status: 'PAID',
    paidAt: new Date().toISOString(),
  };
  return json(res, pay, 201);
});

// 5) 通知服务：POST /api/notify （示意接入 Kafka/短信/邮件）
app.post('/api/notify', (req, res) => {
  const body = req.body || {};
  const userId = body.userId;
  const message = body.message || '';
  if (!userId || !message) {
    return json(res, { error: '缺少 userId 或 message' }, 400);
  }
  // 真实环境此处会向 Kafka 投递通知事件，由消费者发短信/邮件/推送
  const note = {
    notificationId: genId('NTF-'),
    userId,
    message,
    delivered: true,
    sentAt: new Date().toISOString(),
  };
  return json(res, note, 201);
});

// ============ 启动 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('微服务架构图 Demo 后端已启动: http://localhost:' + PORT);
  console.log('前端首页:           http://localhost:' + PORT + '/');
  console.log('静态全景图:         http://localhost:' + PORT + '/microservice-architecture.html');
  console.log('API 健康检查:       curl http://localhost:' + PORT + '/api/auth -X POST ...');
});
