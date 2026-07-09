// cloud-functions/api/payment.js
// POST /api/payment  body { orderId, method }  ->  { paymentId, status, paidAt }
// 对应架构图中的 Payment Service（支付）
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
      const orderId = body && body.orderId;
      const method = (body && body.method) || 'wechat';
      if (!orderId) {
        return json({ error: '缺少 orderId' }, 400);
      }
      // 真实环境此处会调用微信/支付宝 SDK 并记账
      const pay = {
        paymentId: genId('PAY-'),
        orderId: orderId,
        method: method,
        status: 'PAID',
        paidAt: new Date().toISOString(),
      };
      return json(pay, 201);
    })
    .catch(function () {
      return json({ error: '请求体格式错误（需 JSON）' }, 400);
    });
}
