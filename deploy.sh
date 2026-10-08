#!/usr/bin/env bash
# =====================================================================
#  HR Platform 一鍵部署腳本 (VM 專用)
#
#  用法：
#    bash ~/deploy.sh            # 部署 GitHub main 最新版本
#    bash ~/deploy.sh <commit>   # 部署 / 回滾到指定版本
#
#  流程：
#    1. 查出要部署的 commit（用 GitHub API，避開 tar.gz CDN 快取）
#    2. 下載並解壓到 ~/hr_releases/<commit>
#    3. npm install（舊版仍在服務，停機時間最短）
#    4. 停掉 pm2 的 hr-system，複製 .env 與資料庫到新版
#    5. 用 pm2 啟動新版、pm2 save、更新 ~/hr_current 連結
#    6. 驗證 port 3000 與啟動訊息
# =====================================================================
set -euo pipefail

REPO="flash12242002/mediumsalaryplatform"
APP_NAME="hr-system"
PORT="${PORT:-3000}"
RELEASES_DIR="$HOME/hr_releases"
CURRENT_LINK="$HOME/hr_current"
# 每次部署要從舊版帶過來的資料檔（不存在的會自動略過）
DATA_FILES=(".env" "database.sqlite" "database.sqlite-wal" "database.sqlite-shm" "db_store.json" "onboard_db.json")

info() { echo -e "\033[36m▶ $*\033[0m"; }
ok()   { echo -e "\033[32m✔ $*\033[0m"; }
fail() { echo -e "\033[31m✘ $*\033[0m"; exit 1; }

# ---------- 1. 決定要部署的 commit ----------
REF="${1:-main}"
info "查詢版本：$REF"
SHA=$(curl -fsSL "https://api.github.com/repos/$REPO/commits/$REF" \
      | grep -m1 '"sha"' | cut -d'"' -f4) || true
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "找不到版本 $REF（請確認 commit 是否已 push）"
ok "目標版本：${SHA:0:7}"

# ---------- 2. 找出目前正在跑的資料夾（資料來源） ----------
OLD_DIR=""
if [ -L "$CURRENT_LINK" ]; then
  OLD_DIR=$(readlink -f "$CURRENT_LINK")
elif pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  OLD_DIR=$(pm2 jlist | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const p=JSON.parse(s).find(x=>x.name==='$APP_NAME');
      console.log(p?p.pm2_env.pm_cwd:'');
    });")
fi
[ -n "$OLD_DIR" ] && [ -d "$OLD_DIR" ] || fail "找不到目前的部署資料夾，無法帶過 .env 與資料庫"
ok "目前版本資料夾：$OLD_DIR"

NEW_DIR="$RELEASES_DIR/$SHA"
[ "$(readlink -f "$OLD_DIR")" = "$(readlink -f "$NEW_DIR" 2>/dev/null || echo x)" ] \
  && fail "版本 ${SHA:0:7} 已經是目前正在跑的版本，不需重新部署"

# ---------- 3. 下載、解壓、安裝 ----------
info "下載原始碼..."
mkdir -p "$RELEASES_DIR"
rm -rf "$NEW_DIR" && mkdir -p "$NEW_DIR"
curl -fsSL "https://github.com/$REPO/archive/$SHA.tar.gz" \
  | tar -xz -C "$NEW_DIR" --strip-components=1
ok "已解壓到 $NEW_DIR"

info "npm install（舊版仍在服務中）..."
cd "$NEW_DIR"
npm install --no-audit --no-fund
node -e "require('@google-cloud/firestore')" 2>/dev/null \
  || npm install @google-cloud/firestore --no-audit --no-fund
ok "套件安裝完成"

# ---------- 4. 停舊版、搬資料 ----------
info "停止舊版 $APP_NAME..."
pm2 stop "$APP_NAME" >/dev/null 2>&1 || true
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
sleep 2
if ss -ltn | grep -q ":$PORT "; then
  PIDS=$(ss -ltnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u || true)
  [ -n "$PIDS" ] && kill -9 $PIDS && sleep 1
fi
ss -ltn | grep -q ":$PORT " && fail "Port $PORT 仍被佔用，請手動檢查：ss -ltnp | grep :$PORT"
ok "Port $PORT 已釋放"

info "複製資料檔..."
for f in "${DATA_FILES[@]}"; do
  if [ -f "$OLD_DIR/$f" ]; then cp -p "$OLD_DIR/$f" "$NEW_DIR/$f" && echo "   ✓ $f"; fi
done
[ -s "$NEW_DIR/.env" ] || echo -e "\033[33m   ⚠ .env 不存在或是空的，API 金鑰相關功能將無法使用\033[0m"

# ---------- 5. 啟動新版 ----------
info "用 pm2 啟動新版..."
pm2 start "npx tsx server.ts" --name "$APP_NAME" --cwd "$NEW_DIR" >/dev/null
pm2 save >/dev/null
ln -sfn "$NEW_DIR" "$CURRENT_LINK"
cp -f "$NEW_DIR/deploy.sh" "$HOME/deploy.sh" 2>/dev/null || true

# ---------- 6. 驗證 ----------
info "等待伺服器啟動..."
for i in $(seq 1 30); do
  ss -ltn | grep -q ":$PORT " && break
  sleep 1
done
echo "-------------------- 最近的啟動訊息 --------------------"
pm2 logs "$APP_NAME" --lines 15 --nostream 2>/dev/null | tail -n 15 || true
echo "--------------------------------------------------------"
if ss -ltn | grep -q ":$PORT "; then
  ok "部署完成！版本 ${SHA:0:7} 正在 port $PORT 運行"
  echo "   👉 瀏覽器請按 Ctrl + Shift + R 強制重新整理"
  echo "   👉 回滾：bash ~/deploy.sh <舊版 commit>（舊版保留在 $RELEASES_DIR）"
else
  fail "伺服器 30 秒內沒有啟動，請看上方訊息或執行：pm2 logs $APP_NAME"
fi
