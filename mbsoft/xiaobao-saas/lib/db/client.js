// sqlite 连接单例：负责建连接、开 PRAGMA、执行建表与演示数据。
// 单例挂在 globalThis 上，避免 Next.js dev 热更新（HMR）重复建连接。

import { DatabaseSync } from 'node:sqlite'
import { DB_PATH } from '../config.js'
import { SCHEMA_SQL } from './schema.js'
import { seed } from './seed.js'

/** globalThis 上的单例挂载点，key 用 Symbol.for 保证跨模块副本共享 */
const STORE_KEY = Symbol.for('xiaobao.db.store')
const store = (globalThis[STORE_KEY] ||= { database: null })

/**
 * 获取数据库连接；首次调用时建连接、跑迁移并写入演示数据。
 * @returns {import('node:sqlite').DatabaseSync}
 */
export function db() {
  if (store.database) return store.database
  const database = new DatabaseSync(DB_PATH)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA journal_mode = WAL')
  migrate(database)
  store.database = database
  return database
}

/**
 * 执行建表与演示数据写入，幂等。
 * @param {import('node:sqlite').DatabaseSync} [database] 默认取单例连接
 * @returns {import('node:sqlite').DatabaseSync}
 */
export function migrate(database = db()) {
  database.exec(SCHEMA_SQL)
  addColumnIfMissing(database, 'orders', 'ref_code', 'TEXT')
  addColumnIfMissing(database, 'tenants', 'partner_enabled', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'tenants', 'commission_rate', 'REAL NOT NULL DEFAULT 0.2')
  addColumnIfMissing(database, 'tenants', 'created_at', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'tenants', 'intro', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(database, 'tenants', 'pay_qr', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(database, 'orders', 'confirm_requested', 'INTEGER NOT NULL DEFAULT 0')
  seed(database)
  return database
}

/**
 * 幂等地为已存在的表补列：分销归因需要给 orders 增加 ref_code 字段。
 * sqlite 的 ALTER TABLE 不支持 IF NOT EXISTS，因此先查 PRAGMA table_info。
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {string} table 表名
 * @param {string} column 列名
 * @param {string} ddl 列类型片段
 */
function addColumnIfMissing(database, table, column, ddl) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

/** 关闭并清空连接单例，仅供测试隔离使用 */
export function reset() {
  store.database?.close()
  store.database = null
}
