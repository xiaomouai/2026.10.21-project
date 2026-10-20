// 兼容层：旧调用方仍写 `import ... from '../lib/db'`，这里直接再出口新的领域层出口。
// 待 app/** 全部切到 lib/index.js 后删除本文件，请勿再新增对它的引用。
export * from './index.js'
