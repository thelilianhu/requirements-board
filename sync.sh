#!/bin/bash
# 从本地面板拉最新数据 → 发布到 GitHub Pages（明文，无密码）
set -e
cd "$(dirname "$0")"
PORT="${1:-${DSH_WEB_PORT:-56286}}"
curl -sf -H 'x-requirements-panel: 1' "http://127.0.0.1:${PORT}/requirements-panel/board" -o index.html
if git diff --quiet -- index.html; then
  echo "数据没有变化，跳过发布。"
  exit 0
fi
git add -A
git -c user.name='Lillian.Hu' -c user.email='Lillianhu@gmail.com' commit -q -m "Sync board $(date '+%F %H:%M')"
git push -q origin main
echo "已发布：https://thelilianhu.github.io/requirements-board/"
