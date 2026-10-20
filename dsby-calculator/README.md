# 💧 打水计算器 (dsby.org)

基于 **Next.js 14 + TypeScript + React 18 + SQLite** 构建的移动端打水/套利计算工具，含完整的**用户账号管理、充值时长控制与管理后台**。

## ✨ 功能特性

### 计算器
- 🧮 **双边打水计算器**：支持 A/B 两网站赔率、占成、回水输入
- ⚡ **马来赔率准确处理**：正赔率（赢=赔率/输=1）与负赔率（赢=1/输=|赔率|）分别计算
- ⚙️ **灵活参数**：固定边（A/B）、固定金额、四舍五入档位、固定边整数
- 📊 **实时盈亏分析**：分别显示 A 赢 / B 赢的盈亏及合计下达

### 账号与后台
- 🔐 **登录鉴权**：scrypt 密码哈希 + JWT（httpOnly Cookie）会话
- ⏳ **充值时长控制**：按充值金额设置使用时长（如充值 1000 用 7 天），到期自动拦截
- 👥 **用户管理**：管理员创建用户账号，用户仅由后台创建（无自助注册）
- 💰 **充值订单管理**：创建/删除订单，有效期自动顺延、删单自动重算
- 📈 **统计报表**：总充值金额、订单数、用户总数/有效用户、最近订单与用户
- 🛡️ **管理后台 `/admin`**：仪表盘 / 管理员 / 用户 / 充值订单四个模块

## 🚀 快速开始

### 方式一：Docker 部署（推荐，生产用）

```bash
cp .env.example .env
# 编辑 .env，填写 ADMIN_PASS 和 SESSION_SECRET
docker compose up -d --build
```

初始管理员用户名为 **`admin`**，密码取自 `.env` 中的 `ADMIN_PASS`。访问 `http://<服务器IP>:82/admin`。

代码更新部署：在项目根目录执行 `./deploy.sh`（自动备份数据、重建镜像、健康检查、失败回滚），
详细说明见 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)。

👉 完整说明见 **[DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)**（环境变量、数据备份、Nginx 反代、HTTPS、故障排查）

### 方式二：本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

> 注意：访问 `/` 需登录且账号有效，未登录会自动跳转 `/auth`。
> 数据库文件生成在 `data/dsby.db`，首次启动自动建表并种子默认管理员。

## 📱 路由说明

| 路由 | 说明 |
|------|------|
| `/` | 计算器首页（需登录且账号未过期） |
| `/auth` | 用户登录 |
| `/profile` | 个人中心（账号、到期时间、退出登录） |
| `/score` | 比分表（比分 / 赔率 / 注数 / 金额，需登录；数据存本地浏览器） |
| `/admin/login` | 管理员登录 |
| `/admin` | 管理后台 · 统计仪表盘 |
| `/admin/admins` | 管理员账号管理 |
| `/admin/users` | 用户账号管理（创建用户 + 充值时长） |
| `/admin/orders` | 充值订单管理 |

## 📁 项目结构

```
dsby-calculator/
├── Dockerfile                    # 多阶段构建（standalone 精简镜像）
├── docker-compose.yml            # 服务编排 + 数据卷 + healthcheck
├── deploy.sh                     # 一键更新（备份 / 构建 / 健康检查 / 回滚）
├── .dockerignore                 # 排除 node_modules / .next / data / .env*
├── next.config.js                # output: standalone + better-sqlite3 external
├── data/                         # SQLite 数据库（gitignore，Docker 挂卷）
├── src/
│   ├── middleware.ts             # 拦截 / 与 /admin/*（Edge，仅验 JWT）
│   ├── lib/
│   │   ├── db.ts                 # SQLite 单例、建表、种子管理员、addDays
│   │   ├── jwt.ts                # JWT 签名/校验（Edge 安全，仅依赖 jose）
│   │   ├── auth.ts               # 密码哈希 scrypt（Node-only）
│   │   ├── session.ts            # Cookie 名与密钥
│   │   └── server-auth.ts        # getCurrentUser / getCurrentAdmin
│   ├── app/
│   │   ├── page.tsx              # 计算器首页（client）
│   │   ├── auth/page.tsx         # 用户登录
│   │   ├── profile/page.tsx      # 个人中心
│   │   ├── score/page.tsx        # 比分表（比分/赔率/注数/金额）
│   │   ├── api/                  # auth、me、admin/* 接口
│   │   └── admin/
│   │       ├── login/page.tsx    # 管理员登录
│   │       └── (app)/            # 受保护后台（侧边栏布局 + 鉴权）
│   │           ├── page.tsx      # 统计仪表盘
│   │           ├── admins/       # 管理员
│   │           ├── users/        # 用户
│   │           └── orders/       # 充值订单
│   └── components/
│       ├── BottomNav.tsx
│       └── admin/                # 后台表单与操作按钮
└── DOCKER_DEPLOY.md              # Docker 部署文档
```

## 🔧 技术栈

- **Framework**: Next.js 14（App Router）
- **Language**: TypeScript
- **Database**: SQLite（better-sqlite3）
- **Auth**: scrypt（node:crypto）+ JWT（jose，httpOnly Cookie）
- **UI**: 纯 CSS（CSS Variables + Flex/Grid）
- **Deploy**: Docker（standalone 多阶段构建）+ docker-compose

## 🔑 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DB_PATH` | `data/dsby.db` | SQLite 路径 |
| `ADMIN_USER` | `admin` | 初始管理员（仅首次生效） |
| `ADMIN_PASS` | 必填 | 初始管理员密码（仅首次生效） |
| `SESSION_SECRET` | 生产必填 | JWT 密钥 |

## ⚠️ 免责声明

本项目仅供计算参考，不构成任何投注建议。请遵守当地法律法规。

---

Made with ❤️ by dsby.org
