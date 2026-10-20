# 打水计算器 · Docker 部署文档

基于 Next.js 14（standalone 输出）+ SQLite + Docker Compose 的一键部署说明。

---

## 1. 前置条件

| 软件 | 版本要求 | 说明 |
| --- | --- | --- |
| Docker | ≥ 20.10 | 支持 BuildKit |
| Docker Compose | ≥ v2（`docker compose`）**或** v1（`docker-compose`） | 两者均可，`deploy.sh` 会自动选择 |
| 可用内存 | ≥ 1GB | Next.js 构建阶段较耗内存，建议 2GB 以上 |

检查版本：

```bash
docker --version
docker compose version      # v2 插件（推荐，deploy.sh 优先用这个）
docker-compose --version    # 若上面报 command not found，看这一条
docker info                 # 关键：CLI 有版本 ≠ daemon 在跑
```

> **常见坑 ①：报 `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`**
> 说明 CLI 装了而守护进程没起。**先别急着重启，看真实报错**——
> `docker-compose up` / `docker compose up` 报这个错，九成不是 compose 的问题：
>
> ```bash
> sudo journalctl -u docker -n 30 --no-pager   # 只看 docker 服务的启动日志
> ```
>
> 按日志对症下药（下面两条是 Ubuntu 上最高频的两种）：
>
> | 日志关键词 | 原因 | 修法 |
> | --- | --- | --- |
> | `iptables ... nft ...` / `Failed to initialize nftables` | 系统 iptables 与 Docker 的 nftables 后端冲突（常见于装过宝塔/手动改过防火墙） | `sudo iptables -F && sudo systemctl restart docker`；仍不行则 `sudo update-alternatives --set iptables /usr/sbin/iptables-legacy` 再重启 |
> | `permission denied while trying to connect to the Docker daemon socket` | 当前用户不在 docker 组 | `sudo usermod -aG docker $USER && newgrp docker`（需重新登录 shell） |
>
> 普通启动（日志无明显报错时）：
>
> ```bash
> sudo systemctl enable --now docker
> sudo systemctl status docker --no-pager    # 看 active (running)
> docker info                                # 这一条才是真正的判据
> ```
>
> macOS：`open -a Docker`（OrbStack 用 `orb start`，Colima 用 `colima start`）。
>
> `./deploy.sh` 会在构建前自检，自检失败会打印上面这几行 + 你当前平台的启动命令后直接退出，不会带着半死不活的 daemon 开始构建。
>
> 嫌手动一条条敲麻烦，直接跑 `docker-fix.sh`（root），它会自动分流：
>
> - **守护进程没起** → 把 `dockerd` 拉到前台跑 12 秒抓**真实报错**，据此切 iptables 后端 / 装 iptables / unmask + 拉起 containerd 与 docker，最后用 `docker info` 判定。
> - **守护进程在跑但 CLI 连不上**（`systemctl status` 显示 `active (running)`，`docker info` 却报
>   `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`）→ 走 socket 层分支：采集 socket 文件 / `DOCKER_HOST` / `docker context` / dockerd 命令行 / CLI 是否 snap 版，然后**关掉 socket 激活**（`docker.socket` 与 `docker.service` 并存易出问题）并重启服务重建 socket。
>
> 两条路径失败都会把 `journalctl -u docker` 原文打出来，直接贴回即可定位。
>
> ### 守护进程在跑但 `docker info` 连不上 —— 单独排查
>
> 症状：
>
> ```text
> $ systemctl status docker --no-pager | head -4
> Active: active (running) since ...;  16min ago
> TriggeredBy: ● docker.socket
>
> $ docker info
> Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
> ```
>
> 这说明 **dockerd 进程活着（PID 在跑），但 CLI 找不到/够不着它监听的 socket**，跟 iptables 无关。
>
> **判据：如果 `journalctl -u docker` 里出现了下面这两句，daemon 就是完全正常的，别再翻日志、更别去动 iptables：**
>
> ```text
> dockerd[14593]: API listen on /var/run/docker.sock
> systemd[1]: Started docker.service - Docker Application Container Engine.
> ```
>
> `TriggeredBy: ● docker.socket` 表示这台机器走的是 **socket 激活**：`/run/docker.sock` 由 `docker.socket` 单元持有，`dockerd` 是被它触发拉起的。这类环境下 socket 文件被清掉后不会自动补回来，才会出现「进程在、连不上」。直接照这句做，比任何日志都快：
>
> ```bash
> systemctl restart docker.socket docker.service && sleep 6
> ls -l /run/docker.sock && docker info 2>&1 | tail -3
> ```
>
> 想彻底绕开 socket 激活的坑（推荐，开机仍会自动起）：
>
> ```bash
> systemctl disable docker.socket && systemctl enable docker && systemctl restart docker && sleep 6
> docker info
> ```
>
> 先采事实（命令跑完贴结果即可定位）：
>
> ```bash
> ls -l /var/run/docker.sock /run/docker.sock 2>&1
> pgrep -a dockerd
> echo "DOCKER_HOST=[$DOCKER_HOST]"
> docker context show
> ```
>
> 对应修法：
>
> | 采到的结果 | 原因 | 修法 |
> | --- | --- | --- |
> | 两个 socket 都是 `No such file` | socket 文件被清掉（tmpfs 清理 / 面板运维操作 / `/run` 被删） | `systemctl disable docker.socket && systemctl restart docker && sleep 5`，服务重启会自动重建 |
> | socket 在 `/run/user/0/docker.sock` 或 `~/.docker/run/` | rootless / 自定义路径 | 确认 `dockerd` 命令行带 `-H`，或对齐 `docker context` |
> | `permission denied while trying to connect to the Docker daemon socket` | socket 属主/权限不对 | `chown root:docker /run/docker.sock && chmod 660 /run/docker.sock`，并把 `root` 加进 docker 组 |
> | `DOCKER_HOST` 被设成别的值 | 环境变量把 CLI 指到非默认地址 | `unset DOCKER_HOST` 后重跑 |
> | dockerd 命令行带 `--host=`/`-H` | 显式指定了监听路径 | 改成 `unix:///var/run/docker.sock`，或同步改 `docker context` |
> | CLI 路径是 `/snap/bin/docker` | snap 版 CLI 受沙箱约束 | 装 apt 版 `docker-ce`，或改用 `/usr/bin/docker` |

