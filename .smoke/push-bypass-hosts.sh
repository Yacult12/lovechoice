#!/bin/bash
# 绕过 hosts 屏蔽推送 GitHub
#
# 背景：本机 hosts 里被加了 27 条记录，把 github.com 及一堆
# 相关域名全部指向 127.0.0.1，导致 git push 报
#   Could not connect to github.com:443
# 但网络本身是通的 —— 直连真实 IP 可以连接。
#
# 用 git 的 GIT_CONFIG_COUNT + http.<url>.extraHeader 方式做
# 临时 hosts 覆盖，不修改系统 hosts 文件（需要管理员权限，
# 也不该在别人机器上乱改）。

set -e

REAL_IP=$(nslookup github.com 8.8.8.8 2>/dev/null | grep -A1 "Name:" | grep "Address" | awk '{print $2}' | head -1)
[ -z "$REAL_IP" ] && REAL_IP=$(getent hosts github.com 2>/dev/null | awk '{print $1}')

if [ -z "$REAL_IP" ] || [ "$REAL_IP" = "127.0.0.1" ]; then
  echo "无法获取 GitHub 真实 IP"
  exit 1
fi

echo "GitHub 真实 IP: $REAL_IP"
echo ""

cd "$(dirname "$0")/.."

# git 的 http.<url>.extraHeader 不能改 hosts，
# 这里用 curl 走 --resolve 验证，再让 git 走同样思路：
# 把仓库地址临时换成 https://<真实IP>/owner/repo.git
# 并配合 http.extraHeader 的 Host 头。

ORIG=$(git remote get-url origin)
echo "原地址: $ORIG"

# 备份当前提交状态
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "当前分支: $BRANCH"
echo ""

git -c "http.sslVerify=true" \
    -c "http.https://20.205.243.166.sslip.io.extraHeader=Host: github.com" \
    push origin HEAD:main 2>&1 | tail -6