// cloud-functions/api/user/[id].js
// GET /api/user/:id  ->  { id, name, email, plan, role, fetchedAt }
// 对应架构图中的 User Service（用户资料查询，需 Bearer Token）
import { users } from '../../_store.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function onRequestGet(context) {
  const auth = context.request.headers.get('authorization') || '';
  if (auth.indexOf('Bearer ') !== 0) {
    return json({ error: '未授权：缺少 Bearer Token' }, 401);
  }

  const id = context.params.id;
  const user = users.find(function (u) { return u.id === id; });
  if (!user) {
    return json({ error: '用户不存在: ' + id }, 404);
  }

  // 真实环境此处会查 PostgreSQL: SELECT * FROM users WHERE id = $1
  return json({
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    role: user.role,
    fetchedAt: new Date().toISOString(),
  });
}