> **常见坑 ②：只有 `docker-compose`（v1）没有 v2 插件**
> 命令长这样：`docker-compose up -d --build`（中间有个连字符）。
> `deploy.sh` 已兼容两者，会自动降级；你手动敲命令时记得**它们是两套命令**：
>
> ```bash
> docker compose up -d --build      # v2：docker 是动词，compose 是子命令
> docker-compose up -d --build      # v1：一个独立二进制
> ```

---

## 2. 一键部署

在项目根目录（含 `Dockerfile`、`docker-compose.yml`）执行：

```bash
cp .env.example .env
# 编辑 .env，填写 ADMIN_PASS 和 SESSION_SECRET
# 构建镜像并后台启动
docker compose up -d --build
```

首次构建约需 2–5 分钟（`npm ci` 会拉取依赖，含 `better-sqlite3` 预编译包）。

查看启动状态：

```bash
docker compose ps
docker compose logs -f
```

看到 `Ready` 或能正常访问即部署成功。

---

## 3. 访问地址

> 容器内端口固定为 **82**（见 `Dockerfile` 的 `EXPOSE / PORT` 与 `docker-compose.yml` 的 `82:82`）。

| 路径 | 用途 |
| --- | --- |
| `http://<服务器IP>:82/auth` | **用户登录**（普通用户输入管理员分配的账号） |
| `http://<服务器IP>:82/admin` | **管理后台**（仪表盘 / 管理员 / 用户 / 充值订单） |
| `http://<服务器IP>:82/admin/login` | 管理员登录 |
| `http://<服务器IP>:82/` | 计算器首页（需登录且账号在有效期内，否则自动跳转 `/auth`） |
| `http://<服务器IP>:82/score` | **比分表**（比分 / 赔率 / 注数 / 金额，需登录；数据存本地浏览器） |

