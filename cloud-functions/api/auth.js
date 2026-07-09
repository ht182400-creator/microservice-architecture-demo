// cloud-functions/api/auth.js
// POST /api/auth  ->  { token, user }
// 对应架构图中的 Auth Service（鉴权 / 签发 token）
import { users, passwords, b64 } from '../_store.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function onRequestPost(context) {
  return context.request.json()
    .then(function (body) {
      const username = (body && body.username) || '';
      const password = (body && body.password) || '';
      const user = users.find(function (u) { return u.id === username; })
        || users.find(function (u) { return u.email === username; });

      if (!user || passwords[user.id] !== password) {
        return json({ error: '用户名或密码错误' }, 401);
      }

      const token = b64(user.id + ':' + Date.now());
      return json({
        token: token,
        user: { id: user.id, name: user.name, email: user.email, plan: user.plan, role: user.role },
      });
    })
    .catch(function () {
      return json({ error: '请求体格式错误（需 JSON）' }, 400);
    });
}
