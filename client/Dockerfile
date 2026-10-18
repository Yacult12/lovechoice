# ============================================================
#   前端静态资源镜像（nginx）
#
#   设计要点：API 地址不在代码里写死，而是由 /config.js 在运行时注入。
#   nginx 挂载一份 config.js 覆盖镜像内的默认值，
#   于是同一份镜像可以在不同环境跑（本地直连 3000 / 生产走同源反代），
#   改配置只要重启容器，不用重新构建。
# ============================================================

FROM nginx:1.27-alpine AS runtime

# nginx 站点配置：静态托管 + /api 反向代理到后端
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY client/ /usr/share/nginx/html/

# 运行时配置默认值（compose 会用挂载覆盖）
COPY docker/config.js /usr/share/nginx/html/config.js

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]