import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 独立输出：生成 .next/standalone，便于 Docker 精简运行
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // workspace 内 TS 源码包（@ucrm/db）需要编译
  transpilePackages: ["@ucrm/db"],
  // 原生 / 含二进制模块的依赖保持 server external，交给 Node 直载
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "pg",
  ],
};

export default nextConfig;
