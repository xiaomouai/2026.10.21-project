# UniCRM · Docker / docker-compose 部署指南

> 适用：将 UniCRM（Next.js 16 + Prisma + PostgreSQL）以容器方式自托管部署。
> 配套文件：`Dockerfile`、`docker-compose.yml`、`.dockerignore`、`.env.docker.example`、`Caddyfile`、`docker-entrypoint.sh`、`docker-wait.js`、`.npmrc`。
> 全部依赖安装与二进制下载**默认走国内镜像**，无需翻墙即可构建。

---

## 1. 架构概览

```
                    ┌─────────────────────────────────────┐
   浏览器 ─────────▶ │  web 容器 (ucrm-web)                │
   :81             │   Next.js 16 (standalone 输出)       │
                    │   Prisma Client → @prisma/adapter-pg │
                    └───────────────┬─────────────────────┘
                                    │ postgresql://db:5432/ucrm
                    ┌───────────────▼─────────────────────┐
                    │  db 容器 (ucrm-db)                   │
                    │   PostgreSQL 16 (数据卷 pgdata)       │
                    └─────────────────────────────────────┘

  可选：caddy 容器 (ucrm-caddy) 在最前做 80/443 自动 HTTPS 反代
```

- **web**：构建期用 `schema.postgres.prisma` 生成 PG 版 Prisma Client；运行期按 `DATABASE_URL` 自动选 `@prisma/adapter-pg`。
- **db**：官方 `postgres:16-alpine`，数据持久化到命名卷 `pgdata`，带 `pg_isready` 健康检查。
- **启动顺序**：compose 的 `depends_on: service_healthy` 保证 PG 健康后 web 才启动；web 入口脚本再次显式等待并 `prisma db push` 同步表结构，因此**首次启动即可用，无需手工迁移**。

---

## 2. 前置条件

- Docker Engine ≥ 24 与 Docker Compose v2（`docker compose` 子命令）。
- 一台能访问 Docker Hub（或国内镜像源）的 Linux 服务器，建议 ≥ 2 vCPU / 4 GB 内存。
- 已克隆本仓库：`unified-crm/`（含 `apps/web`、`packages/db`）。

---

## 3. 国内镜像配置（加速安装）

依赖包默认走 npmmirror；基础镜像可在 `.env.docker` 中切换，不需要修改 Dockerfile。

```dotenv
# 腾讯云公共镜像
NODE_IMAGE=mirror.ccs.tencentyun.com/library/node:22-bookworm-slim
POSTGRES_IMAGE=mirror.ccs.tencentyun.com/library/postgres:16-alpine
NPM_REGISTRY=https://registry.npmmirror.com/
```

阿里云镜像加速地址与账号绑定，请在阿里云容器镜像服务控制台取得专属地址后，按相同方式设置 `NODE_IMAGE` 和 `POSTGRES_IMAGE`。

### 3.1 容器镜像拉取加速（Docker daemon）

`node:22-bookworm-slim`、`postgres:16-alpine` 等来自 Docker Hub，国内拉取慢时可给 Docker daemon 配置镜像加速器。编辑 `/etc/docker/daemon.json`（不存在则新建）：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

> 阿里云用户建议用专属加速器：`https://<你的ID>.mirror.aliyuncs.com`（容器镜像服务 → 镜像加速器获取）。
> 修改后重载：`sudo systemctl daemon-reload && sudo systemctl restart docker`。

也可直接把 `Dockerfile` 的基础镜像换成阿里云仓库（已留注释）：

```dockerfile
FROM registry.cn-hangzhou.aliyuncs.com/library/node:22-bookworm-slim
```

### 3.2 npm / pnpm 包源（已内置 `.npmrc`）

仓库根 `.npmrc` 已设：

```
registry=https://registry.npmmirror.com/
@prisma/engines_binary_base_url=https://registry.npmmirror.com/-/binary/prisma
better-sqlite3_binary_host=https://registry.npmmirror.com/-/binary/better-sqlite3
```

Dockerfile 内又兜底设了 `npm_config_registry` 与 `COREPACK_NPM_REGISTRY=https://registry.npmmirror.com/`，确保 corepack 下载 pnpm、pnpm 安装依赖都走淘宝镜像。

### 3.3 Prisma 引擎 & better-sqlite3 预编译二进制（已在 Dockerfile 设环境变量）

```
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV BETTER_SQLITE3_BINARY_HOST=https://registry.npmmirror.com/-/binary/better-sqlite3
```

> 说明：生产运行走 PostgreSQL，并不真正加载 `better-sqlite3` 原生模块；该镜像仅用于「本地 SQLite 开发」分支的兼容，构建期一并下载以防报错。

### 3.4 切换回官方源

删除 `.npmrc` 中的镜像行、移除 Dockerfile 内的 `npm_config_registry` / `PRISMA_ENGINES_MIRROR` / `BETTER_SQLITE3_BINARY_HOST` 即可。

---

