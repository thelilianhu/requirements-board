# 看板对话后端（Vercel）

1. 在 Vercel 里 Import 本仓库（Framework 选 Other，无需构建命令）
2. 环境变量：
   - `DEEPSEEK_API_KEY`：DeepSeek API Key
   - `BOARD_TOKEN`：前端访问口令，例如 `your-token`
3. 部署后接口地址：`https://<项目>.vercel.app/api/chat`

前端调用：

```json
POST /api/chat
{ "token": "999000ab", "messages": [{ "role": "user", "content": "现在有哪些需求？" }] }
```

返回 `{ "reply": "..." }`。
