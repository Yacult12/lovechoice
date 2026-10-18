# LoveChoice 拣爱 · 后端 API（Node.js + MySQL）

双视角（他 / 她）× 双好感度（affection_male / affection_female）的网页小游戏后端。
每条故事线是独立剧本，同一个选择在两条线上的好感落点不同；结局由双方好感共同决定。

技术栈：**Express 4 + mysql2 连接池 + JWT + bcrypt + zod 校验**，无 ORM，SQL 全部显式可控。

---

## 一、目录结构

```
server/
├─ package.json
├─ .env / .env.example          # 环境变量（.env 不要提交到 git）
├─ sql/
│  └─ demo_content.sql          # 可选：把示例剧本补成可通关的 demo
├─ scripts/
│  ├─ check-db.js               # npm run db:check 数据库自检
│  └─ load-sql.js               # npm run demo 执行 .sql 文件
└─ src/
   ├─ server.js                 # 启动入口（自检 + 优雅退出）
   ├─ app.js                    # express 装配（cors / helmet / 路由 / 错误处理）
   ├─ config/
   │  ├─ index.js               # env 读取与生产环境强校验
   │  └─ db.js                  # mysql2 连接池 + 事务封装
   ├─ middleware/
   │  ├─ auth.js                # requireAuth / optionalAuth（解析 JWT）
   │  ├─ validate.js            # zod 参数校验
   │  └─ errorHandler.js        # 统一错误码 & MySQL 错误翻译
   ├─ schemas/index.js          # 所有请求体的 zod schema
   ├─ services/
   │  ├─ authService.js         # 注册 / 登录 / 改密码 / 改资料
   │  ├─ storyService.js        # 故事线、章节、节点、选项、结局读取 + 剧本自检
   │  ├─ saveService.js         # 存档（saves）读写
   │  ├─ playService.js         # 剧情推进（服务端权威：推进 / 选择 / 结算）
   │  └─ endingService.js       # 结局条件求值 + 解锁
   └─ routes/
      ├─ index.js
      ├─ auth.routes.js
      ├─ story.routes.js
      ├─ play.routes.js
      ├─ save.routes.js
      ├─ me.routes.js
      └─ health.routes.js
```

---

## 二、快速开始

```bash
cd server
npm install
npm run db:check     # 先确认库名/表结构
npm run demo         # 可选：导入可通关的示例剧本
npm run dev          # 开发模式（node --watch）
npm start            # 生产模式
```

默认监听 `http://127.0.0.1:3000`，健康检查 `GET /api/health`。

> **关于库名**：你给的建表脚本里写的是 `USE lovechoice;`，而你说数据库名是 `love`。
> 如果脚本已经执行过，表就在 `lovechoice` 里 —— 请把 `.env` 的 `DB_NAME` 改成 `lovechoice`，
> 或者在 `love` 库里重新执行一遍建表语句。`npm run db:check` 会直接把这个问题指出来。

---

## 三、环境变量（.env）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | 3000 | 服务端口 |
| `DB_HOST` / `DB_PORT` | 127.0.0.1 / 3306 | MySQL 地址 |
| `DB_USER` / `DB_PASSWORD` | root / 123456 | MySQL 账号 |
| `DB_NAME` | love | 数据库名（见上方提示） |
| `JWT_SECRET` | dev 默认值 | **生产必须换成 32 位以上随机串** |
| `JWT_EXPIRES_IN` | 7d | 令牌有效期 |
| `BCRYPT_ROUNDS` | 10 | 密码哈希强度 |
| `AFFECTION_MIN` / `AFFECTION_MAX` | 0 / 100 | 好感度裁剪区间 |
| `STRICT_PLAY` | true | 强制校验客户端上报的节点 = 存档当前节点（防作弊） |
| `CORS_ORIGIN` | * | 允许的前端来源，多个用逗号分隔 |

---

## 四、通用约定

**响应体**统一为：

```json
{ "code": 0, "message": "ok", "data": { } }
```

失败时 HTTP 状态码 + `code` 非 0，`data` 为 `null`，校验失败会带 `details`：

```json
{ "code": 42200, "message": "参数校验失败",
  "data": null,
  "details": [{ "path": "password", "message": "密码至少 6 位" }] }
```

**鉴权**：需要登录的接口请求头带 `Authorization: Bearer <token>`。

**错误码**（`src/utils/errors.js`）：账号 `1xxxx`、剧情 `2xxxx`、存档 `3xxxx`、服务端 `5xxxx`。

---

## 五、API 清单

### 1) 健康检查 / 元信息

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 否 | 进程与数据库状态，含缺失表清单，适合云监控探活 |
| GET | `/api/meta` | 否 | 版本、好感度区间、支持的故事线 |

