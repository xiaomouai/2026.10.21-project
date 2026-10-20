# syntax=docker/dockerfile:1

# 育儿知识库 —— Next.js 14 + better-sqlite3（原生模块）
#
# 三个阶段：deps（装依赖） → builder（构建） → runner（最小运行镜像）
# 用 Debian(bookworm-slim) 而非 Alpine：better-sqlite3 只提供 glibc 版本的 .node，
# Alpine(musl) 不能直接用。
#
# ── 构建加速参数（默认已适配国内网络）──
# 境外机器 / CI 想走官方源时，用 --build-arg 覆盖即可，例如：
#   docker compose build --no-cache \
#     --build-arg BASE_IMAGE=node:22-bookworm-slim \
#     --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG BASE_IMAGE=node:22-bookworm-slim
ARG APT_MIRROR=https://mirrors.tencent.com
ARG NPM_REGISTRY=https://registry.npmmirror.com
# better-sqlite3 v13 的 .node 二进制随 npm 包分发（prebuilds/，含 linux-x64 / linuxmusl-x64）。
# 但它**没有 install 脚本**，npm 看到 binding.gyp 会自动跑 `node-gyp rebuild`，
# 于是需要 python3 + make + g++，在国内机器上又慢又容易失败。
# 对策：npm ci 用 --ignore-scripts 跳过编译 —— 运行时 binding.js 会**优先**加载
# prebuilds/<平台>.node（找不到才回退 build/），功能完全不受影响（已实测）。
# 仅当你确实要从源码构建时（如非常规架构）才设为 true，此时会自动装工具链并 rebuild。
ARG INSTALL_BUILD_TOOLS=false

# ---------- 1. 依赖阶段 ----------
FROM ${BASE_IMAGE} AS deps
ARG APT_MIRROR
ARG INSTALL_BUILD_TOOLS
ARG NPM_REGISTRY
WORKDIR /app

# 默认跳过；需要时同时把 Debian 源换成国内镜像站（一次替换即覆盖 debian / debian-security）
RUN set -eux; \
    if [ "$INSTALL_BUILD_TOOLS" = "true" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
      apt-get update \
      && apt-get install -y --no-install-recommends python3 make g++ \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# 本项目的 package-lock.json 里 resolved 已经是 registry.npmmirror.com；
# --replace-registry-host=always 是保险：万一 lockfile 被改回 npmjs.org，
# npm ci 依然会改从上面的 NPM_REGISTRY 下载（ci 默认严格按 lockfile 里的地址取包）。
COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
    # --ignore-scripts：跳过 node-gyp 编译，直接用包内预编译二进制。
    # 本项目 lockfile 中没有任何包依赖 install/postinstall 脚本，跳过是安全的。
    && npm ci --ignore-scripts --replace-registry-host=always --no-audit --no-fund \
    # 需要源码构建时（INSTALL_BUILD_TOOLS=true）再显式重建这一个包
    && if [ "$INSTALL_BUILD_TOOLS" = "true" ]; then npm rebuild better-sqlite3 --build-from-source; fi

# ---------- 2. 构建阶段 ----------
FROM ${BASE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 构建期把 SQLite 指到临时目录：既不碰真实数据目录，也不让种子库混进产物
ENV KB_DATA_DIR=/tmp/kb-build-data

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
    # 兜底：万一有旧产物残留种子库，删掉（被 volume 覆盖且会拖大镜像）
    && rm -rf /app/.next/standalone/data \
    # 裁掉 devDependencies（typescript 等），只留运行期依赖
    && npm prune --omit=dev

# ---------- 3. 运行阶段 ----------
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Shanghai

# standalone 产物（自带 server.js，含 Next 追踪出来的运行时依赖）
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# 原生模块兜底：better-sqlite3 及其全平台 .node（含 linux-x64）仅约 17MB，
# 不必再塞整份 node_modules（279MB）——实测 standalone 追踪已能带出该模块。
COPY --from=builder --chown=node:node /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# SQLite 数据目录（运行时自动建库并写入种子数据；需持久化挂载）
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3100
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
