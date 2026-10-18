# 他们的故事 · Their Story

> 同一个故事，两种视角，两份不同的好感。

一款参考《拣爱》的双视角网页小游戏。**他 / 她** 两条独立故事线，同一个选择在两条线上的好感落点不同，
剧情可完全通关；结局由**双方好感共同**决定。

纯原生前端（HTML + CSS + JavaScript）+ Node.js 后端 + MySQL，可部署到阿里云。

---

## 一、项目结构

```
love/
├─ server/                     # Node.js 后端 API
│  ├─ src/
│  │  ├─ server.js             # 启动入口
│  │  ├─ app.js                # Express 装配
│  │  ├─ config/               # env 校验 / MySQL 连接池
│  │  ├─ middleware/           # JWT 鉴权 / zod 校验 / 统一错误
│  │  ├─ schemas/              # 请求体 schema
│  │  ├─ services/             # auth / story / play / save / ending
│  │  └─ routes/               # auth / story / play / saves / me / health
│  ├─ sql/full_story.sql       # ★ 完整剧本（5 章 ×2 线 · 8 结局），幂等可重跑
│  ├─ scripts/
│  │  ├─ check-db.js           # 数据库自检
│  │  ├─ load-sql.js           # SQL 执行器
│  │  ├─ generate-art.js       # ★ 生成 8 背景 + 7 立绘 SVG
│  │  ├─ calibrate.js          # 实测好感上限，用于标定结局阈值
│  │  └─ test-endings.js       # ★ 穷举所有选择组合，验证结局可达
│  └─ README.md                # 后端接口文档
├─ client/                     # 原生前端（无框架、无构建）
│  ├─ index.html
│  └─ assets/
│     ├─ css/main.css          # 全局设计系统
│     ├─ js/
│     │  ├─ api.js             # API 封装（统一拆包 / 401 处理）
│     │  ├─ ui.js              # DOM 构建 / Toast / Modal / 背景映射
│     │  ├─ store.js           # localStorage 状态
│     │  ├─ app.js             # hash 路由 + 页面调度
│     │  └─ pages/             # auth / routes / play / saves / gallery / history / profile
│     └─ img/                  # ★ 美术资源（SVG 矢量，任意分辨率不糊）
│        ├─ bg/                # 8 张背景 960×540
│        └─ avatar/            # 7 张立绘 460×780（3 种情绪 × 男女）
├─ preview-art.html             # 美术资源预览页（浏览器打开即可看大图）
└─ .smoke/                     # 前端冒烟测试（jsdom，45 项断言）
```

---

## 二、快速启动

### 1. 准备数据库

```sql
-- 执行 server/sql 下的建表语句（你已有的那份即可）
-- 注意：脚本里是 USE lovechoice;，若你的库名是 love，请改成 USE love;
```

### 2. 启动后端

```powershell
cd server
npm install
copy .env.example .env      # Windows；Linux/macOS 用 cp
npm run db:check            # 确认库名 / 表结构
npm run script              # 导入完整剧本（5 章 ×2 线 · 8 结局，幂等可重复执行）
npm run art                 # 生成背景图与立绘（已生成，重复执行无副作用）
npm run dev                 # 开发模式，或 npm start
```

后端默认 `http://127.0.0.1:3000`。

### 3. 启动前端

```powershell
cd client
npx serve -l 5500 .
# 或者用任意静态服务器
```

打开 `http://127.0.0.1:5500/`。

> 前端默认直连 `http://127.0.0.1:3000`。部署到阿里云后，把 `client/assets/js/api.js`
> 顶部的 `BASE` 改成 `https://你的域名/api`，即可走同源（推荐，无需 CORS）。

### 4. 看看美术资源

浏览器直接打开项目根目录的 `preview-art.html`，可以看到全部 8 张背景 + 7 张立绘的大图与场景合成效果。

---

## 三、美术资源

全部为**手写 SVG 矢量图**，由 `npm run art` 生成，无外部依赖、体积小、任意分辨率不糊。

### 背景图（`client/assets/img/bg/`，960×540）

