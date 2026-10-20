# 生产更新说明 · 2026-09-15（Docker / docker-compose）

> 目标机：crm.mingboai.com（81.69.249.204），当前 `http://crm.mingboai.com:81` 在线。
> 本地 commit：`667926d`（仓库第一个 commit，未 push）。
> 本机没有 Docker，构建必须在服务器上执行；下面所有命令都是**在服务器上跑**的。

---

## 0. 这次更新会改什么

### 代码

| 模块 | 内容 |
| --- | --- |
| OKR | 修复生产必崩：`SalesOkr` 模型此前只加在 SQLite schema，生产的 `schema.postgres.prisma` 没有它 → 构建出的 client 缺 `salesOkr` delegate，OKR 页一进来就抛错 |
| 企业详情 | 新页面 `/w/{slug}/crm/companies/{id}`：基本资料 / 公开信息 / 联系人 / 商机 / 跟进记录 / 下一步任务；列表页企业名与「详情」可点 |
| 公开信息 | 按企业名+官网生成百度/必应/站内搜索入口；有官网时只读抓公开页（标题/描述/联系方式），遇登录、验证码、付费内容直接标记不可读并停止，不绕过、不写回主表 |
| 提醒中心 | 工作台登录即渲染：逾期 / 即将到期 / 7 天未跟进 / 商机临期 / OKR 缺口 |
| 计划时间 | `Activity` 新增 `plannedAt`（计划执行），与 `dueAt`（截止）分列；登记表单可选填 |
| SOP | 固定六阶段 FIRST_CONTACT→NEEDS→OPPORTUNITY→PROPOSAL→NEGOTIATION→CLOSE，完成自动建下一阶段，商机 WON/LOST 或客户 CHURNED 时停止 |
| 错误兜底 | 页面查询统一 `safeQuery`，失败渲染明确错误提示，不再无限加载 |

### 数据库（`prisma db push` 自动做，纯新增，不删不改）

| 对象 | 变更 | 风险 |
| --- | --- | --- |
| 新表 `SalesOkr` | 18 个字段的 OKR 目标表 | 无 |
| `Activity.plannedAt` | 新增可空 `TIMESTAMP(3)` | 无 |

### 部署配置（本次一并修掉的 4 个坑）

1. **`.env.docker` 里混进了 shell 命令**（第 54–60 行）→ `docker compose --env-file` 直接解析失败。
   已改成注释形式，命令移到文件末尾的注释块里。
2. **compose 缺 `env_file`** → `--env-file` 只做 compose 文件里的 `${VAR}` 插值，**不会**把变量塞进容器。
   结果是 `DASHSCOPE_API_KEY` / `UCRM_API_KEYS` / `E2B_API_KEY` 在生产容器里全为空，AI 功能是哑的。已给 app、db 两个服务都加上 `env_file`。
3. **`WEB_PORT=3000` 但 `BETTER_AUTH_URL` 写的是 `:81`** → 端口不一致时登录会被跳到错误端口。已统一为 81。
4. **`.dockerignore` 没排除本地 SQLite** → `dev.db`（含测试账号与冒烟数据）会被打进生产镜像。已排除 `**/*.db` 与 `.workbuddy/`。

另外入口脚本改为：优先用镜像内的 `prisma` 二进制（不再依赖 `npx` 联网）、`db push` 失败时**停服报错**而不是带病启动。

---

## 1. 更新前检查（在服务器上）

```bash
cd /opt/unified-crm        # ← 改成服务器上实际的仓库路径

# 1) .env.docker 必须只有 KEY=value 和 # 注释
grep -nE '^[^#]*[^A-Za-z0-9_=]' .env.docker | head
#    有输出 = 混进了 shell 命令，先清掉（参考仓库 .env.docker.example 重写）

# 2) 端口必须成对
grep -E '^(WEB_PORT|BETTER_AUTH_URL)=' .env.docker
#    WEB_PORT=81 ⇄ BETTER_AUTH_URL=http://crm.mingboai.com:81

# 3) 看看当前跑的版本
docker compose --env-file .env.docker ps
```

---

## 2. 备份