## 4. 文件清单

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 多阶段 pnpm 构建（deps → builder → runner），国内镜像全开 |
| `docker-compose.yml` | web + db 编排，含可选 caddy 反代 |
| `.dockerignore` | 排除 node_modules / .next / .env / 本地 db 等 |
| `.npmrc` | 国内 npm / Prisma / better-sqlite3 镜像（已提交） |
| `.env.docker.example` | 运行环境变量模板 |
| `docker-entrypoint.sh` | 容器入口：等 PG → `prisma db push` → `next start` |
| `docker-wait.js` | 用 `pg` 探测 PG 就绪 |
| `Caddyfile` | 可选自动 HTTPS 反代配置 |
| `packages/db/prisma/schema.postgres.prisma` | 生产 PG schema（构建期生成 client 用） |

---

## 5. 快速开始

```bash
# 1) 进入仓库根
cd unified-crm

# 2) 准备环境变量（务必修改 POSTGRES_PASSWORD 与 LLM Key）
cp .env.docker.example .env.docker
vim .env.docker

# 3) 构建并后台启动（首次会构建镜像，约几分钟）
docker compose --env-file .env.docker up -d --build

# 4) 查看日志
docker compose --env-file .env.docker logs -f app

# 5) 访问
#   直接暴露： http://<服务器IP>:${WEB_PORT}
#   走 caddy：  https://你的域名
```

> **`.env.docker` 里有两处必须成对改**：`WEB_PORT`（宿主映射端口）与 `BETTER_AUTH_URL`
> （对外地址，含端口）。两者端口不一致时，登录成功也会被 better-auth 跳到错误端口。
> 例：`WEB_PORT=81` ⇄ `BETTER_AUTH_URL=http://crm.example.com:81`。

> **`--env-file` 与 `env_file` 是两件事**（踩过坑）：
> CLI 的 `--env-file .env.docker` 只负责 compose 文件里的 `${VAR}` 插值；
> 容器真正拿到变量靠 `docker-compose.yml` 里的 `env_file:` 段。两者都已在仓库配好。

启动后 web 容器会：
1. `docker-wait.js` 等 PG 可连；
2. `prisma db push --schema packages/db/prisma/schema.postgres.prisma` 按 PG schema 同步表结构（幂等，重复启动安全）；
3. `next start` 监听 81。

> 首次 `db push` 若库为空会自动建全部表；后续改模型重启容器即同步结构。
> **入口脚本默认不加 `--accept-data-loss`**：遇到需要删列 / 收窄类型的破坏性变更时，
> `db push` 会失败并让容器停在启动阶段（宁可停服，也不静默丢数据）。
> 确认无损后再人工执行带 `--accept-data-loss` 的命令（入口报错信息里已给出）。

---

## 6. 首次使用与初始化数据

1. **注册账号**：打开页面 → 注册 → 自动进入 onboarding 创建组织。
2. **演示数据（可选）**：登录后到「销售总览」页点 **✨ 载入演示数据**，按组织灌入公司 / 联系人 / 商机 / 多 Agent 编码任务日志等样例（见 `apps/web/lib/actions/demo.ts`）。
3. **CLI 校验（可选）**：
   ```bash
   docker compose run --rm web pnpm --filter @ucrm/db db:seed
   ```
   `seed.ts` 仅做计数校验并提示去 UI 载入演示数据，不插入业务数据。

---

## 7. 环境变量说明（写入 `.env.docker`）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | 是 | PG 账号 / 库；改强密码 |
| `DATABASE_URL` | 是 | web 连接串（compose 内主机名用 `db`） |
| `UCRM_LLM_PROVIDER` | 否 | `qwen` / `deepseek` / `openai` / `custom` |
| `DASHSCOPE_API_KEY` | 视 provider | 通义千问（provider=qwen） |
| `DEEPSEEK_API_KEY` | 视 provider | DeepSeek（provider=deepseek） |
| `OPENAI_API_KEY` | 视 provider | OpenAI（provider=openai） |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | custom 用 | 自定义兼容端点 |
| `UCRM_API_KEYS` | 生产建议 | REST 鉴权，格式 `slug1=key1,slug2=key2` |
| `E2B_API_KEY` | 否 | 浏览器沙箱（默认禁用） |
| `WEB_PORT` | 否 | 宿主映射端口，默认 81 |

> 模型通道完全由环境变量决定，改完 `docker compose up -d` 重启即生效，无需改代码。详见仓库根 `.env.example`。

---

## 8. 反向代理（可选，自动 HTTPS）

取消 `docker-compose.yml` 中 `caddy` 段落注释，并把 `Caddyfile` 放到仓库根（已提供），把域名 `crm.example.com` 改掉并解析到服务器：

```bash
docker compose up -d
```

Caddy 会自动申请 / 续期 Let's Encrypt 证书，将 80/443 反代到 `web:81`。

---

## 9. 数据备份与升级

**备份数据库**（按时冷备）：

```bash
docker compose exec -T db pg_dump -U ucrm ucrm > ucrm-$(date +%F).sql
# 恢复： docker compose exec -T db psql -U ucrm ucrm < ucrm-YYYY-MM-DD.sql
```

