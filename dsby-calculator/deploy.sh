#!/usr/bin/env bash
# =============================================================
# 打水计算器 · 一键更新部署脚本
#
# 用法（在项目根目录执行）：
#   chmod +x deploy.sh && ./deploy.sh
#
# 流程：备份数据 → 打旧镜像快照 → 拉取并重建镜像 → 重启容器
#       → 健康检查 → 失败自动回滚到上一版镜像
#
# 说明：./data 是 SQLite 数据目录（已挂载进容器），本脚本会先备份再重建，
#       正常情况下数据不会丢失。
# =============================================================
set -uo pipefail

cd "$(dirname "$0")"

SERVICE="dsby-calculator"
IMAGE="dsby-calculator:latest"
PREV_IMAGE="dsby-calculator:prev"
PORT="${DEPLOY_PORT:-82}"
TIMEOUT_SEC="${DEPLOY_TIMEOUT:-90}"

log() { printf '\n\033[1;34m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
err() { printf '  \033[31m✗ %s\033[0m\n' "$*" >&2; }

# 探活：不依赖 curl，直接用 node（容器内外的 Node 版本均 >= 22）
probe() {
  node -e "require('http').get('http://127.0.0.1:${PORT}${1:-/api/me}',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))" >/dev/null 2>&1
}

rollback() {
  log "回滚到上一版镜像"
  docker tag "$PREV_IMAGE" "$IMAGE" 2>/dev/null || true
  $DC up -d 2>&1 | tail -5
  if probe "/auth"; then
    ok "回滚成功，服务已恢复"
    exit 1
  fi
  err "回滚后仍不可用，请手动排查：$DC logs -f"
  exit 1
}

# ---------- 0. 前置检查 ----------
log "前置检查"
command -v docker >/dev/null 2>&1 || { err "未找到 docker 命令，请先安装 Docker / Docker Compose"; exit 1; }
command -v node >/dev/null 2>&1 || { err "未找到 node（探活脚本需要 Node.js）"; exit 1; }

# Compose 命令：优先 docker compose v2，回退 docker-compose v1
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
  ok "检测到 docker-compose（独立二进制），将自动降级兼容"
  # 常见连带故障：v2 插件动态库/执行位坏了，docker compose 用不了（WARNING: Plugin ... permission denied）
  PLUGIN="${HOME:-/root}/.docker/cli-plugins/docker-compose"
  if [ -e "$PLUGIN" ] && [ ! -x "$PLUGIN" ]; then
    printf '  \033[33m!\033[0m v2 插件缺执行位，已自动降级到 docker-compose；想恢复：chmod 755 %s\n' "$PLUGIN"
  fi
else
  err "未找到 docker compose (v2) 或 docker-compose (v1)，请安装 Docker Compose"
  exit 1
fi

# ---------- 0b. Docker 守护进程可达性 ----------
# 认知前提：「daemon 没起来」和「daemon 在跑、CLI 却连不上（socket 层）」是两回事。
# 后者 journalctl 里是一整段成功日志（Started docker.service / API listen on ...），
# 只有 socket 文件、权限、DOCKER_HOST 这些事实才对得上，盲翻 journalctl 是死路。
# 因此：先摆事实 → 自动重启单元重建 socket 重试 → 再给对症分支。
DOCKER_OUT="$(docker info 2>&1)" && DOCKER_OK=1 || DOCKER_OK=0

if [ "${DOCKER_OK:-0}" -eq 1 ]; then
  ok "环境检查通过（docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) · compose $(docker compose version --short 2>/dev/null || docker-compose --version 2>/dev/null)）"
else
  err "无法连接 Docker 守护进程（unix:///var/run/docker.sock）"
  echo
  echo "  docker 报的原文："
  printf '%s\n' "$DOCKER_OUT" | tail -3 | sed 's/^/    /'
  echo
  echo "  现场事实："
  echo "    docker 命令          $(command -v docker 2>/dev/null || echo 未找到)"
  echo "    dockerd 进程数       $(pgrep -c dockerd 2>/dev/null | head -1 || echo 0)"
  echo "    DOCKER_HOST          ${DOCKER_HOST:-（未设置）}"
  echo "    当前用户             $(id -un 2>/dev/null) (uid $(id -u 2>/dev/null))"
  echo "    存在的 socket："
  for s in /var/run/docker.sock /run/docker.sock "${XDG_RUNTIME_DIR:-/run/user/0}/docker.sock"; do
    if [ -e "$s" ]; then
      echo "      ✓ $s  $(ls -l "$s" 2>/dev/null | awk '{print $1, $3":"$4}')"
    else
      echo "      ✗ $s  (不存在)"
    fi
  done

  # 自动重试：systemd 环境下重启单元重建 socket（socket 被删但 dockerd 还活着时最有效）
  HAS_SYSTEMD=0
  [ -s /run/systemd/system ] && HAS_SYSTEMD=1
  if [ "$HAS_SYSTEMD" -eq 1 ] && [ "$(id -u 2>/dev/null)" = "0" ]; then
    echo
    log "自动重启 docker 单元以重建 socket"
    systemctl restart docker 2>&1 | tail -2
    sleep 6
    if ! docker info >/dev/null 2>&1; then
      systemctl restart docker.socket docker.service 2>&1 | tail -2
      sleep 6
    fi
  fi

  if ! docker info >/dev/null 2>&1; then
    echo
    echo "  按现场事实对症（从上往下试，每跑一条都 docker info 确认一次）："
    echo "    ① socket 文件不存在   systemctl restart docker.socket docker.service ; sleep 5 ; docker info"
    echo "       想彻底绕开 socket 激活的坑："
    echo "         systemctl disable docker.socket && systemctl enable docker && systemctl restart docker && sleep 5"
    echo "    ② 报 permission denied  usermod -aG docker $(id -un 2>/dev/null) && newgrp docker ; docker info"
    echo "    ③ DOCKER_HOST 被设错     unset DOCKER_HOST ; docker context show"
    echo "    ④ CLI 是 snap 版         command -v docker 是否 /snap/bin/docker，是则换 apt 官方版更稳"
    echo "    ⑤ 以上都不对           sudo journalctl -u docker -n 30 --no-pager"
    echo
    exit 1
  fi
  ok "socket 已恢复，继续部署"
fi

# ---------- 1. 备份数据库 ----------
log "备份 SQLite 数据目录 ./data"
BACKUP_DIR="_backup/$(date '+%Y%m%d-%H%M%S')"
mkdir -p "$BACKUP_DIR"
if [ -d data ]; then
  cp -a data/. "$BACKUP_DIR"/ && ok "已备份到 $BACKUP_DIR" || err "备份失败，仍继续（数据卷为独立挂载，容器删除不影响）"
else
  ok "本机无 ./data 目录（首次部署），跳过备份"
fi

# ---------- 2. 给当前镜像打快照，供回滚使用 ----------
log "记录当前镜像版本"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker tag "$IMAGE" "$PREV_IMAGE" && ok "旧镜像已存为 $PREV_IMAGE"
else
  ok "无历史镜像（首次部署），跳过快照"
fi

# ---------- 3. 停旧容器 ----------
log "停止旧容器"
$DC down 2>&1 | tail -3
ok "旧容器已停止"

# ---------- 4. 构建新镜像 ----------
log "构建新镜像（首次约 2–5 分钟）"
if $DC build --pull 2>&1 | tail -20; then
  ok "镜像构建完成"
else
  err "构建失败"
  rollback
fi

# ---------- 5. 启动新容器 ----------
log "启动新容器"
$DC up -d 2>&1 | tail -5

# ---------- 6. 健康检查 ----------
log "健康检查（最多等 ${TIMEOUT_SEC}s）"
DEADLINE=$(( $(date +%s) + TIMEOUT_SEC ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if probe "/auth"; then
    ok "服务已就绪"
    break
  fi
  sleep 3
done

if ! probe "/auth"; then
  err "服务在超时时间内未就绪"
  $DC logs --tail 40
  rollback
fi

# ---------- 7. 路由冒烟（未登录应可访问 / 自动跳登录页） ----------
log "路由冒烟检查"
fail=0
for p in /auth /profile /score /admin/login; do
  if probe "$p"; then
    ok "$p 可访问"
  else
    err "$p 探测失败"
    fail=1
  fi
done

log "部署完成"
echo "  地址：http://<服务器IP>:${PORT}"
echo "  比分表：http://<服务器IP>:${PORT}/score"
if [ "$fail" -eq 1 ]; then
  err "有路由异常，请检查：$DC logs -f"
  exit 1
fi
exit 0
