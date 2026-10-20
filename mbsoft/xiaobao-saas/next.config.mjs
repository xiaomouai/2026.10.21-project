import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

export default phase => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  // Docker 打包用：产出自包含 server.js（.next/standalone），本地 next start 不受影响
  output: 'standalone',
})
