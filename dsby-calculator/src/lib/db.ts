// SQLite 单例连接（better-sqlite3），建表并首次种子管理员
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashPassword } from "./auth";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "dsby.db");

type DBType = Database.Database;

const globalForDb = globalThis as unknown as { __dsby_db?: DBType };

export function getDb(): DBType {
  if (globalForDb.__dsby_db) return globalForDb.__dsby_db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      duration_days INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 首次种子管理员需要由部署者设置密码
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM admins").get() as { c: number }
  ).c;
  if (count === 0) {
    const password = process.env.ADMIN_PASS;
    if (!password) throw new Error("ADMIN_PASS is required to create the initial admin");
    const username = process.env.ADMIN_USER || "admin";
    db.prepare(
      "INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)"
    ).run(username, hashPassword(password), new Date().toISOString());
  }

  globalForDb.__dsby_db = db;
  return db;
}

// 计算某起始时间 + N 天后的 ISO 字符串
export function addDays(iso: string | null, days: number): string {
  const base = iso && new Date(iso).getTime() > Date.now()
    ? new Date(iso).getTime()
    : Date.now();
  return new Date(base + days * 86400000).toISOString();
}