---

## 4. 首次初始化

### 初始管理员账号

```
用户名：admin
密码：.env 中的 ADMIN_PASS
```

> **重要：** `ADMIN_USER` / `ADMIN_PASS` **仅在数据库为空时生效**（`admins` 表无记录时种子一次）。
> 已运行过一次后修改这两个变量**不会**改变现有管理员密码，需登录后在「管理员」页面新增，或直接重置数据库。

**部署后请立即：**
1. 用 `admin` 和 `.env` 中的 `ADMIN_PASS` 登录 `/admin`
2. 在「管理员」页面添加自己的新管理员账号
3. 妥善保存 `.env` 中的 `SESSION_SECRET`（见下节）

### 使用流程

```
管理员登录 /admin
   ↓
「用户」页 → 创建用户（填用户名/密码/充值金额/使用时长天数）
   ↓
系统自动开通账号 + 生成首笔充值订单
   ↓
用户登录 /auth → 使用计算器（到期后自动被拦截）
   ↓
后续充值：「充值订单」页为该用户下单 → 到期时间自动顺延
```

---

## 5. 环境变量

在 `docker-compose.yml` 的 `environment` 中调整：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 固定为 production |
| `NEXT_TELEMETRY_DISABLED` | `1` | 关闭 Next.js 遥测 |
| `DB_PATH` | `/app/data/dsby.db` | SQLite 数据库文件路径（容器内） |
| `ADMIN_USER` | `admin` | 初始管理员用户名（仅首次生效） |
| `ADMIN_PASS` | 必填 | 初始管理员密码（仅首次生效） |
| `SESSION_SECRET` | 必填 | JWT 签名密钥 |
| `PORT` | `82` | 容器内监听端口（Dockerfile 固定，勿随意改） |

**生产环境务必修改 `SESSION_SECRET`：**

```bash
# 生成一个随机密钥
openssl rand -hex 32
```

把结果填入本地 `.env` 的 `SESSION_SECRET`，然后重建：

```bash
docker compose up -d --build
```

---

## 6. 数据持久化与备份

### 挂载说明

```yaml
volumes:
  - ./data:/app/data
```

宿主机 `./data` 目录即数据库目录，容器内对应 `/app/data`，**删除容器不会丢失数据**。

目录下文件：
- `dsby.db` — 主数据库文件
- `dsby.db-wal` / `dsby.db-shm` — SQLite WAL 模式日志（正常现象，勿删）

### 备份

```bash
# 推荐：停服后整体拷贝，最稳妥
docker compose down
cp -r ./data ./data.bak.$(date +%Y%m%d)
docker compose up -d

# 或不停服用 sqlite 导出（需宿主机装 sqlite3）
sqlite3 ./data/dsby.db ".backup ./dsby.backup.db"
```

### 恢复

```bash
docker compose down
rm -f ./data/dsby.db ./data/dsby.db-wal ./data/dsby.db-shm
cp ./dsby.backup.db ./data/dsby.db
docker compose up -d
```

---

## 7. 常用运维命令

```bash
# 启动（构建镜像）
docker compose up -d --build

# 停止并移除容器
docker compose down

# 停止但保留容器
docker compose stop

# 重启（改了环境变量后需要重建）
docker compose up -d --force-recreate

# 实时日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100

# 进入容器（排查用）
docker compose exec dsby-calculator sh

# 查看资源占用
docker stats dsby-calculator
```

### 代码更新后重新部署（推荐脚本）

项目根目录已提供一键更新脚本，自动完成「备份数据 → 打旧镜像快照 → 重建 → 重启 → 健康检查 → 失败回滚」：

