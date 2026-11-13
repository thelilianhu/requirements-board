/**
 * 需求看板后端：把浏览器的对话请求转发给 DeepSeek，密钥只存在 Worker 里。
 *  - POST /chat  { token, messages:[{role, content}] }
 *  - 前端不允许直接带 API Key
 */
const ALLOWED_ORIGIN = '*'; // 收紧时改成你的 Pages 域名
const MODEL = 'deepseek-chat';

const cors = {
  'access-control-allow-origin': ALLOWED_ORIGIN,
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const url = new URL(request.url);
    if (url.pathname !== '/chat' || request.method !== 'POST') {
      return json({ error: 'not-found' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid-json' }, 400);
    }
    if (!env.BOARD_TOKEN || body.token !== env.BOARD_TOKEN) {
      return json({ error: 'unauthorized' }, 401);
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!messages.length) return json({ error: 'empty' }, 400);

    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, stream: false }),
    });
    if (!upstream.ok) {
      return json({ error: 'upstream', status: upstream.status }, 502);
    }
    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';
    return json({ reply }, 200);
  },
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}
