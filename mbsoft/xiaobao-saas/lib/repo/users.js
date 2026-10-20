// users 表读写：只负责 SQL，不含注册/登录的业务校验。

import { db } from '../db/client.js'

/**
 * 插入用户并返回新用户 id。
 * @param {{email: string, passwordHash: string, role: string, createdAt: number}} row
 * @returns {number}
 */
export function insertUser({ email, passwordHash, role, createdAt }) {
  const res = db()
    .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .run(email, passwordHash, role, createdAt)
  return Number(res.lastInsertRowid)
}

/**
 * 按邮箱查用户整行。
 * @param {string} email 已规整化的小写邮箱
 * @returns {object|undefined}
 */
export const userByEmail = (email) => db().prepare('SELECT * FROM users WHERE email = ?').get(email)

/**
 * 按 id 查用户整行。
 * @param {number} id
 * @returns {object|undefined}
 */
export const userById = (id) => db().prepare('SELECT * FROM users WHERE id = ?').get(id)

/** 统计平台用户总数 */
export const countUsers = () => db().prepare('SELECT count(*) n FROM users').get().n
