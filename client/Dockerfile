# ============================================================
#   前端静态资源镜像（nginx）
#
#   设计要点：API 地址不在代码里写死，而是由 /config.js 在运行时注入。
#   nginx 挂载一份 config.js 覆盖镜像内的默认值，
#   于是同一份镜像可以在不同环境跑（本地直连 3000 / 生产走同源反代），
#   改配置只要重启容器，不用重新构建。
# ============================================================

FROM nginx:1.27-alpine AS runtime

# ⚠️ 下面所有 COPY 路径都相对于 **build context**，
# 而 docker-compose.yml 里 frontend 的 context 是仓库根（.），
# 所以路径必须带 client/ 前缀，否则构建会报
#   failed to compute cache key: "/docker/nginx.conf": not found
#
# 如果改成 context: ./client，就要把这些前缀去掉。

# nginx 站点配置：静态托管 + /api 反向代理到后端
COPY client/docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY client/ /usr/share/nginx/html/

# 运行时配置默认值（compose 会用挂载覆盖）
COPY client/docker/config.js /usr/share/nginx/html/config.js

# ---------- 构建号打进 URL ----------
#
# index.html 里所有 JS/CSS 的引用都带 ?v=__LOVE_BUILD__，
# 构建时把它替换成「本次静态资源的内容哈希」。
#
# 为什么需要：光靠 HTTP 缓存头不够 —— 中间的代理、CDN、
# 甚至某些浏览器的启发式缓存都可能把上一版文件留下。
# URL 一旦带上版本号，任何一版的资源 URL 都不同，
# 缓存不可能张冠李戴。
#
# 替换失败也不会出事：占位符本身是合法字符串，
# 退化成「不换版本号」，功能不受影响。
RUN set -eux; \
    stamp="$(cat /usr/share/nginx/html/index.html \
                /usr/share/nginx/html/assets/js/*.js \
                /usr/share/nginx/html/assets/js/pages/*.js \
                /usr/share/nginx/html/assets/css/*.css \
             | md5sum | cut -c1-8)"; \
    echo "构建号: ${stamp}"; \
    sed -i "s/__LOVE_BUILD__/${stamp}/g" /usr/share/nginx/html/index.html; \
    if grep -q '__LOVE_BUILD__' /usr/share/nginx/html/index.html; then \
      echo "构建号替换失败"; exit 1; \
    fi

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]