```bash
chmod +x deploy.sh
./deploy.sh
```

数据不会丢失（`./data` 已挂载），镜像构建失败或启动后探活超时会自动回滚到上一版。

### 手工更新

```bash
git pull            # 或上传新代码
docker compose up -d --build
docker compose logs -f
```

确认 `docker compose ps` 状态为 `(healthy)` 即完成。

### 新增页面（如 `/score`）后的上线检查

Next.js App Router 会自动收录新路由，无需改 `Dockerfile`；但建议依次确认：

| 检查项 | 命令 / 位置 | 预期 |
| --- | --- | --- |
| 路由已进构建产物 | `docker compose exec dsby-calculator sh -c "ls /app/.next/server/app"` | 含对应目录 |
| 页面可访问（未登录跳登录页） | 浏览器打开 `http://<IP>:82/score` | 跳 `/auth` |
| 首页底部导航 | 登录后进入首页 | 出现「比分表」入口 |
| 移动端无横向溢出 | 手机浏览器打开 `/score` | 页面不撑破，表格内部横滚 |

---

## 8. 生产建议

### 8.0 部署成功但访问不了 —— 三层定位（按顺序跑，一跑就定位）

`docker ps` 看着是 Up、`deploy.sh` 探针也过了，但 `http://域名:82` 打不开，几乎都是下面三层之一：

**第 1 层 · 容器内服务本身通不通（宿主机执行）**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:82/auth
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:82/api/me
```

- 返回 `200` / `307` / `401` → 服务在跑（`401` 是 `/api/me` 未登录的正常响应）。
- 连接被拒 / 无响应 → 容器里进程没起来：`docker logs dsby-calculator --tail 40`。

**第 2 层 · 端口映射与监听（宿主机执行）**

```bash
docker ps --filter name=dsby-calculator --format '{{.Names}} | {{.Status}} | {{.Ports}}'
docker port dsby-calculator
ss -lntp | grep ':82'          # 老系统：netstat -lntp | grep 82
```

- `docker ps` 的 PORTS 列必须是 `0.0.0.0:82->82/tcp`（**不是 `127.0.0.1:82->82/tcp`**，后者只有本机能访问）。
- `ss` 里必须是 `0.0.0.0:82`；只有 `127.0.0.1:82` 说明容器对外不可达，改 compose 为 `"0.0.0.0:82:82"` 后重建。
- 三样都为空 → 容器压根没 up：`docker compose up -d && docker ps`。

**第 3 层 · 云安全组 / 系统防火墙（宿主机 + 云控制台各查一遍）**

```bash
curl ifconfig.me                 # 确认域名解析到的就是这台机器
sudo ufw status                  # 开了就放行：sudo ufw allow 82/tcp
sudo iptables -S INPUT | grep 82
sudo iptables -S DOCKER | head -20
```

- **99% 的"本地通、外网不通"是云安全组没放行**：阿里云 / 腾讯云控制台 → 安全组 → 入站规则 → 加 `TCP 82`，来源 `0.0.0.0/0`。装了宝塔还要在「安全 → 系统防火墙」放行 82。
- 最省事的做法：**不改端口策略，走 80/443 反代**——`nginx`/宝塔站点把 `80 → 127.0.0.1:82`，对外只开 80/443，见下面 8.2 的配置（把 `proxy_pass` 的 `127.0.0.1:82` 保持不动即可）。

> 判据速记：`127.0.0.1:82 通 + 公网IP:82 不通` = 防火墙（云安全组/ufw/宝塔）；`127.0.0.1:82 不通` = 容器/服务本身；`公网通但域名不通` = DNS 没解析到这台机器或 80 端口的 nginx 没反代。

### 8.1 修改默认端口

编辑 `docker-compose.yml`：

```yaml
ports:
  - "8080:82"      # 左侧为宿主机端口，右侧须与容器 PORT 一致
