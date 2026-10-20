/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
    // 确保 standalone 输出包含 better-sqlite3 的原生 .node 二进制
    outputFileTracingIncludes: {
      "/**": ["./node_modules/better-sqlite3/**"],
    },
  },
};

module.exports = nextConfig;
