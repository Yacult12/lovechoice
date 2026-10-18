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

---

## CI 实测记录（2026-10-18）

GitHub Actions 已配置并跑通：`.github/workflows/ci.yml`
仓库： https://github.com/Yacult12/lovechoice

### 结果

| Job | 内容 | 耗时 |
| --- | --- | --- |
| 语法与静态检查 | 语法、BOM、Node 版本、密钥、Docker 配置 | 14s |
| 接口与玩法测试 | 建库灌数据 + 10 个测试脚本 | 2m23s |

覆盖断言：172 + 186 = 约 360 项。

### 首次配置时踩的五个坑

CI 连续失败 5 次才绿，每次都是本地跑得好好的，只有 CI 炸。

**1. 硬编码本机绝对路径**
7 个脚本写死了 `C:/Users/...`，在 Linux 上直接 ENOENT。
改用 `path.resolve(__dirname, '..')` 与相对 require。

**2. find 表达式的两个语义错误**
`-path ./node_modules -prune` 只排除了根目录，而依赖实际在
`server/node_modules` 与 `.smoke/node_modules` 下；
且缺 `-type f`，导致把目录当文件读（Is a directory）。
改为 `-type d -name node_modules -prune` + `-type f`。

**3. schema.sql 的时间默认值被加了引号**
`information_schema` 返回的是字符串 `CURRENT_TIMESTAMP`，
照抄成 `DEFAULT 'CURRENT_TIMESTAMP'` 会被 MySQL 当成字符串常量，
报 ERROR 1067: Invalid default value。

**4. 仓库里根本没有创建 routes / characters 数据的脚本**
`full_story.sql` 靠 `route_code` 查 `routes.id`，而那批数据当初
是在数据库里手工插的，只存在于开发机上。
结果所有「从零建库」的流程都失败 —— 不只 CI，Docker 首次初始化、
换新机器，全都跑不起来。已补`server/sql/base_data.sql`。

**5. 索引导出丢了 NON_UNIQUE 标志**
`export-schema.js` 把所有索引都写成 `UNIQUE KEY`，
使 `scene_nodes.idx_chapter(chapter_id)` 变成单列唯一约束。
而节点本就是「一章多个」，只有 `(chapter_id, node_key)` 才唯一，
于是导入剧情报 Duplicate entry。

**6. Node 版本差异**
`jsdom@30` → `undici@8` → `zlib.createZstdDecompress`（Node 22.15+ 有）。
本地 Node 24 永远跑得通，CI 的 Node 20 直接崩在加载阶段。
实测：20.20 无 / 22.14 无 / 22.20 有 / 23.11 有。
所以 `NODE_VERSION` 必须精确到 22.20，写 `'22'` 会拉到 22.14 依然失败。

### 防复发

新增 6 个校验脚本，共 186 项断言，都已纳入流水线：

| 脚本 | 断言 | 作用 |
| --- | --- | --- |
| verify-portable.js | 19 |扫描硬编码路径 |
| verify-shell.js | 19 | find 语义 + Node 版本约束 |
| verify-ci.js | 53 | 流水线自身结构 |
| verify-docker.js | 72 | compose / Dockerfile / nginx |
| verify-schema.js | 16 | schema.sql 真的能建库 |
| verify-bootstrap.js | 27 | 从零建库全流程 |

另外流水线里直接断言 `createZstdDecompress` 存在，
版本不够当场失败并给出修复指引。

### 本地开发环境

| 项 | 版本 |
| --- | --- |
| 默认 Node | 24.21.0 |
| CI 用Node | 22.20.0（已装到 `%LOCALAPPDATA%\Programs\node22.20.0`） |

本地改依赖后建议用 22.20 跑一遍测试，与 CI 保持一致：

```powershell
$n = "$env:LOCALAPPDATA\Programs\node22.20.0\node-v22.20.0-win-x64\node.exe"
cd .smoke
& $n smoke.js
```

### 常用命令

```powershell
gh run list --repo Yacult12/lovechoice          # 看运行记录
gh run view <id> --repo Yacult12/lovechoice      # 看详情
gh run view <id> --log-failed                    # 只看失败步骤日志
```
