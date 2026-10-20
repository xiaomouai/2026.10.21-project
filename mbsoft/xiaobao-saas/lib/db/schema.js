// 建表 DDL：8 张业务表的纯字符串模板，字段语义与线上库保持一致。
// 只允许追加 CREATE INDEX，不要改动已有表的字段与约束。

/** 一次性执行的建表与索引脚本，幂等（全部带 IF NOT EXISTS） */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'creator', 'reader')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  pay_qr TEXT NOT NULL DEFAULT '',
  period_end INTEGER NOT NULL DEFAULT 0,
  partner_enabled INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0.2,
  created_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  audience TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('lifetime', 'subscription')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  tenant_id INTEGER,
  buyer_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
  confirm_requested INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  FOREIGN KEY (buyer_id) REFERENCES users (id),
  FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  payment_no TEXT UNIQUE NOT NULL,
  order_id INTEGER UNIQUE NOT NULL,
  channel TEXT NOT NULL,
  paid_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id)
);

CREATE TABLE IF NOT EXISTS entitlements (
  id INTEGER PRIMARY KEY,
  buyer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  source_order_id INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE (buyer_id, product_id),
  FOREIGN KEY (buyer_id) REFERENCES users (id),
  FOREIGN KEY (product_id) REFERENCES products (id),
  FOREIGN KEY (source_order_id) REFERENCES orders (id)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_paid ON orders (product_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON products (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_product_status ON articles (product_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_buyer ON entitlements (buyer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- 分销：每个用户一个推广码，推广码归属唯一用户
CREATE TABLE IF NOT EXISTS referrals (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON referrals (user_id);

-- 分销佣金：每笔订单至多一笔佣金（order_id 唯一保证幂等）
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL,
  referrer_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'settled')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id),
  FOREIGN KEY (referrer_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_commissions_referrer ON commissions (referrer_id, created_at DESC);

-- 合伙人钱包：每个推广者一个余额账户，available 为可提现、withdrawn 为累计已提现
CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER PRIMARY KEY,
  available_cents INTEGER NOT NULL DEFAULT 0,
  withdrawn_cents INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- 提现记录：每笔提现按 6.1% 计提税费，状态固定为已打款（模拟环境即时结算）
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  net_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals (user_id, created_at DESC);
`

