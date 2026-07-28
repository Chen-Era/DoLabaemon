# 服务器部署指南

本文档面向把项目部署到你自己的服务器，并通过 `dorlabaemon.era.ac.cn` 对外提供访问。

## 推荐方案

- 应用：`Next.js` 容器
- 数据库：`PostgreSQL` 容器
- 反向代理：优先 `Caddy`（自动 HTTPS），也可用 `Nginx`
- 域名：将 `dorlabaemon.era.ac.cn` 解析到你的服务器公网 IP

## 上线前提

服务器建议满足以下条件：

- Linux x86_64
- 2 核 CPU / 4 GB 内存起步
- 已开放 `80` 和 `443` 端口
- 已安装 Docker 与 Docker Compose

## 1. 配置 DNS

在你的域名服务商后台添加一条记录：

- 类型：`A`
- 主机记录：`dorlabaemon`
- 值：你的服务器公网 IP

如果你用的是 IPv6，也可额外添加：

- 类型：`AAAA`
- 主机记录：`dorlabaemon`
- 值：你的服务器 IPv6 地址

## 2. 上传项目到服务器

建议目录：

```bash
/opt/dorlabaemon
```

把仓库上传到服务器后进入项目目录：

```bash
cd /opt/dorlabaemon
```

## 3. 准备环境变量

复制样例文件：

```bash
cp .env.example .env
```

至少修改以下值：

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_VISION_MODEL`（按你的模型提供方填写）
- `LAB_LLM_CONFIG_ENCRYPTION_KEY`（实验室公用模型密钥的加密主密钥）

关键要求：

- `NEXTAUTH_URL` 必须是 `https://dorlabaemon.era.ac.cn`
- `DATABASE_URL` 在 Docker Compose 内应继续使用主机名 `postgres`
- `DEMO_MODE` 生产环境应保持为 `false`

如果服务器访问 Docker Hub 很慢或超时，可额外设置：

- `DOCKER_REGISTRY_PREFIX="docker.m.daocloud.io/library/"`
- `NPM_REGISTRY="https://registry.npmmirror.com"`

你可以用下面命令生成一个随机认证密钥：

```bash
openssl rand -base64 32
```

请为 `NEXTAUTH_SECRET` 和 `LAB_LLM_CONFIG_ENCRYPTION_KEY` 分别生成不同的随机值。后者只留在服务器 `.env` 中：应用会用它以 AES-256-GCM 加密实验室公用模型的 API Key，数据库和浏览器均不会获得明文。已有部署升级后必须先配置该变量，再由 PI/管理员在“模型与联网配置”页保存实验室公用模型。

## 4. 启动数据库和应用

先构建并启动：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

首次上线时，执行数据库迁移：

```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

再执行初始化种子：

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

同步实验技术知识库（335 项技术与证据来源；镜像已包含 `scripts/`）：

```bash
docker compose -f docker-compose.prod.yml exec app npm run knowledge:validate -- --strict
docker compose -f docker-compose.prod.yml exec app npm run knowledge:sync
```

`knowledge:validate --strict` 必须零错误零警告；`knowledge:sync` 输出中
`formalCount` 应等于技术总数、`warningCount` 应为 0。若存在带策展警告的条目，
同步默认以退出码 1 拦截（不会把非正式内容标记为正式发布）；确认后可加
`--allow-warnings` 降级执行。

每次拉取新代码重建镜像后，迁移与知识同步都需要按上面顺序重跑一次。

查看运行状态：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

如果一切正常，应用会先监听在服务器的 `3000` 端口。

## 5. 配置反向代理和 HTTPS

### 方案 A：Caddy（推荐）

适合想快速上线并自动申请 HTTPS 证书的场景。

安装 Caddy 后，站点配置可写为：

```caddyfile
dorlabaemon.era.ac.cn {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3000
}
```

保存后重载：

```bash
sudo systemctl reload caddy
```

### 方案 B：Nginx

适合你服务器上已经统一使用 Nginx 的场景。

示例配置：

```nginx
server {
    listen 80;
    server_name dorlabaemon.era.ac.cn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
```

若使用 Nginx，请再配合 `certbot` 或你现有的证书体系启用 HTTPS。

## 6. 升级流程

以后更新版本时，执行：

```bash
cd /opt/dorlabaemon
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

如果规则目录或种子数据有更新，再补执行：

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

## 常见问题

### 页面能打开，但登录异常

优先检查：

- `NEXTAUTH_URL` 是否为公网 HTTPS 地址
- `NEXTAUTH_SECRET` 是否已设置
- 反向代理是否透传了 `Host` 与 `X-Forwarded-Proto`

### 接口报数据库错误

优先检查：

- `postgres` 容器是否正常运行
- `DATABASE_URL` 的用户名、密码、数据库名是否与 `POSTGRES_*` 一致
- 是否已执行 `prisma migrate deploy`

### 试剂解析或图片识别失败

优先检查：

- `OPENAI_API_KEY` 是否可用
- `OPENAI_BASE_URL`、模型名是否与供应商兼容
- 服务器能否访问对应模型接口
