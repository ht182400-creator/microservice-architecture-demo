// cloud-functions/api/order.js
// POST /api/order  body { userId, items:[{price,qty}] }  ->  { orderId, total, status }
// 对应架构图中的 Order Service（下单）
import { genId } from '../_store.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function onRequestPost(context) {
  return context.request.json()
    .then(function (body) {
      const userId = body && body.userId;
      const items = (body && body.items) || [];
      if (!userId) {
        return json({ error: '缺少 userId' }, 400);
      }
      const total = items.reduce(function (s, it) {
        return s + (Number(it.price) || 0) * (Number(it.qty) || 0);
      }, 0);

      // 真实环境此处会写 PostgreSQL 并发布 Kafka 事件
      const order = {
        orderId: genId('ORD-'),
        userId: userId,
        items: items,
        total: Math.round(total * 100) / 100,
        status: 'CREATED',
        createdAt: new Date().toISOString(),
      };
      return json(order, 201);
    })
    .catch(function () {
      return json({ error: '请求体格式错误（需 JSON）' }, 400);
    });
}
