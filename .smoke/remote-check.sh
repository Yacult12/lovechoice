#!/bin/bash
# 服务器端部署检查（避免 PowerShell 转义问题）
set -e
cd /opt/lovechoice

echo "=== 文件统计 ==="
echo "总文件数: $(find . -type f | wc -l)"
echo "美术资源: $(find client/assets/img -type f 2>/dev/null | wc -l)"
echo "SQL 文件: $(ls server/sql/*.sql 2>/dev/null | wc -l)"
echo "Dockerfile: $(ls server/Dockerfile client/Dockerfile 2>/dev/null | wc -l)"

echo ""
echo "=== 关键文件核对 ==="
for f in docker-compose.yml server/Dockerfile client/Dockerfile \
         server/sql/schema.sql server/sql/base_data.sql \
         server/sql/full_story.sql server/sql/expand_dialogue.sql \
         server/sql/avatars.sql client/docker/nginx.conf \
         client/docker/config.js client/index.html; do
  if [ -f "$f" ]; then
    echo "  OK   $f"
  else
    echo "  MISS $f"
  fi
done

echo ""
echo "=== 磁盘与内存 ==="
df -h / | tail -1
free -m | head -2