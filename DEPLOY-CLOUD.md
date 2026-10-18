# ============================================================
#   阿里云部署记录
# ============================================================

## 服务器信息

| 项 | 值 |
| --- | --- |
| 公网 IP | `121.40.54.103` |
| 供应商 | 阿里云轻量应用服务器 |
| SSH 用户 | 待确认（Ubuntu 镜像通常用 `root`，不是 `ubuntu`） |
| SSH 端口 | 22（已验证开放） |
| 游戏端口 | 8080（**需在安全组放行**） |

## 部署密钥

本机已生成部署专用密钥对：

```
私钥: %USERPROFILE%\.ssh\lovechoice_aliyun
公钥: %USERPROFILE%\.ssh\lovechoice_aliyun.pub
```

公钥内容（需写入服务器的 `~/.ssh/authorized_keys`）：

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH79jqJdkrRrqBEPTqVyN5h1MHsrPzBYRa5YOAwMrlp/ lovechoice-deploy
```

## 首次部署步骤

### 1. 添加公钥（在控制台「远程连接」里执行）

```bash
mkdir -p ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH79jqJdkrRrqBEPTqVyN5h1MHsrPzBYRa5YOAwMrlp/ lovechoice-deploy' >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 2. 安全组放行 8080

控制台 → 服务器 → 防火墙 → 添加规则：TCP / 8080 / 来源 `0.0.0.0/0`

### 3. 服务器上装 Docker

```bash
curl -fsSL https://mirrors.aliyun.com/docker-ce/install.sh | bash -s docker --mirror Aliyun
systemctl enable docker && systemctl start docker
```

### 4. 配置镜像加速

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://mirror.ccs.tencentyun.com"
  ]
}
EOF
systemctl daemon-reload && systemctl restart docker
```

### 5. 部署项目

```bash
mkdir -p /opt/lovechoice && cd /opt/lovechoice
git clone https://github.com/Yacult12/lovechoice.git .
node server/scripts/init-docker-env.js
docker compose up -d --build
```

## 验证

```bash
cd /opt/lovechoice

# 容器状态
docker compose ps

# 健康检查
curl http://127.0.0.1:8080/api/health

# 数据核对
docker compose exec mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT 'routes',COUNT(*) FROM routes
   UNION ALL SELECT 'chapters',COUNT(*) FROM chapters
   UNION ALL SELECT 'scene_nodes',COUNT(*) FROM scene_nodes
   UNION ALL SELECT 'choices',COUNT(*) FROM choices
   UNION ALL SELECT 'endings',COUNT(*) FROM endings;"
```

期望：`2 / 10 / 65 / 33 / 8`

## 日常维护

```bash
cd /opt/lovechoice

docker compose logs -f backend     # 跟后端日志
docker compose restart backend      # 重启后端
docker compose up -d --build        # 代码更新后重新部署
docker compose down                 # 停止（保留数据）
docker compose down -v              # 停止并删数据 ⚠️
```

## 更新代码

本地改完推送后，服务器上执行：

```bash
cd /opt/lovechoice
git pull
docker compose up -d --build backend
```

## 备份数据

```bash
cd /opt/lovechoice
docker compose exec mysql mysqldump -uroot -p123456 love > backup-$(date +%F).sql
```

## 纳新结束后

在阿里云控制台**关机**即可省下流量费（实例费通常也按停机时间减免，具体看套餐）。

彻底删除：控制台释放实例 + 删除 `/opt/lovechoice`。