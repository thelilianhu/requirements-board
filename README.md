# 需求管理看板

纯前端只读看板，数据由本地 DSH 需求管理面板同步生成，视觉与交互对齐面板。

- `index.html` / `styles.css` / `app.js`：静态页面，`fetch('./data.json')` 后渲染，无构建、无依赖、无 CDN
- `data.json`：`sync.sh` 从 `http://127.0.0.1:56286/requirements-panel/data` 拉取
- `sync.sh`：拉取 → 无变化跳过 → commit / push，GitHub Pages 自动发布
- `encrypt.mjs`：暂时保留，未启用

本地预览（推荐）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

直接双击 `index.html` 也能打开，但浏览器通常会拦截 `file://` 下的 `fetch`，页面会提示改用本地服务。
