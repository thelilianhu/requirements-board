# 看板后端（Cloudflare Worker）

## 部署
```bash
cd 需求管理/board/worker
npx wrangler login                 # 浏览器授权你的 Cloudflare 账号
npx wrangler secret put DEEPSEEK_API_KEY   # 粘贴 DeepSeek Key
npx wrangler secret put BOARD_TOKEN        # 自定的访问口令，前端要填同一个
npx wrangler deploy
```

部署成功后会输出 `https://requirements-board-api.<你的子域>.workers.dev`。

## 接口
`POST /chat`

```json
{ "token": "<BOARD_TOKEN>", "messages": [{ "role": "user", "content": "..." }] }
```

返回 `{ "reply": "..." }`。

## 安全
- Key 只在 Worker secret 里，前端拿不到。
- `BOARD_TOKEN` 是前端访问口令，过期就换一个再 `wrangler secret put`。
- CORS 目前是 `*`，上线后建议改成看板的 GitHub Pages 域名。
