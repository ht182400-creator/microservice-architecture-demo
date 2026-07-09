// cloud-functions/api/notify.js
// POST /api/notify  body { userId, message }  ->  { notificationId, delivered }
// 对应架构图中的 Notification Service（通知，示意接入 Kafka/短信/邮件）
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
      const message = (body && body.message) || '';
      if (!userId || !message) {
        return json({ error: '缺少 userId 或 message' }, 400);
      }
      // 真实环境此处会向 Kafka 投递通知事件，由消费者发短信/邮件/推送
      const note = {
        notificationId: genId('NTF-'),
        userId: userId,
        message: message,
        delivered: true,
        sentAt: new Date().toISOString(),
      };
      return json(note, 201);
    })
    .catch(function () {
      return json({ error: '请求体格式错误（需 JSON）' }, 400);
    });
}
