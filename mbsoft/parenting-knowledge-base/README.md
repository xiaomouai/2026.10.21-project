# 🌙 好宝宝育儿知识库 · 会员系统

基于 Next.js 14 (App Router) + TypeScript 构建的 H5 育儿知识库会员系统，支持教程阅读、搜索、分类、每日打卡、积分体系、妈妈论坛互动，以及免费体验 + 会员购买。

## 功能清单

✅ **注册 / 登录**（Cookie Session，密码 bcrypt 加密，演示用内存存储）
✅ **教程知识库**：分类浏览、关键词搜索、免费/付费标识、Markdown 渲染
✅ **权限控制**：付费教程登录后可读（演示），真实场景按套餐校验
✅ **每日打卡**：连续打卡奖励、当月日历可视化、积分累计
✅ **积分体系**：注册赠送、打卡获得、发帖奖励、购买返积分
✅ **妈妈论坛**：教程内讨论 + 独立论坛、发帖、点赞
✅ **会员方案**：免费体验 / 月度 / 年度，模拟支付购买
✅ **H5 适配**：响应式布局，移动端优先

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev
# 访问 http://localhost:3000

# 生产构建 + 运行（产物是 output: "standalone"，next start 已不支持）
npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
KB_DATA_DIR=$PWD/data PORT=3100 node .next/standalone/server.js
# 访问 http://localhost:3100

# 或者用 Docker（推荐）：见下方「Docker 部署」
```

> **数据目录与初始化时机**：SQLite 默认落在 `<工作目录>/data/app.db`，可用环境变量 `KB_DATA_DIR` 覆盖。
> 连接是**惰性初始化**的 —— `import lib/store` 不会打开数据库，只有首次真正读写时才建表 / 跑迁移 / 灌种子。
> 所以 `next build` 全程不碰数据库文件：既不会把本地库打进产物，也避免了多个构建 worker 并发执行
> `pragma journal_mode = WAL`（切换 WAL 需要排它锁）互相抢锁报 `SqliteError: database is locked (SQLITE_BUSY)`。
> 另外 `lib/store.ts` 会**先**设 `busy_timeout` 再切 WAL，多进程同时冷启动时也不会直接抛错。

## 演示账号

- 手机号：`13800001234` / 密码：`123456`（新手妈妈小雅，含 120 积分）
- 手机号：`13800005678` / 密码：`123456`（好宝宝育儿师·林）
- 后台：`admin@test.com` / 环境变量 `ADMIN_PASSWORD` → `/admin/login`（首次创建管理员前设置）
- 也可以直接注册（仅需手机号 + 密码，注册即赠 50 积分）

## 技术栈

- **框架**：Next.js 14 (App Router) + React 18
- **语言**：TypeScript
- **样式**：纯 CSS（CSS Variables，无 UI 框架依赖）
- **认证**：Cookie + 自签名 Token（演示用，生产建议换 NextAuth.js）
- **数据存储**：SQLite（better-sqlite3，WAL 模式）+ 首次启动种子数据
- **Markdown**：自实现轻量解析器（无第三方依赖）

## 目录结构

```
parenting-knowledge-base/
├── app/                      # Next.js App Router
│   ├── api/                  # API 路由
│   │   ├── register/         # 注册
│   │   ├── login/            # 登录
│   │   ├── logout/           # 登出
│   │   ├── checkin/          # 每日打卡
│   │   ├── posts/            # 论坛发帖/列表
│   │   └── posts/[id]/like/  # 点赞
│   ├── topics/               # 教程列表 + 详情
│   ├── forum/                # 妈妈论坛
│   ├── checkin/              # 打卡页
│   ├── pricing/              # 会员方案
│   ├── layout.tsx            # 根布局（导航栏）
│   ├── page.tsx              # 首页
│   └── globals.css           # 全局样式
├── components/               # 客户端组件
│   ├── NavBar.tsx
│   ├── AuthModal.tsx
│   ├── CheckInButton.tsx
│   ├── ForumSection.tsx
│   └── PricingSection.tsx
└── lib/
    ├── types.ts              # 类型定义
    ├── store.ts              # 数据层 + 种子
    ├── seed.ts               # 种子数据（教程 + 帖子）
    ├── auth.ts               # 认证工具
    └── markdown.ts           # Markdown → HTML
