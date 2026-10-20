// 加解密与随机标识工具：口令哈希、token 哈希、业务单号生成。
// 属于领域层内部实现，不对外暴露到 lib/index.js。

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** 内部 salt 长度（字节），与 key 长度相同 */
const SALT_BYTES = 16
const KEY_BYTES = 32

/**
 * 生成 scrypt 口令串，格式 base64(salt):base64(key)。
 * @param {string} plain 明文口令
 * @param {Buffer} [salt] 指定 salt，默认随机生成
 * @returns {string}
 */
export function hashPassword(plain, salt = randomBytes(SALT_BYTES)) {
  return salt.toString('base64') + ':' + scryptSync(plain, salt, KEY_BYTES).toString('base64')
}

/**
 * 校验明文口令是否匹配 scrypt 口令串，格式错误一律返回 false。
 * @param {string} plain 明文口令
 * @param {string} stored 数据库里的口令串
 * @returns {boolean}
 */
export function verifyPassword(plain, stored) {
  try {
    const [salt, key] = stored.split(':')
    const expected = scryptSync(plain, Buffer.from(salt, 'base64'), KEY_BYTES)
    return timingSafeEqual(expected, Buffer.from(key, 'base64'))
  } catch {
    return false
  }
}

/**
 * 生成带前缀的随机业务标识，如订单号 O、支付号 P、会话 token S。
 * @param {string} prefix 单字符前缀
 * @returns {string}
 */
export const newId = (prefix) => prefix + randomBytes(10).toString('hex')

/**
 * 对会话原始 token 做 sha256，库里只存哈希值。
 * @param {string} raw 原始 token
 * @returns {string}
 */
export const hashToken = (raw) => createHash('sha256').update(raw).digest('hex')
