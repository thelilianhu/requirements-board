#!/bin/bash
# 从本地 DSH 需求管理面板拉取 data.json → 发布纯前端只读看板到 GitHub Pages
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${1:-}" ]; then
  PORT="$1"
else
  PORT="${PORT:-${DSH_WEB_PORT:-56286}}"
fi
URL="http://127.0.0.1:${PORT}/requirements-panel/data"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

echo "拉取数据：$URL"
if ! curl -sf -H 'x-requirements-panel: 1' "$URL" -o "$tmp"; then
  echo "拉取失败：请确认本地 DSH 正在运行（端口 ${PORT}）。" >&2
  exit 1
fi
if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d.get("requirements"), list)' "$tmp" 2>/dev/null; then
  echo "返回内容不是合法 JSON，已保留旧的 data.json。" >&2
  exit 1
fi
chmod 644 "$tmp"
mv "$tmp" data.json
trap - EXIT

if [ -z "$(git status --porcelain -- data.json index.html styles.css app.js)" ]; then
  echo "数据没有变化，跳过发布。"
  exit 0
fi

git add -A
git -c user.name='Lillian.Hu' -c user.email='Lillianhu@gmail.com' commit -q -m "Sync board $(date '+%F %H:%M')"
git push -q origin main
echo "已发布：https://thelilianhu.github.io/requirements-board/"