```

## ⚠️ 生产化建议

本项目为**功能完整可运行的演示原型**，以下在生产前需替换：

1. **数据存储**：将 `lib/store.ts` 内存存储替换为数据库（推荐 Prisma + PostgreSQL）
2. **认证**：替换为 NextAuth.js（支持 OAuth/邮箱魔法链接），Session 加密密钥放环境变量
3. **支付**：在 `/api/purchase` 对接微信支付/支付宝（当前为模拟支付）
4. **密码哈希**：已用 bcryptjs，生产确保 `NODE_ENV=production`
5. **部署**：推荐 Vercel（前端）+ 独立数据库；或 Docker 部署

## 🚀 构建加速（国内服务器必读）

`docker compose up -d --build` 慢，通常是这几段里的某一段，**先定位再优化**：

```bash
# 分段计时，哪段慢一目了然（第一次最有参考价值）
time docker pull node:22-bookworm-slim          # ① 拉基础镜像
time docker compose build --no-cache --progress=plain   # ② 依赖安装 + ③ next build
```

| 阶段 | 常见耗时 | 是否真的慢 | 对策 |
|---|---|---|---|
| ① `docker pull node:22-bookworm-slim` | 数分钟～超时 | ✅ **通常是主因** | 见下方「拉取加速」 |
| ② `apt-get update`（旧版 Dockerfile） | 数十秒～超时 | ✅ 已优化掉 | 新版**默认不再安装编译工具链** |
| ③ `npm ci` | 数十秒 | ❌ 本来就走国内源 | 见下方说明，已加固 |
| ④ `next build` | ~20s | ❌ 正常 | 无法避免 |

### 拉取加速：三种做法，选一即可

**A. 先把基础镜像拉下来打回官方 tag（推荐，零侵入）** —— 项目文件一行都不用改，也不用改 Docker 守护进程配置：

```bash
# 任选一个源试，取最快的那个
M=docker.m.daocloud.io          # 或 docker.1ms.run / docker.xuanyuan.me / hub.rat.dev
time docker pull ${M}/library/node:22-bookworm-slim
docker tag ${M}/library/node:22-bookworm-slim node:22-bookworm-slim

# 之后照常构建，Docker 会直接复用本地镜像
docker compose up -d --build
```

**B. 给 Docker 守护进程配加速器**（长期有效，但要注意源会失效）：

```bash
# 按服务器所在云选：
#   腾讯云 CVM → https://mirror.ccs.tencentyun.com
#   阿里云 ECS → 容器镜像服务控制台里给你的专属地址 https://<id>.mirror.aliyuncs.com
#   华为云     → 按 SWR 控制台文档配置
sudo tee /etc/docker/daemon.json <<'EOF'
{ "registry-mirrors": ["https://mirror.ccs.tencentyun.com"] }
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
docker info | grep -A3 "Registry Mirrors"   # 确认生效
```

> ⚠️ 第三方公共加速器（含部分高校源）2024–2026 年间大量停服或限速，
> 上面只列了云厂商官方内网源。若要用第三方地址，请先用 `docker pull` 实测再写进配置，
> 并且**不要把失效源留在列表里**（Docker 会逐个重试，反而更慢）。

**C. 直接指定已拉好的镜像构建**：

```bash
docker compose build --build-arg BASE_IMAGE=${M}/library/node:22-bookworm-slim
docker compose up -d
```

### Dockerfile 已内置的加速（无需额外操作）

- **彻底跳过原生模块编译**：`better-sqlite3@13` 的 `.node` 二进制随 npm 包分发（`prebuilds/`，8 个平台都在包里），
  但它**没有 install 脚本** —— npm 看到 `binding.gyp` 会**自动**跑 `node-gyp rebuild`，
  于是要 python3 + make + g++，在国内机器上往往是几十秒甚至超时的元凶。
  对策是 `npm ci --ignore-scripts`：运行时 `lib/binding.js` **优先**加载 `prebuilds/<平台>.node`
  （找不到才回退 `build/`），功能不受影响；本项目 lockfile 里也没有任何包依赖 install 脚本。
  同理，`apt-get install python3 make g++` 这层已被 `ARG INSTALL_BUILD_TOOLS=false` 默认跳过，
  真需要源码编译时（非常规架构）设 `INSTALL_BUILD_TOOLS=true`，会自动装工具链并 `npm rebuild --build-from-source`。
- **npm 走国内 registry**：`package-lock.json` 里 70 个包的 `resolved` 已是 `registry.npmmirror.com`；
  Dockerfile 另加了 `--registry` + `--replace-registry-host=always` 作为保险（lockfile 若被改回 npmjs.org 也能自动重定向）。
- **镜像体积从 ~330MB 降到 ~110MB**：runner 阶段不再复制整份 `node_modules`（279MB）。
  实测 Next 的产物追踪已经能带出 `better-sqlite3` 及全平台二进制，只需保留它自身（约 17MB）作兜底。

### 境外服务器 / CI 构建

默认源是给国内网络配的，境外请用 `--build-arg` 覆盖回官方源：

```bash
docker compose build --no-cache \
  --build-arg BASE_IMAGE=node:22-bookworm-slim \
  --build-arg NPM_REGISTRY=https://registry.npmjs.org \
  --build-arg APT_MIRROR=http://deb.debian.org