```bash
docker compose --env-file .env.docker exec -T db \
  pg_dump -U "$(grep -E '^POSTGRES_USER=' .env.docker | cut -d= -f2)" \
          "$(grep -E '^POSTGRES_DB='  .env.docker | cut -d= -f2)" \
  > ucrm-$(date +%F-%H%M).sql
ls -lh ucrm-*.sql          # 确认文件非空
```

---

## 3. 同步代码（仓库还没有 remote，用 rsync / scp）

**方式 A · 从开发机 rsync 推过去**（在**这台 Mac** 上执行，把 `user@81.69.249.204` 换成实际的）：

```bash
cd /Users/wangliyan/Documents/ChatGPT/mbsoft/unified-crm
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env' --exclude '.env.docker' --exclude '*.db' \
  --exclude .workbuddy \
  ./ user@81.69.249.204:/opt/unified-crm/
```

`--exclude '.env.docker'` 是关键：服务器上的真实配置不要被本地样例覆盖。

**方式 B · 打 tar 包上传**：

```bash
# Mac 上
tar --exclude node_modules --exclude .next --exclude .git \
    --exclude '.env*' --exclude '*.db' --exclude .workbuddy \
    -czf /tmp/ucrm-20260915.tgz .
scp /tmp/ucrm-20260915.tgz user@81.69.249.204:/tmp/

# 服务器上
cd /opt/unified-crm && tar -xzf /tmp/ucrm-20260915.tgz
```

---

## 4. 构建并重启（db 容器不动，数据卷保留）

```bash
cd /opt/unified-crm
docker compose --env-file .env.docker up -d --build --force-recreate app
```

构建期会看到：`prisma generate --schema prisma/schema.postgres.prisma` → `pnpm build`（约几分钟）。

启动日志必须出现这三行：

```bash
docker compose --env-file .env.docker logs -f app
#   ⏳ 等待 PostgreSQL 就绪（db:5432）
#   📦 同步 PostgreSQL 数据库结构（prisma db push，幂等）
#   🚀 启动 Next.js Application
```

> 若卡在「同步数据库结构」并报错：入口脚本按"宁可停服也不丢数据"设计，会停在这里。
> 把报错贴出来再决定要不要 `--accept-data-loss`（本次变更是纯新增，正常不会出现）。

---

## 5. 验收

```bash
# 容器健康
docker compose --env-file .env.docker ps          # app 应为 healthy

# 页面可达
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:81/login     # 200

# 环境变量真的进容器了（此前 AI key 是空的）
docker compose --env-file .env.docker exec app env | grep -E 'DATABASE_URL|DASHSCOPE_API_KEY|UCRM_API_KEYS'

# 新表已建
docker compose --env-file .env.docker exec -T db \
  psql -U ucrm -d ucrm -c '\dt' | grep -E 'SalesOkr'
docker compose --env-file .env.docker exec -T db \
  psql -U ucrm -d ucrm -c '\d "Activity"' | grep plannedAt
```

浏览器验收（登录你的账号）：

- [ ] 销售 → OKR：能打开，不再报错（这是原来必崩的页面）
- [ ] 企业客户列表：点企业名称能进详情页，六个区块都有内容
- [ ] 工作台：登录后直接看到提醒中心（逾期 / 即将到期 / 7 天未跟进）
- [ ] 新建客户 → 跟进记录里自动出现「首次联系」待办；标记完成后自动生成下一阶段

---

## 6. 回滚

```bash
# 代码回滚（不会删表，新增的表/列留着也不影响运行）
#   若是 rsync 覆盖的：重新 rsync 旧版本即可
docker compose --env-file .env.docker up -d --build --force-recreate app

# 数据回滚（真出问题时）
docker compose --env-file .env.docker exec -T db psql -U ucrm -d ucrm < ucrm-<时间戳>.sql
```

---

## 7. 后续建议

- 仓库加个 remote（GitHub / 私有 GitLab），之后就能 `git pull` 更新，不必 rsync。
- `.env.docker` 里的 `POSTGRES_PASSWORD` 还是样例值 `请改成强密码` 的话，趁这次维护窗口换掉：
  改完要同时改 `DATABASE_URL`，再按 `.env.docker` 末尾注释里的 `ALTER ROLE` 命令同步 PG 侧密码。
- 服务器磁盘上留一份 `pg_dump` 定时任务，别只在更新前才备份。
