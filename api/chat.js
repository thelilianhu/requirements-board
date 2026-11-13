/**
 * 需求看板对话后端（Vercel Serverless Function）。
 * 环境变量：DEEPSEEK_API_KEY、BOARD_TOKEN
 * 前端 POST /api/chat { token, messages:[{role,content}] } → { reply }
 */
const MODEL = 'deepseek-chat';
const ALLOWED_ORIGIN = '*';

function send(res, status, payload) {
  res.status(status);
  res.setHeader('content-type', 'application/json');
  res.setHeader('access-control-allow-origin', ALLOWED_ORIGIN);
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'method-not-allowed' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body) return send(res, 400, { error: 'invalid-json' });
  if (!process.env.BOARD_TOKEN || body.token !== process.env.BOARD_TOKEN) {
    return send(res, 401, { error: 'unauthorized' });
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!messages.length) return send(res, 400, { error: 'empty' });

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, stream: false }),
    });
    if (!upstream.ok) return send(res, 502, { error: 'upstream', status: upstream.status });
    const data = await upstream.json();
    return send(res, 200, { reply: data?.choices?.[0]?.message?.content ?? '' });
  } catch (error) {
    return send(res, 500, { error: 'request-failed' });
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