```

| 可覆盖的参数 | 默认值 | 说明 |
|---|---|---|
| `BASE_IMAGE` | `node:22-bookworm-slim` | 基础镜像，可换成国内 registry 的同款镜像 |
| `NPM_REGISTRY` | `https://registry.npmmirror.com` | npm 源 |
| `APT_MIRROR` | `https://mirrors.tencent.com` | Debian 源，仅在 `INSTALL_BUILD_TOOLS=true` 时生效 |
| `INSTALL_BUILD_TOOLS` | `false` | 是否安装 python3/make/g++（默认不需要） |

## 🐳 Docker 部署

已内置 `Dockerfile`（三阶段构建）与 `docker-compose.yml`，一键启动：

```bash
# 构建并后台启动（首次会自动建库并写入种子数据）
docker compose up -d --build

# 查看状态 / 日志
docker compose ps
docker compose logs -f app

# 停止 / 停止并删除容器（数据卷保留）
docker compose stop
docker compose down

# 停止并**清空数据**（慎用，会员/教程/授权卡会全丢）
docker compose down -v
```

启动后访问 <http://localhost:3100>。后台 <http://localhost:3100/admin>（管理员初始密码取自 `ADMIN_PASSWORD`）。

**关键设计**

| 项 | 说明 |
|---|---|
| 基础镜像 | `node:22-bookworm-slim`（Debian/glibc）。**不用 Alpine**：better-sqlite3 的预编译包只有 glibc 版，musl 需源码编译、慢且易失败 |
| 产物 | Next.js `output: "standalone"`，runner 只含 server.js + 最小依赖 |
| 数据持久化 | named volume `kb-data` 挂载到 `/app/data`（SQLite 文件在此，删容器不丢数据） |
| 时区 | `TZ=Asia/Shanghai`。打卡按本地日界判定，UTC 会导致跨天偏移 8 小时 |
| 首次启动 | 数据卷为空时自动建库 + 写入种子（6 篇教程、演示账号、管理员） |
| 健康检查 | 每 30s 请求首页，`docker compose ps` 看 `healthy` |

**迁移本地已有数据**（把开发库的会员/授权卡带过去）：

```bash
docker compose stop
docker cp data/app.db parenting-kb:/app/data/app.db
docker compose start
```

（若本地库处于 WAL 模式，建议先 `sqlite3 data/app.db "VACUUM;"` 或连带复制 `-wal` 文件。）

### 🤖 配置 AI 助手（右下角聊天入口）

聊天入口有两道开关，**都必须满足**才会显示：

1. 用户**已登录**（未登录不渲染悬浮球）
2. 后台 `/admin/settings` → 打开「启用大模型」**且**已填 API Key（`enabled && apiKey` 同时为真）

密钥有两处可填，**优先级：后台配置 > 环境变量 > 默认值**：

```bash
# 方式 A：后台手填（存进 SQLite，跟随数据卷迁移）
#   /admin/settings 里选供应商 → 填 API Key → 开「启用」→ 用页面上的「测试连接」验证

# 方式 B：环境变量注入（推荐用于服务器部署，密钥不落库）
cp .env.example .env
# 编辑 .env：LLM_API_KEY=sk-xxxx   LLM_ENABLED=1
docker compose up -d --build
```

