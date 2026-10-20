# 生产环境切换 PostgreSQL · 实施指南

> 适用阶段：UniCRM 从「本地 SQLite 开发」切到「生产 PostgreSQL」。

## 为什么能平滑切换

`prisma/schema.prisma` 在建模时即遵循「数据库无关」约定（见 schema 顶部注释）：

- 不使用 `enum` / `citext` / 数组等 DB 专有类型 —— 状态一律 `String` + 注释约定
- 金额用 `Decimal`，主键统一 `String cuid`
- `provider` 切 pg 时仅需改 datasource + 依赖 adapter

因此生产切换**不需要重写任何模型**，只需切换 datasource provider 并提供 PG 连接串。

## 切换步骤

### 1. 准备 PostgreSQL 实例

```bash
# 任意托管 PG（云厂 / 容器 / 自建），拿到连接串：
postgresql://USER:PASS@HOST:5432/ucrm?schema=public
```

### 2. 使用 PG 版 schema（已就绪）

仓库已提供 `prisma/schema.postgres.prisma`（`provider = "postgresql"`），与开发版模型完全一致。

### 3. 配置连接串

在 `packages/db/.env`（生产用 CI / Secret 注入，勿入库）：

```bash
DATABASE_URL="postgresql://USER:PASS@HOST:5432/ucrm?schema=public"
```

### 4. 生成并应用迁移

```bash
cd packages/db
# 首次：基于 PG schema 生成初始迁移（不连开发库）
npx prisma migrate dev --schema prisma/schema.postgres.prisma --name init
# 或仅同步结构（无迁移历史）：
npx prisma db push --schema prisma/schema.postgres.prisma
```

> Prisma 7 的 `prisma.config.ts` 中 `datasource.url` 已读 `process.env.DATABASE_URL`，
> 运行时 client 按当前 schema 生成，无需改应用代码。

### 5. 构建与运行

```bash
# 用 PG schema 重新生成 client（覆盖 dev 的 sqlite client）
npx prisma generate --schema prisma/schema.postgres.prisma
# 业务代码不变，直接 build / start
pnpm --filter @ucrm/web build
```

## 双 schema 管理约定

| 文件 | provider | 用途 |
| --- | --- | --- |
| `prisma/schema.prisma` | sqlite | 本地开发（默认） |
| `prisma/schema.postgres.prisma` | postgresql | 生产 |

- 模型变更**两处同步**：改完 `schema.prisma` 后，`cp schema.prisma schema.postgres.prisma && sed -i 's/provider = "sqlite"/provider = "postgresql"/' schema.postgres.prisma`
- 不要把 `*.db` / `.env` 入库（`.gitignore` 已覆盖）

## 适配器依赖

- 运行时 `@ucrm/db` 内部用 `@prisma/adapter-better-sqlite3`（sqlite）。
- 切 PG 需改用 PG adapter：`@prisma/adapter-pg`（或 `pg`），并在 `packages/db/src/client.ts` 按 `DATABASE_URL` 前缀选择 adapter。
  - 当前 `client.ts` 已基于 `process.cwd()` 多候选定位 dev.db；生产以 `postgresql://` 开头时切换 adapter 即可。

## 验证清单（上线前）

- [ ] `prisma validate --schema prisma/schema.postgres.prisma` 通过
- [ ] `prisma migrate dev --schema ... --name init` 在 PG 成功
- [ ] 业务读写在 PG 上跑通（建档 / 问 CRM / 跟进提醒 全链路）
- [ ] REST 鉴权已切 `UCRM_API_KEYS`（见 AI_NATIVE 文档 P3-1）
