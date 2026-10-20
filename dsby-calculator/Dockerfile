# syntax=docker/dockerfile:1

# 注意：better-sqlite3@13 要求 Node >= 22。
# 使用 Debian(glibc) 而非 Alpine(musl)，以便命中 better-sqlite3 的官方预编译包，
# 否则会回退到 node-gyp 源码编译（需要 Python/编译器）。

# ---------- 依赖安装阶段 ----------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# 1. 配置 APT 国内镜像源 (以阿里云为例，也可替换为清华、中科大等)
# 2. 安装构建工具作为兜底：若预编译包缺失则本地编译
# 3. 清理缓存以减小镜像体积
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# 4. 配置 NPM 国内镜像源 (使用 npmmirror/淘宝镜像)
# 5. 执行安装
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci

# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 继承上一阶段的 node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# 6. 确保构建时也使用国内镜像源 (防止构建脚本中再次下载依赖)
RUN npm config set registry https://registry.npmmirror.com && \
    npm run build

# ---------- 运行阶段（standalone 精简镜像） ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 82
ENV HOSTNAME=0.0.0.0
ENV PORT=82
ENV DB_PATH=/app/data/dsby.db

CMD ["node", "server.js"]