| 环境变量 | 说明 |
|---|---|
| `LLM_API_KEY` | 必填（也接受 `DASHSCOPE_API_KEY`）。仅在后台未填密钥时生效 |
| `LLM_BASE_URL` | 可选，OpenAI 兼容地址；留空用后台值或内置 DashScope 兼容模式 |
| `LLM_MODEL` | 可选，默认 `qwen-plus` |
| `LLM_ENABLED` | 设为 `1` / `true` 表示启用。**后台若显式关闭开关，此项不生效** |

> `.env` 已被 `.gitignore` 排除，不要直接改 `.env.example` 里的真实密钥。

## 🌐 域名访问 baby.mingboai.com

**1. DNS**：A 记录 `baby.mingboai.com → 服务器公网 IP`（已生效的话可跳过）。

```bash
dig +short baby.mingboai.com      # 应返回你的服务器公网 IP
```

> ⚠️ 访问不了时先跑 `bash deploy/diagnose.sh`，它会逐层定位到具体那一层。

---

### 先判断：80 端口有没有被占？

```bash
ss -tlnp | grep ':80 '
```

| 结果 | 走哪条路 |
|---|---|
| **有输出**（nginx / httpd / 宝塔） | 路径 C（Web 服务器反代）—— **容器绝不能占 80**，否则 `bind: address already in use` |
| 无输出（裸机） | 路径 A |

---

### 路径 A：裸机，容器直接占 80（最快，HTTP）

打开 `docker-compose.yml` 里 `# - "${KB_HTTP_PORT:-80}:3100"` 的注释，然后：

```bash
docker compose up -d --build
curl -I http://baby.mingboai.com    # 应 200
```

| 宿主机端口 | 用途 |
|---|---|
| 80 | 域名 HTTP 直连（浏览器默认端口） |
| 3100 | 应用原端口，直连调试 |

⚠️ **443 不要映射给容器**：容器内是纯 HTTP 服务，映射 443 会让 `https://` 握手直接失败。
HTTPS 必须由 Nginx 终结 TLS 后再反代 —— 即路径 B / C。

---

### 路径 B：Nginx 反代（正式，支持 HTTPS）

Nginx 要监听 80/443，所以**必须先让容器让出 80**：

```bash
# 1) 注释掉 docker-compose.yml 里的 "${KB_HTTP_PORT:-80}:3100" 这一行
#    （或 echo 'KB_HTTP_PORT=127.0.0.1:8080' >> .env）
docker compose up -d

# 2) 装 Nginx 与 certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# 3) 加载站点配置
sudo cp deploy/nginx/baby.mingboai.com.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
curl -I http://baby.mingboai.com          # 应 200

# 4) 签发证书（certbot 会自动写入 443 配置与 301 跳转）
sudo certbot --nginx -d baby.mingboai.com
```

完成后访问 <https://baby.mingboai.com>。后续可把 3100 也收紧为只听回环：
`echo 'KB_HOST_PORT=127.0.0.1:3100' >> .env && docker compose up -d`。

---

### 路径 C：宝塔面板（80 已被占用，最常见）

宝塔的 Nginx 已经占了 80/443，容器抢不过，也没必要抢 —— 让出 80，用反代。

```bash
# 0) 确认是谁占了 80
ss -tlnp | grep ':80 '

# 1) 容器只保留 3100（compose 默认已把 80 那行注释掉）
docker compose up -d

# 2) 宝塔面板 → 网站 → 站点设置 → 反向代理 → 添加反向代理
#      代理名称：kb        目标 URL：http://127.0.0.1:3100

# 3) ⚠️ 面板自动生成的配置【不支持 SSE】，进「配置文件」在 location / 内补三行：
#       proxy_buffering off;
#       proxy_request_buffering off;
#       add_header X-Accel-Buffering no;

# 4) SSL：面板 → SSL → Let's Encrypt → 申请，勾选强制 HTTPS
#    （生成的 443 块同样缺上面三行，记得补）
```

完整可直接替换的配置见 `deploy/nginx/bt-panel-reverse-proxy.conf`。

> ⚠️ **域名拼写坑**：DNS 用的是 `baby.mingboai.com`，而服务器目录常见建成 `bady.mingboai.com`（少个 b）。
> 两者不一致时，请求会落到宝塔的默认站点（表现为"能 ping 通但页面不对"）。
> `server_name` 建议两个拼写都写上，或先在面板里核对站点域名。

**Nginx 配置里的三个关键点**（漏了会出各种怪问题）：

