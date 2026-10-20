/**
 * server-only / client-only 的本地替身。
 *
 * Next.js 在构建时通过 webpack alias 提供这两个模块（仓库里并不存在同名 npm 包），
 * 因此用 tsx 直接跑 scripts 下的验收脚本时会解析失败。
 * 本文件配合 tsconfig.scripts.json 的 paths 映射，仅在「独立脚本运行」时生效，
 * 不参与 Next 构建。
 */
export {};