| 文件 | 场景 | 用于 |
| --- | --- | --- |
| `library.svg` | 图书馆 · 书架与窗光 | 第一章 初见 / 借书 |
| `classroom.svg` | 教室 · 黑板与课桌 | 第二章 靠近 / 误解 |
| `cafe.svg` | 咖啡馆 · 吊灯与吧台 | 第三章 传闻 |
| `rain.svg` | 雨夜 · 霓虹与雨丝 | 第四章 雨夜 / 一把伞 |
| `corridor.svg` | 走廊 · 纵深与行李箱 | 第五章 走廊 |
| `street.svg` | 街道 · 路灯与建筑 | 第二章（章节过场） |
| `dorm.svg` | 宿舍 · 台灯与窗 | 第二章 靠近 |
| `rooftop.svg` | 天台 · 星空与栏杆 | 备用场景 |

每张背景都自带上下压暗的渐变遮罩，保证对白框区域始终可读。
剧本里 `bg_key` 找不到对应图时会**自动降级为 CSS 渐变**，任何剧本都不会开天窗。

### 角色立绘（`client/assets/img/avatar/`，460×780）

| 文件 | 角色 | 情绪 |
| --- | --- | --- |
| `male-soft.svg` / `male-down.svg` / `male-away.svg` | 他（冷蓝） | 柔和 / 低落 / 疏离 |
| `female-soft.svg` / `female-smile.svg` / `female-down.svg` / `female-away.svg` | 她（暖粉） | 柔和 / 微笑 / 低落 / 疏离 |

**表情随好感动态切换**：好感 ≥55 显示微笑/柔和，≥20 显示平静，<20 显示低落/疏离。
DB 的 `characters.avatar_url` 只存基础路径，具体表情由前端按当前好感推导。

想换成手绘素材？把同名 SVG/PNG 覆盖进 `img/` 目录即可，无需改代码。

---

## 四、前端页面一览

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `#/auth` | 登录 / 注册 | 支持切换模式，路由守卫拦截未登录访问 |
| `#/routes` | 故事线选择 | 两条线的章节进度、结局收集度、游玩时长 |
| `#/play/:route/:slot` | **剧情页** | 背景 / 立绘 / 打字机对白 / 选项 / 双好感度条 |
| `#/saves` | 存档管理 | 0-9 共 10 档，支持章节跳转、删除 |
| `#/gallery` | 结局图鉴 | 含隐藏结局，未解锁显示 `？？？` |
| `#/history` | 选择回看 | 每个决定的选项文案 + 双方好感变化 |
| `#/profile` | 个人中心 | 统计、各线进度、改昵称/密码 |

### 剧情页交互

- **点对白框**：打字未完 → 立刻补完；已打完 → 推进到下一节点
- **选项**：点击提交，或按数字键 `1`-`9`
- **好感度条**：选择后实时更新，并飘出 `+25` / `-15` 动画
- **章节过场**：自动进入下一章时弹出章节卡
- **结局卡**：显示结局名、描述、双方最终好感；首次解锁会有提示
- **快捷**：`⏩` 按钮切换打字速度

---

## 四、核心机制

### 双视角 · 双好感

每条故事线（`routes.route_code` = `male` / `female`）是独立剧本。
每个选项（`choices`）有 `effect_male` 和 `effect_female` 两个独立增量，
分别累加到 `saves.affection_male` 与 `saves.affection_female`。
所以同一句「我最近有点累……」在两条线上会导向完全不同的后续。

### 服务端权威

前端**不持有任何剧本逻辑**，只上报「我在哪个节点、点了哪个选项」。
跳转、好感结算、写日志全部由后端裁决，客户端改不了走向。
选项的 `next_node_key` 也不下发给前端。

### 结局判定

`endings.condition_json` 支持：

```json
{ "affection_male": { ">=": 70 }, "affection_female": { ">=": 70 } }
{ "affection_female": { "<": 30 } }
{ "flags": { "gave_gift": true }, "all": [ {...}, {...} ] }
{ "any": [ {...}, {...} ], "not": {...} }
```

无法识别的键一律判定为**不满足**（宁可漏触发，也不误触发隐藏结局）。

### 存档

- 每个用户 10 个档位（`saves.slot` 0-9）
- 同一档位切换故事线会自动重置（`reset: true`），旧档被覆盖前会提示
- 结局解锁记录（`user_endings`）**跨档位永久保留**