### 2) 账号 `/api/auth`

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 否 | `{username, password, nickname?}` → `{token, user}` |
| POST | `/api/auth/login` | 否 | `{username, password}` → `{token, user}` |
| GET | `/api/auth/me` | 是 | 当前用户 |
| PATCH | `/api/auth/profile` | 是 | `{nickname}` |
| POST | `/api/auth/password` | 是 | `{oldPassword, newPassword}` |
| POST | `/api/auth/logout` | 是 | 前端丢弃令牌即可 |

```bash
curl -X POST http://127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"tester","password":"123456","nickname":"阿树"}'
```

### 3) 剧情 `/api/story`（公开，带 token 会附带解锁状态）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/story/routes` | 故事线列表（male 他的视角 / female 她的视角） |
| GET | `/api/story/routes/:routeCode` | 线路详情 + 章节列表 + 结局列表（隐藏结局未解锁显示 `???`） |
| GET | `/api/story/routes/:routeCode/characters` | 该线角色（主角 / 对方） |
| GET | `/api/story/routes/:routeCode/chapters/:chapterNo` | **单章剧本**：`{chapter, nodes[]}`，选项节点带 `options[]` |
| GET | `/api/story/routes/:routeCode/script` | 整线剧本，按章节分组，用于前端预加载 |
| GET | `/api/story/routes/:routeCode/validate` | **剧本自检**：断链、指向不存在的节点、空选项节点、不可达节点 |
| GET | `/api/story/endings?routeCode=male` | 结局列表与解锁状态 |

单章剧本返回示例：

```json
{
  "chapter": { "id": 1, "chapterNo": 1, "title": "第一章 · 初见", "startNode": "n_start" },
  "nodes": [
    { "nodeKey": "n_start", "speaker": "旁白", "content": "那是九月的一个下午……",
      "bgKey": "library", "type": "dialogue", "nextNodeKey": "n_first_choice", "options": [] },
    { "nodeKey": "n_first_choice", "speaker": "你", "content": "她的书掉在地上，你要怎么做？",
      "type": "choice", "nextNodeKey": null,
      "options": [
        { "optionKey": "o_help", "optionText": "弯腰帮她捡起来", "effectMale": 0, "effectFemale": 5, "sortNo": 1 }
      ] }
  ]
}
```

> 注意：**选项不下发 `next_node_key`**，跳转由服务端裁决，客户端改不了剧情走向。

### 4) 游戏推进 `/api/play`（全部需要登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/play/start` | `{routeCode, slot=0}` 开始/继续；无存档则用该线第一章首节点创建；换线路会重置该档位 |
| GET | `/api/play/state?routeCode=male&slot=0` | 只读当前进度（**不会**创建存档） |
| POST | `/api/play/advance` | `{routeCode, slot, nodeKey}` 对白推进；**章末自动进入下一章** |
| POST | `/api/play/choice` | `{routeCode, slot, nodeKey, optionKey}` 提交选择：结算双方好感 + 写 `choice_logs` + 推进 |
| POST | `/api/play/chapter` | `{routeCode, slot, chapterNo}` 跳到指定章节 |
| POST | `/api/play/settle` | `{routeCode, slot}` 主动结算当前好感对应的结局 |
| POST | `/api/play/tick` | `{routeCode, slot, seconds}` 累加游玩时长（单次 ≤ 1800 秒） |

`/api/play/start` 返回：

```json
{
  "save": { "slot": 0, "routeCode": "male", "chapterNo": 1, "nodeKey": "n_start",
            "affectionMale": 0, "affectionFemale": 0, "playSeconds": 0 },
  "node": { "nodeKey": "n_start", "speaker": "旁白", "content": "……", "type": "dialogue" },
  "created": true, "resumed": false, "reset": false
}
```

`/api/play/choice` 返回（含好感增量、双方当前值，到达结局节点时自动结算）：

```json
{
  "save": { "nodeKey": "n_helped", "chapterNo": 1, "affectionMale": 0, "affectionFemale": 5 },
  "node": { "nodeKey": "n_helped", "speaker": "她", "content": "「谢谢你。」", "type": "dialogue" },
  "effects": { "male": 0, "female": 5 },
  "affection": { "male": 0, "female": 5 },
  "delta": { "male": 0, "female": 5 },
  "choice": { "optionKey": "o_help", "optionText": "弯腰帮她捡起来" },
  "chapterComplete": false,
  "ended": false
}
```

到达结局时额外带：

```json
{ "ended": true, "newlyUnlocked": true,
  "ending": { "endingKey": "e_true", "title": "双向奔赴", "description": "你们都选择了靠近。",
              "isHidden": false, "unlocked": true } }
```

