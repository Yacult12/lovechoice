# ============================================================
#   后端 API 镜像
#
#   多阶段构建：
#     deps  —— 只装依赖，利用镜像层缓存（改代码不会重装 node_modules）
#     runtime —— 真正的运行镜像，不含编译工具链
# ============================================================

# ---------- 阶段 1：装依赖 ----------
FROM node:20-alpine AS deps

WORKDIR /app

# 先只拷贝 package.json，装完再拷贝源码 ——
# 这样只要依赖没变，改业务代码时这一层直接命中缓存
COPY package*.json ./

RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 阶段 2：运行环境 ----------
FROM node:20-alpine AS runtime

# tini 负责转发信号，保证 docker stop 能触发优雅退出（node 默认收不到 SIGTERM）
# wget 供 healthcheck 使用（alpine 自带，比 curl 小很多）
RUN apk add --no-cache tini wget

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY sql ./sql

# 以非 root 运行
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs \
 && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# 健康检查：打自己的 /api/health（不经 nginx）
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]