| 配置 | 不配的后果 |
|---|---|
| `proxy_buffering off` + `X-Accel-Buffering no` | SSE 流式输出被缓冲，AI 助手的回答会攒到最后一次性吐出，失去逐字效果 |
| `client_max_body_size 20m` | 后台导入知识库 MD（multipart）超过 1m 直接 413 |
| `X-Forwarded-Proto $scheme` | 邀请链接/二维码按 req 的 proto 生成，缺失会退回 http，微信里打开可能被拦截 |

> 若 Nginx 也跑在 Docker 里，把 `127.0.0.1:3100` 换成容器名（如 `http://app:3100`），并把两者放进同一个 compose 网络即可。

## 🧯 常见问题

**容器日志 `✓ Ready in 52ms`、服务明明启动了，但浏览器访问不了**

先跑一键诊断，它会从上到下逐层打通并直接告诉你断在哪：

```bash
bash deploy/diagnose.sh
```

不用脚本的话，按这四层手动查（**越靠前越常见**）：

| 层 | 查什么 | 怎么修 |
|---|---|---|
| ① 端口绑定 | `docker port parenting-kb` 显示 `127.0.0.1:3100` | 只听回环，外网必然超时。改 `KB_HOST_PORT=3100` 后 `docker compose up -d` |
| ② 云安全组 | 控制台未放行 3100（走 Nginx 则放行 80/443） | 云厂商控制台 → 安全组 → 添加入站规则 |
| ③ 系统防火墙 | `ufw status` 为 active 且未放行 | `sudo ufw allow 3100/tcp`（或 `allow 'Nginx Full'`） |
| ④ Nginx | 域名能解析但打不开 | `sudo nginx -t` 看配置是否加载、是否已 reload |

判据很直接：**若 `curl http://127.0.0.1:3100` 通、而 `curl http://<网卡IP>:3100` 不通**，
那就是①；两层都通却外网打不开，就是②或③。

**`docker compose up --build` 报 `SqliteError: database is locked (SQLITE_BUSY)` — exit code 1**

报错位置通常在 `Collecting page data ...` 这一步（末尾提示 `Failed to collect page data for /api/xxx`）。
原因：`next build` 会 fork 多个 worker 并行加载路由/页面模块，若某个模块在 **import 阶段**就打开
SQLite 并执行 `pragma journal_mode = WAL`，多进程会同时抢排它锁 → 构建中断。

已修复（2026-09）：

1. `lib/store.ts` 改为**惰性初始化**（`initDb()` 只在首次真正读写时执行建表/迁移/种子），import 无任何副作用；
2. 先设 `busy_timeout` 再切 WAL，且 WAL 切换失败可降级而不中断；
3. 所有依赖会话/数据库的页面与 Route Handler 都声明了 `export const dynamic = "force-dynamic"`，构建期不做静态预渲染；
4. Dockerfile 构建阶段用 `KB_DATA_DIR=/tmp/kb-build-data`，构建期也不会碰 `/app/data`。

如果后续新增模块又踩到这个坑，自查两点：**该模块顶层有没有直接 `new Database(...)`**；
以及**是否有页面/路由漏了 `dynamic = "force-dynamic"`**。

**构建报 `gyp ERR! find Python` / `node-gyp rebuild` 失败（deps 阶段）**

```
npm error path /app/node_modules/better-sqlite3
npm error command sh -c node-gyp rebuild
gyp ERR! stack Error: Could not find any Python installation to use
```

原因：**不是**预编译包缺失，而是 `better-sqlite3@13` 没有 install 脚本，
npm 检测到 `binding.gyp` 后会**自动**执行 `node-gyp rebuild`，而 slim 镜像里没有 python3 / make / g++。

已修复（2026-09）：deps 阶段改用 `npm ci --ignore-scripts` 跳过编译。
运行时 `better-sqlite3/lib/binding.js` 会**优先**加载包内的 `prebuilds/<platform>-<arch>.node`，
只有在找不到预编译二进制时才会回退到 `build/` 目录，因此功能完全不受影响。

若你的环境确实需要源码构建（如非常规 CPU 架构）：

```bash
docker compose build --no-cache --build-arg INSTALL_BUILD_TOOLS=true
# 该开关会自动装 python3/make/g++，并在 npm ci 之后执行
# npm rebuild better-sqlite3 --build-from-source
```

## 医疗声明

内容为健康教育参考，**不替代儿科医生评估**。出现异常（发热、呕吐、呼吸异常、体重不增等）请及时就医。