```

### 8.2 反向代理 + HTTPS（Nginx 示例）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:82;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

证书可用 `certbot` 免费申请。

### 8.3 安全清单

- [ ] 修改 `SESSION_SECRET` 为随机值（32 位以上）
- [ ] 修改默认管理员账号密码，或删除 `admin` 账号
- [ ] 不要将 `./data` 目录暴露到公网
- [ ] 定期备份 `./data`

---

## 9. 故障排查

### 构建失败：`better-sqlite3` 相关错误

原因：预编译二进制未匹配当前平台/架构。

解决：给构建阶段加编译工具（修改 Dockerfile 的 `deps` 与 `builder` 阶段）：

```dockerfile
RUN apk add --no-cache libc6-compat python3 make g++ \
  && npm ci
```

### 容器反复重启 / 无法写入数据库

原因：`./data` 目录权限不足。

```bash
# 宿主机上授权（容器内 nextjs 用户 uid=1001）
sudo chown -R 1001:1001 ./data
docker compose restart
```

### 端口被占用

```
Error starting userland proxy: listen tcp4 0.0.0.0:82: bind: address already in use
```

换端口或停掉占用进程：

```bash
sudo lsof -i :82
# 或修改 docker-compose.yml 的端口映射为 "8080:82"
```

### 构建时内存溢出（OOM）

Next.js 构建阶段内存不足。建议：
- 保证 ≥ 2GB 可用内存
- 增加 swap
- 或在 `.dockerignore` 确认已排除 `node_modules` / `.next`（本仓库已配置）

### `Cannot find module './xxx.js'`（页面 500 / 首页白屏）

原因：宿主机或镜像里的 `.next` 被 dev 与 build 两种产物交叉覆盖，chunk 号对不上。
典型触发方式是**在 `npm run dev` 运行期间执行了 `next build`**。

解决：停 dev → 清产物 → 重建

```bash
pkill -f "next dev"; pkill -f "next-server"
rm -rf .next
docker compose build --no-cache && docker compose up -d
```

> 本机开发时同样要遵守：**不要一边跑 `next dev` 一边跑 `next build`**。

### 镜像体积异常变大 / 疑似数据文件被打包

检查构建上下文是否已排除隐私文件：

```bash
docker build --no-cache -t tmp-check . && \
  docker run --rm tmp-check du -sh /app/data 2>/dev/null
```

`.dockerignore` 必须排除 `data` 与 `.env*`（当前仓库已配置），否则宿主机的
SQLite 数据库与密钥会被写进镜像层。

### 登录后立即跳回登录页

- 检查 Cookie 是否被浏览器拦截（反向代理需正确转发 `X-Forwarded-Proto`）
- 若修改了 `SESSION_SECRET`，旧 Cookie 会失效 → 重新登录即可

### 查看详细错误

```bash
docker compose logs -f dsby-calculator
docker compose exec dsby-calculator sh -c "ls -la /app/data"
```

---

## 10. 文件说明

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 多阶段构建：deps → builder → runner（standalone 精简镜像），容器端口 82 |
| `docker-compose.yml` | 服务编排、端口 82、环境变量、数据卷、healthcheck |
| `deploy.sh` | 一键更新：备份数据 → 快照旧镜像 → 重建 → 重启 → 健康检查 → 失败回滚 |
| `.dockerignore` | 排除 `node_modules` / `.next` / **`data`** / **`.env*`**，加快构建并防止隐私数据入镜像 |
| `.gitignore` | 排除 `data/` 与 `.env*`，避免数据库与密钥进版本库 |
| `next.config.js` | `output: standalone` + `serverComponentsExternalPackages: ['better-sqlite3']` |
| `data/` | SQLite 数据库目录（宿主机持久化，已 gitignore） |

---

## 快速开始（三行）

```bash
docker compose up -d --build
# 浏览器打开 http://<服务器IP>:82/admin
# 用 admin 和 .env 中的 ADMIN_PASS 登录，进入「用户」页创建账号即可

# 后续代码更新，直接跑：./deploy.sh
```