**升级版本**（在服务器上，仓库根目录执行）：

```bash
# 0) 先备份，出问题可整库回滚
docker compose --env-file .env.docker exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > ucrm-$(date +%F-%H%M).sql

# 1) 拉代码（或 rsync / scp 覆盖源码）
git pull          # 若服务器上是独立 clone
# rsync -a --delete --exclude node_modules --exclude .next ./ user@server:/opt/unified-crm/

# 2) 重新构建并滚动替换 app（db 不动，数据卷保留）
docker compose --env-file .env.docker up -d --build --force-recreate app

# 3) 盯日志：确认三行都出现
docker compose --env-file .env.docker logs -f app
#   ⏳ 等待 PostgreSQL 就绪
#   📦 同步 PostgreSQL 数据库结构（prisma db push，幂等）
#   🚀 启动 Next.js Application

# 4) 健康检查
docker compose --env-file .env.docker ps     # app 状态应为 healthy
curl -fsS http://127.0.0.1:${WEB_PORT}/login -o /dev/null && echo OK
```

数据卷 `postgres_data` 不受重建影响，升级不会丢数据。
**回滚**：`git checkout <上一个版本>` 后重新 `up -d --build`；代码回滚不会删表，
但已新增的列/表仍留在库里（Prisma 忽略多余对象，不影响运行）。真要回退结构就 `psql < 备份.sql`。

### 9.1 2026-09-15 这次更新会动到什么

入口脚本的 `prisma db push` 会对生产 PG 做**两处增量**（均为新增，不删不改）：

| 对象 | 变更 | 风险 |
| --- | --- | --- |
| 新表 `SalesOkr` | OKR 目标表（此前只在 SQLite schema 里，生产库压根没有 → OKR 页必崩） | 无 |
| `Activity.plannedAt` 列 | 新增可空时间戳（计划执行时间，与 `dueAt` 截止时间分列） | 无 |

前置校验（本地已跑通，服务器上构建会再跑一遍）：

```bash
pnpm verify:crm        # 25 项，第一项就是"两个 schema 的 model 集合必须一致"
```

> 若生产库此前因 `SalesOkr` 缺失导致 OKR 页报错，本次 `db push` 建表后即恢复，无需手工补数据。

---

## 10. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| 构建卡在 `pnpm install` / 引擎下载慢 | 确认 `.npmrc` 与 Dockerfile 的镜像变量生效；检查服务器能否访问 `registry.npmmirror.com` |
| 启动报 `Driver Adapter ... not compatible with provider postgres` | 构建期未用 PG schema 生成 client。确认 `Dockerfile` 的 `prisma generate --schema packages/db/prisma/schema.postgres.prisma` 步骤成功；运行时 `DATABASE_URL` 必须以 `postgresql://` 开头 |
| `prisma db push` 报连接拒绝 | db 未就绪或 `DATABASE_URL` 主机名错（compose 内应为 `db` 而非 `localhost`） |
| 页面 500 / 读不到数据 | `DATABASE_URL` 指向了 SQLite 或错误库；确认 web 容器 env 中 `DATABASE_URL` 为 `postgresql://...@db:5432/ucrm` |
| 想用迁移历史而非 `db push` | 改用 `docker compose run --rm web pnpm --filter @ucrm/db exec prisma migrate deploy --schema packages/db/prisma/schema.postgres.prisma`（需先在 PG 上生成迁移目录） |
| `docker compose` 报 "unexpected character" / 变量解析失败 | `.env.docker` 里混进了 shell 命令。该文件只允许 `KEY=value` 和 `#` 注释，命令请放终端或注释里 |
| 页面能用但 AI 功能全哑（问不出东西、无摘要） | compose 缺 `env_file`：`--env-file` 只做插值，容器拿不到 `DASHSCOPE_API_KEY` 等变量。进容器 `docker compose exec app env \| grep -i api` 确认 |
| 登录后跳到错误端口 / 登录态丢失 | `WEB_PORT` 与 `BETTER_AUTH_URL` 端口不一致，改成同一个 |
| 容器一直 restart，`db push` 失败 | 入口脚本按"宁可停服也不丢数据"设计：看 `docker compose logs app` 的具体报错，先备份再决定要不要 `--accept-data-loss` |

---

## 11. 备注

- **SQLite vs PostgreSQL**：本地开发仍可用 SQLite（`DATABASE_URL` 缺省即走 `better-sqlite3`）；生产 / Docker 一律 PostgreSQL，二者共享同一套模型，切换仅靠 `DATABASE_URL` 与对应 schema，不写双份代码。运行时 adapter 选择在 `packages/db/src/index.ts` 按 `DATABASE_URL` 前缀自动分支。
- **单进程单库**：当前编排为单租户自托管形态；多租户 SaaS 需额外接入组织隔离与横向扩展，不在本部署范围。
- **密钥管理**：`.env.docker` 已被 `.gitignore` 忽略，请勿提交；生产建议用 Docker secrets / 运维平台的密钥注入替换明文 env_file。
