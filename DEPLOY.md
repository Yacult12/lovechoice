# Docker 部署

三个容器：mysql + backend(Node API) + frontend(nginx)。
浏览器只看到一个端口，前后端同源，因此没有 CORS 问题。

## 快速开始

```powershell
cd server
node scripts/init-docker-env.js   # 生成 .env（含随机 JWT 密钥）
cd ..

deploy.bat                        # 或：docker compose up -d --build
```

打开 **http://localhost:8080**

## 前置条件

| 项 | 要求 |
| --- | --- |
| Docker Desktop | 较新版本（需自带 `docker compose`） |
| 内存 | 至少 4GB 可用 |
| 端口 | 8080 前端 / 3306 数据库 / 3000 后端 |

Windows 上首次安装 Docker Desktop 后需重启一次。

## 端口

| 端口 | 服务 | 必须 | 说明 |
| --- | --- | --- | --- |
| 8080 | 前端 nginx | 是 | 浏览器访问这个 |
| 3000 | 后端 API | 否 | 仅本机调试用 |
| 3306 | MySQL | 否 | 已绑 127.0.0.1 |

本机已有 MySQL 占 3306 时，把 `.env` 里 `DB_PORT` 改成 `3307`
即可 —— 容器内部仍走 3306，不冲突。

## 数据怎么存的

数据放在 Docker 命名卷 `lovechoice_mysql-data`，与本机 MySQL 完全隔离。

```
首次 docker compose up    → 自动执行 sql/ 下脚本，建表 + 灌剧情
docker compose down        → 容器删了，数据还在
docker compose down -v     → 数据一起删，慎用
```

### 迁移本机现有数据

```powershell
mysqldump -h127.0.0.1 -uroot -p love > dump.sql
Get-Content dump.sql -Raw | docker compose exec -T mysql mysql -uroot -p123456 love
```

## 常用命令

```powershell
docker compose ps                    # 状态
docker compose logs -f backend       # 后端日志
docker compose logs -f frontend      # nginx 日志
docker compose restart backend       # 只重启后端
docker compose up -d --build backend # 改代码后重新构建
docker compose down                  # 停止（保留数据）
docker compose down -v               # 停止并删数据 ⚠️
```

## API 地址配置

前端 API 基址在 `client/docker/config.js`，通过 `window.LOVE_API_BASE` 注入。

默认留空（走同源相对路径），这是推荐配置 ——
前后端同域不涉及 CORS，且 nginx 会把 `X-Forwarded-For`
透传给后端，限流能拿到真实客户端 IP。

若前后端分开部署（如前端上 CDN），改该文件后：

```powershell
docker compose restart frontend
```

不需要重新构建镜像。

## 生产部署注意

**1. 必须改 JWT_SECRET**

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

写进 `.env`。低于 32 位后端拒绝启动（有意为之的强校验）。

**2. 收紧 CORS**

`.env` 里把 `CORS_ORIGIN` 改成实际域名，别留 `*`。

**3. 摘掉多余端口映射**

生产不需要公网直连 3000 / 3306。
删掉 `docker-compose.yml` 里 backend 和 mysql 的 `ports` 段，只留前端。

**4. 数据库备份**

```powershell
docker compose exec mysql mysqldump -uroot -p123456 love > backup.sql
```

建议加定时任务。

**5. 限流按实际调**

`RATE_LIMIT_AUTH_MAX` 是每 IP 计数。
若部署在校园网或 NAT 后面，同一出口 IP 的玩家共享额度，
十几人同时注册就会互相锁 —— 按人数调大。

## 排查

| 现象 | 原因 / 解决 |
| --- | --- |
| 端口 3306 已被占用 | `.env` 改 `DB_PORT=3307` |
| backend 一直 restarting | `logs backend`，多半 DB 连不上 |
| 前端能开但接口全 404 | nginx 没起来，看 `logs frontend` |
| 前端白屏 | 浏览器控制台，多半 `config.js` 没加载 |
| JWT_SECRET 至少 32 位 | 跑 `init-docker-env.js` 重新生成 |
| 数据没了 | 用过 `down -v`，卷被删了 |
| 改了代码没生效 | 要 `--build`，`restart` 不重新构建 |

---

## 实测记录（2026-10-18）

Docker Desktop 4.95.0 已安装，守护进程正常（Server 29.8.2 / Compose v5.6.0），
`docker compose config` 校验通过，端口避让正确（3307/ 3001 / 8080）。

**未能完成镜像构建**，原因是网络对 Docker Hub 的拦截：

```
dialing registry-1.docker.io:443 ... dial tcp 108.160.166.148:443:
A connection attempt failed because the connected party did not
properly respond after a period of time
```

已尝试并失败的方案：
- winget 安装（下载走desktop.docker.com）
- 公共镜像加速：daocloud / dockerproxy / 163 / docker-cn（均为 502 或超时）
- 宿主机与容器网络分别测试，结果一致

本机能正常访问：registry.npmjs.org、mirrors.tuna.tsinghua.edu.cn、
mirrors.aliyun.com、github.com（偶发）、desktop.docker.com（需带浏览器 UA）。

### 换网络后如何继续

```powershell
# 1. 配置镜像加速（任选可用源，填入 Docker Desktop → Settings → Docker Engine）
{
  "registry-mirrors": ["https://<你的加速器地址>"]
}

# 2. 确认 compose 配置
docker compose config --quiet

# 3. 构建并启动
docker compose up -d --build

# 4. 验证
docker compose ps
docker compose logs -f backend
curl http://localhost:8080/api/health
```

预期结果：三个容器 healthy，10 张表就绪，
2 条线 / 10 章 / 65 节点 / 33 选项 / 8 结局 全部导入。
