#!/bin/bash
# 服务器端：生成 .env 并启动
set -e
cd /opt/lovechoice

# ---------- 生成 .env（含随机 JWT 密钥）----------
if [ ! -f .env ]; then
  SECRET=$(openssl rand -hex 48)
  sed "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env.docker.example > .env
  echo "已生成 .env，JWT_SECRET 前16位: ${SECRET:0:16}…（${#SECRET} 位）"
else
  echo ".env 已存在，沿用"
fi

echo ""
echo "=== 端口占用检查 ==="
ss -tlnp 2>/dev/null | grep -E ':(8080|3000|3306)\s' || echo "  8080 / 3000 / 3306 均空闲"

echo ""
echo "=== compose 配置校验 ==="
docker compose config --quiet && echo "  配置合法"