---

## 五、剧本编写约定

1. `node_key` **只在章内唯一**（`uk_chapter_node`），所以每章首节点都叫 `n_start`。
2. **章末写法**：对白节点 `next_node_key` 留 `NULL`，服务端自动推进到下一章首节点，
   并返回 `chapterComplete: true, nextChapterNo: 2`。
   ⚠️ **不要**把它写成 `n_start`，否则会跳回本章开头死循环。
3. 选项节点不要设 `next_node_key`，走向写在 `choices.next_node_key`。
4. 结局节点用 `node_type = 'ending'`，进入即触发条件匹配与解锁。
5. 改完剧本跑一次自检：
   ```bash
   curl http://127.0.0.1:3000/api/story/routes/male/validate
   ```
   会报出断链、空选项节点、跨章误引用、不可达节点。

### 结局阈值的标定方法（重要）

结局条件里的数字**不能拍脑袋写**。本项目提供两个工具：

```bash
npm run calibrate      # 实测每条线「全选最优」的好感上限
npm run test:endings   # 穷举全部选择组合，验证每个结局都真的可达
```

实测基准（当前剧本）：

| 故事线 | 全最优 男 | 全最优 女 |
| --- | --- | --- |
| 他的视角 | 70 | 85 |
| 她的视角 | 80 | 83 |

所以结局阈值取 `m ≥ 55` / `f ≥ 78` —— 需要全程基本选对，但不至于只有唯一一条完美路线能达成。

> ⚠️ **穷举必须用混合进制，不能用二进制位掩码。** 本项目有一个抉择点带 3 个选项，
> 用 `2^n` 次循环的位掩码枚举会漏掉第 3 个选项，导致隐藏结局明明可达却测不出来。
> `scripts/test-endings.js` 已经处理了这一点。

### 隐藏结局的设计套路

隐藏结局需要**一个只有它才能造出的好感签名**。本项目的做法：
在第四章埋一个「沉默」选项（男线 `o_run` m -25/f +5，女线 `o_silent` m -25/f +6），
它会让「某一方好感很高、另一方明显掉队」—— 这个组合在任何其它路径上都不可能出现，
于是就成为隐藏结局的指纹。当前两条线各有 1 个隐藏结局：

- 男线「原来那天你也在」—— 唯一入口 `o_run`（把伞塞过去就跑，什么也没说）
- 女线「伞一直在他那里」—— 唯一入口 `o_silent`（把伞还回去，什么也不说）

---

## 六、测试

```bash
# 数据库自检
cd server && npm run db:check

# 剧本完整性（断链 / 不可达节点 / 跨章误引用）
curl http://127.0.0.1:3000/api/story/routes/male/validate

# 结局可达性：穷举全部选择组合，确认每个结局都能触发且条件完备
cd server && npm run test:endings

# 前端冒烟测试（需先启动后端）
cd .smoke && npm install && node smoke.js
```

冒烟测试覆盖 45 项断言：注册 → 线路选择 → 剧情推进（含多次跨章）→ 选择结算 → 结局 →
女主线 → 存档 → 图鉴 → 回看 → 个人中心 → 路由守卫 → 美术资源加载与合法性。

---

## 七、部署到阿里云

```bash
# 服务器
cd server && npm install --omit=dev
cp .env.example .env     # 改 DB_PASSWORD / JWT_SECRET / DB_NAME
npm i -g pm2
pm2 start src/server.js --name love-api && pm2 save && pm2 startup
```

Nginx 反向代理（`/api` → 后端，`/` → 前端静态页）：

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

  location / {
    root /var/www/lovechoice/client;
    try_files $uri $uri/ /index.html;
  }
}
```

安全要点：
- MySQL 3306 **不要**对公网开放
- 生产必须 `NODE_ENV=production` + 强 `JWT_SECRET`（≥32 位）+ 限制 `CORS_ORIGIN`
- 安全组只放行 80 / 443

---

## 八、下一步可以做的事

- 扩充剧本：更多章节、更多分叉、更多隐藏结局
- 用手绘素材替换 SVG 立绘（同名覆盖 `client/assets/img/` 即可，无需改代码）
- 加背景音乐 / 音效
- 加成就系统、分享结局卡片
- 多语言支持