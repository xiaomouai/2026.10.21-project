# 知栈｜多租户知识付费 SaaS

独立 Next.js 14 项目，对标小报童：创作者固定月租、多商品店铺、买断/订阅专栏、付费文章、读者订单、平台概览，以及首页「精选」内容分发。

```bash
npm install
WECHAT_MOCK_ENABLED=true npm run dev   # http://localhost:3000
npm test      # node:test 领域层测试
npm run lint  # next lint
npm run build # 生产构建
```

示例创作者账号：`demo@creator.local` / `demo12345`；平台管理员邮箱：`admin@local.test`。首次创建管理员前请设置环境变量 `ADMIN_PASSWORD`。读者请自行注册。

## 目录结构

```
lib/
  config.js          环境变量与常量（DB 路径、会话时长、套餐价格等）
  errors.js          AppError 与断言工具
  money.js           分/元换算与格式化（数据库一律存「分」）
  dates.js           时间戳格式化
  db/
    client.js        sqlite 连接单例（globalThis 防 HMR 重复）+ migrate
    schema.js        建表 DDL 与索引
    seed.js          演示数据
  repo/              纯 SQL 读写层：users sessions tenants products articles orders entitlements
  svc/               业务规则与事务边界：auth catalog creator commerce admin discovery
  auth/
    session.js       server-only：currentUser / requireUser / requireRole + cookie 读写
    crypto.js        口令散列（scrypt）与单号生成
  index.js           对外统一出口（barrel）
app/
  actions/           Server Actions：auth（注册登录登出）creator（后台写操作）shop（购买支付）
  components/        共享组件：Money Eyebrow PageHeader Panel Field EmptyState Badge SubmitButton
  styles/            分层样式：tokens（变量）base（基础）marketing（对外）dashboard（控制台）
  layout.js          角色感知导航（未登录/creator/reader/admin 各一套）
  error.js           全局错误边界（client）
  not-found.js       全局 404
  loading.js         全局骨架屏
  logout/route.js    GET 登出路由（供导航链接使用）
```

## 关键约定

- 导入一律用 `@/lib` 别名走 barrel，页面禁止直接依赖 `lib/repo` / `lib/svc` 内部文件。
- 鉴权统一走 `@/lib/auth/session`，禁止页面手写 `cookies().get('xiaobao_session')`。
- 金额一律 `<Money>` / `fmt()` / `toCents()`，禁止手写 `/100`。
- 表单错误用 `useFormState`（React 18.3，从 `react-dom` 导入）内联返回 `AppError` 文案；`redirect()` 只能抛出、不能被 catch 吞掉。
- Server Action 按域拆分在 `app/actions/`，文件首行 `'use server'`。

## 业务链路

注册 → （创作者）开通套餐 ¥99/月 → 建店铺 → 发商品（买断/订阅）→ 发文章 → 读者在店铺下单 → 模拟支付 → 自动写入权益（`entitlements`）→ 阅读页校验 `canRead`，未购买展示付费墙并引导购买。

首页「精选」对标小报童精选栏目：`featuredProducts` 按销量聚合推荐专栏，`discoverStores` 推荐店铺。

## 注意事项

所有支付和金额均为本地模拟数据，不会产生真实扣款或真实收入。默认数据库是 `xiaobao.db`，测试使用临时 SQLite 文件（`XIAOBAO_DB` 可覆盖路径）。`node:sqlite` 为 Node 22 实验特性，会有 ExperimentalWarning，属正常。正式多实例部署前需要迁移到 PostgreSQL，并接入创作者自己的微信支付商户号。
