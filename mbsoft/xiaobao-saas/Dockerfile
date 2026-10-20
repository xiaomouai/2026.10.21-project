# 知栈 xiaobao-saas 生产镜像
# 多阶段构建：deps → build（standalone）→ runner（仅运行时产物）
# 基础镜像 node:22（node:sqlite 需要 Node ≥ 22）

# ---- 阶段 1：依赖安装 ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 阶段 2：构建 ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 阶段 3：运行 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    XIAOBAO_DB=/data/xiaobao.db
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
