/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone：只产出运行所需的最小文件树，供 Dockerfile 的 runner 阶段使用
  output: "standalone",
  experimental: {
    // better-sqlite3 是原生模块，交给 Node 直接 require，不参与打包
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

module.exports = nextConfig;
