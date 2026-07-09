// cloud-functions/_store.js
// 演示用「内存数据库」。真实部署请替换为 PostgreSQL / Redis 等：
//   import pg from 'pg';
//   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// 注意：Serverless 实例间内存不共享，冷启动会重置。生产请用外部存储。

const users = [
  { id: 'u1001', name: '张三', email: 'zhangsan@example.com', plan: 'pro', role: 'user' },
  { id: 'u1002', name: '李四', email: 'lisi@example.com', plan: 'free', role: 'user' },
];

// 演示密码（真实环境应存哈希，切勿明文）
const passwords = { u1001: 'pass123', u1002: 'pass456' };

function genId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// 简单 token 编解码（演示用，真实环境用 JWT + 密钥校验）
function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }
function ub64(s) { return Buffer.from(s, 'base64').toString('utf8'); }

export { users, passwords, genId, b64, ub64 };