若好感不满足任何结局条件：`{ "ended": true, "noEndingMatched": true, "ending": null }`（可据此提示玩家重新走一遍）。

### 5) 存档 `/api/saves`（需要登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/saves` | 该用户全部存档（带章节名） |
| GET | `/api/saves/:slot` | 单个存档 |
| PUT | `/api/saves/:slot` | 覆盖写存档（导入存档 / 本地计算模式回写），会校验节点确实存在于该线路 |
| DELETE | `/api/saves/:slot` | 删除存档 |

`PUT` 请求体：`{routeCode, nodeKey, chapterId?, affectionMale?, affectionFemale?, stateJson?, playSeconds?}`

### 6) 个人中心 `/api/me`（需要登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/me` | 当前用户 |
| PATCH | `/api/me` | `{nickname}` |
| GET | `/api/me/stats` | 存档数、总时长、选择次数、双方好感峰值、两条线各自的选择数/到达章节数/结局收集度 |
| GET | `/api/me/endings` | 已解锁结局（带 `unlockedAt`） |
| GET | `/api/me/history?routeCode=male&page=1&pageSize=20` | **选择记录回看**：选了哪个选项、前后双方好感、所在章节，倒序分页 |

---

## 六、完整走一遍（前端对接顺序）

```bash
# 1. 注册拿 token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo01","password":"123456"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.token")

# 2. 看有哪些线
curl -s http://127.0.0.1:3000/api/story/routes

# 3. 开始男主线 0 号档
curl -s -X POST http://127.0.0.1:3000/api/play/start \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"routeCode":"male","slot":0}'

# 4. 对白推进（nodeKey = 上一步返回的 node.nodeKey）
curl -s -X POST http://127.0.0.1:3000/api/play/advance \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"routeCode":"male","slot":0,"nodeKey":"n_start"}'

# 5. 遇到 type=choice 的节点时提交选择
curl -s -X POST http://127.0.0.1:3000/api/play/choice \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"routeCode":"male","slot":0,"nodeKey":"n_first_choice","optionKey":"o_help"}'
```

前端循环：`node.type === 'choice'` → 渲染按钮 → 调 `/api/play/choice`；
否则渲染对白 + 「继续」按钮 → 调 `/api/play/advance`；
返回体里 `node === null` 且 `finished === true` 表示剧本结束，`ended === true` 表示触发了结局页。

---

## 七、剧本编写约定（很重要）

1. **`node_key` 只在章内唯一**（表约束 `uk_chapter_node (chapter_id, node_key)`）。
   因此每章的第一个节点都叫 `n_start`，跨章跳转由服务端用 `chapter_id + start_node` 精确定位。
2. **章末写法**：对白节点 `next_node_key` 填 `NULL`，服务端会自动把进度推进到「下一章的第一个节点」，
   并在响应里返回 `chapterComplete: true, nextChapterNo: 2`。所以**不要**把 `next_node_key` 写成 `n_start`，否则会回到本章开头。
3. **选项节点**不要设置 `next_node_key`，它的走向写在 `choices.next_node_key`。
4. 最后一章的最后节点 `next_node_key = NULL` 且没有下一章时，返回 `finished: true`。
5. `scene_nodes.node_type` 用 `ending` 标记结局节点：进入该节点即触发 `endings` 条件匹配与解锁。
6. 建议每次改完剧本都跑一次 `/api/story/routes/<code>/validate` 做断链自检。

---

## 八、部署到阿里云（ECS）

```bash
# 1. 服务器装 Node 18+ 与 MySQL 8
# 2. 上传代码后
cd server && npm install --omit=dev
cp .env.example .env   # 改 DB_PASSWORD / JWT_SECRET / DB_NAME

# 3. 用 pm2 常驻
npm i -g pm2
pm2 start src/server.js --name love-api
pm2 save && pm2 startup
```

Nginx 反向代理示例：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {                      # 前端静态页面（html/css/js）
    root /var/www/lovechoice/dist;
    try_files $uri $uri/ /index.html;
  }
}
```

安全组须放行 80/443；MySQL 3306 **不要**对公网开放，只允许本机或内网访问。
生产环境务必：`NODE_ENV=production` + 强 `JWT_SECRET` + 限制 `CORS_ORIGIN` 为你的域名。

---

## 九、下一步（前端部分）

前端用原生 HTML/CSS/JS 即可：登录页 → 线路选择（他 / 她）→ 剧情页（背景图 + 立绘 + 对白框 + 选项按钮 + 双好感度条）
→ 存档页（10 个档位）→ 结局图鉴页 + 回看页（读 `/api/me/history`）。
所有跳转都由 `/api/play/*` 的返回值驱动，前端不含任何剧本逻辑。
