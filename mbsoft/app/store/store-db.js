import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { getProduct } from './products.js'

const DB_PATH = process.env.COMPANY_DB || 'company.db'
const SESSION_SECONDS = 30 * 24 * 60 * 60

let database

function now() { return Math.floor(Date.now() / 1000) }
function digest(value) { return createHash('sha256').update(value).digest('hex') }
function token(prefix = '') { return `${prefix}${randomBytes(16).toString('hex')}` }

export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function db() {
  if (database) return database
  database = new DatabaseSync(DB_PATH)
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  migrate(database)
  return database
}

function migrate(sqlite) {
  const legacy = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='store_entitlements'").get()
  if (legacy?.sql?.includes('invite_hash TEXT NOT NULL')) {
    const counts = ['store_users', 'store_entitlements'].map(name => sqlite.prepare(`SELECT count(*) count FROM ${name}`).get().count)
    if (counts.some(Number)) throw new Error('旧版商店已有数据，停止自动迁移')
    sqlite.exec('DROP TABLE IF EXISTS store_entitlements; DROP TABLE IF EXISTS store_invites; DROP TABLE IF EXISTS store_sessions; DROP TABLE IF EXISTS store_users;')
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS store_users (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES store_users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS store_orders (
      id INTEGER PRIMARY KEY, order_no TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0), status TEXT NOT NULL CHECK(status IN ('pending','paid','closed')),
      created_at INTEGER NOT NULL, paid_at INTEGER, closed_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES store_users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS store_payments (
      id INTEGER PRIMARY KEY, payment_no TEXT NOT NULL UNIQUE, order_id INTEGER NOT NULL UNIQUE, channel TEXT NOT NULL,
      amount_cents INTEGER NOT NULL, status TEXT NOT NULL, paid_at INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES store_orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS store_entitlements (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, product_slug TEXT NOT NULL, source_order_id INTEGER NOT NULL,
      unlocked_at INTEGER NOT NULL, expires_at INTEGER, UNIQUE(user_id, product_slug),
      FOREIGN KEY(user_id) REFERENCES store_users(id) ON DELETE CASCADE,
      FOREIGN KEY(source_order_id) REFERENCES store_orders(id)
    );
    CREATE TABLE IF NOT EXISTS store_memberships (
      user_id INTEGER PRIMARY KEY, status TEXT NOT NULL, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, source_order_id INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES store_users(id) ON DELETE CASCADE,
      FOREIGN KEY(source_order_id) REFERENCES store_orders(id)
    );
    CREATE INDEX IF NOT EXISTS idx_store_orders_user_created ON store_orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_store_entitlements_user ON store_entitlements(user_id);
  `)
}

function hashPassword(password) {
  const salt = randomBytes(16)
  return `${salt.toString('base64')}:${scryptSync(password, salt, 32).toString('base64')}`
}

function verifyPassword(password, stored) {
  try {
    const [salt, expected] = stored.split(':')
    return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'base64'), 32), Buffer.from(expected, 'base64'))
  } catch { return false }
}

function validateCredentials(email, password) {
  const cleanEmail = String(email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) throw new StoreError('请输入有效邮箱')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new StoreError('密码长度应为8到128位')
  return cleanEmail
}

function createSession(sqlite, userId) {
  const raw = token()
  const expiresAt = now() + SESSION_SECONDS
  sqlite.prepare('INSERT INTO store_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(digest(raw), userId, expiresAt, now())
  return { token: raw, expiresAt }
}

export function register(email, password) {
  const sqlite = db(); const cleanEmail = validateCredentials(email, password)
  try {
    const user = sqlite.prepare('INSERT INTO store_users(email,password_hash,created_at) VALUES(?,?,?)').run(cleanEmail, hashPassword(password), now())
    const session = createSession(sqlite, Number(user.lastInsertRowid))
    return { ...session, user: getUserBySession(session.token) }
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw new StoreError('该邮箱已注册')
    throw error
  }
}

export function login(email, password) {
  const sqlite = db()
  const row = sqlite.prepare('SELECT id,password_hash FROM store_users WHERE email=?').get(String(email).trim().toLowerCase())
  if (!row || !verifyPassword(password, row.password_hash)) throw new StoreError('邮箱或密码错误', 401)
  const session = createSession(sqlite, row.id)
  return { ...session, user: getUserBySession(session.token) }
}

export function logout(rawToken) { if (rawToken) db().prepare('DELETE FROM store_sessions WHERE token_hash=?').run(digest(rawToken)) }

export function getUserBySession(rawToken) {
  if (!rawToken) return null
  const sqlite = db(); const timestamp = now()
  const user = sqlite.prepare(`SELECT u.id,u.email,s.expires_at session_expires_at FROM store_sessions s JOIN store_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(digest(rawToken), timestamp)
  if (!user) return null
  const entitlements = sqlite.prepare('SELECT product_slug,unlocked_at,expires_at FROM store_entitlements WHERE user_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY unlocked_at DESC').all(user.id, timestamp)
  const membership = sqlite.prepare('SELECT status,period_start,period_end FROM store_memberships WHERE user_id=? AND period_end>?').get(user.id, timestamp) || null
  return { id: user.id, email: user.email, sessionExpiresAt: user.session_expires_at, entitlements, membership }
}

export function createOrder(userId, productSlug) {
  const product = getProduct(productSlug)
  if (!product) throw new StoreError('商品不存在', 404)
  const orderNo = token('K')
  db().prepare('INSERT INTO store_orders(order_no,user_id,product_slug,product_name,amount_cents,status,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(orderNo, userId, product.slug, product.name, product.priceCents, 'pending', now())
  return getOrder(userId, orderNo)
}

export function getOrder(userId, orderNo) {
  const row = db().prepare('SELECT order_no,product_slug,product_name,amount_cents,status,created_at,paid_at FROM store_orders WHERE user_id=? AND order_no=?').get(userId, orderNo)
  if (!row) throw new StoreError('订单不存在', 404)
  return row
}

export function listOrders(userId) {
  return db().prepare('SELECT order_no,product_slug,product_name,amount_cents,status,created_at,paid_at FROM store_orders WHERE user_id=? ORDER BY created_at DESC').all(userId)
}

export function payMock(userId, orderNo) {
  if (process.env.WECHAT_MOCK_ENABLED !== 'true') throw new StoreError('模拟支付暂未开启', 403)
  const sqlite = db(); sqlite.exec('BEGIN IMMEDIATE')
  try {
    const order = sqlite.prepare('SELECT * FROM store_orders WHERE user_id=? AND order_no=?').get(userId, orderNo)
    if (!order) throw new StoreError('订单不存在', 404)
    if (order.status === 'paid') { sqlite.exec('COMMIT'); return getOrder(userId, orderNo) }
    if (order.status !== 'pending') throw new StoreError('订单不可支付')
    const timestamp = now()
    sqlite.prepare('INSERT INTO store_payments(payment_no,order_id,channel,amount_cents,status,paid_at) VALUES(?,?,?,?,?,?)').run(token('P'), order.id, 'wechat_mock', order.amount_cents, 'paid', timestamp)
    sqlite.prepare("UPDATE store_orders SET status='paid',paid_at=? WHERE id=?").run(timestamp, order.id)
    if (order.product_slug === 'monthly-member') {
      const current = sqlite.prepare('SELECT period_end FROM store_memberships WHERE user_id=?').get(userId)
      const start = Math.max(timestamp, current?.period_end || 0); const end = start + 30 * 86400
      sqlite.prepare(`INSERT INTO store_memberships(user_id,status,period_start,period_end,source_order_id) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status='active',period_start=excluded.period_start,period_end=excluded.period_end,source_order_id=excluded.source_order_id`).run(userId, 'active', start, end, order.id)
    } else {
      sqlite.prepare(`INSERT INTO store_entitlements(user_id,product_slug,source_order_id,unlocked_at,expires_at) VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,product_slug) DO NOTHING`).run(userId, order.product_slug, order.id, timestamp)
    }
    sqlite.exec('COMMIT')
    return getOrder(userId, orderNo)
  } catch (error) { sqlite.exec('ROLLBACK'); throw error }
}

export function __resetForTests() { database?.close(); database = undefined }
