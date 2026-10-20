#!/usr/bin/env bash
# =============================================================
# 打水计算器 · Docker 守护进程修复脚本
#
# 覆盖两类故障：
#   A. 守护进程没起（dockerd 起不来，常见 iptables 后端冲突）
#   B. 守护进程在跑但 CLI 连不上（dockerd 活着，socket 缺失/路径不一致/权限）
#      典型报错：docker info 或 docker-compose up 报
#      Cannot connect to the Docker daemon at unix:///var/run/docker.sock
#
# 用法（root 执行）：
#       sudo bash docker-fix.sh
#
# 安全说明：
#   - 不删除任何数据、不动 ./data、不清 iptables 规则
#   - 只有在 dockerd 确认起不来时才动 iptables 后端
#   - 只在确认 socket 激活有问题时才 disable docker.socket
# =============================================================
set -uo pipefail

hr() { printf '\n\033[1;34m──── %s ────\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() { printf '  \033[31m✗ %s\033[0m\n' "$*" >&2; }
info() { printf '  · %s\n' "$*"; }

hr "0. 环境确认"
[ "$(id -u)" -eq 0 ] || { die "请用 root 或 sudo 执行：sudo bash docker-fix.sh"; exit 1; }
command -v dockerd >/dev/null 2>&1 || { die "未找到 dockerd 二进制（只装了 CLI？）：apt-get install -y docker.io docker-ce"; exit 1; }
HAVE_SYSTEMCTL=1
command -v systemctl >/dev/null 2>&1 || HAVE_SYSTEMCTL=0
[ "$HAVE_SYSTEMCTL" = "1" ] && ok "root 权限、dockerd 存在、有 systemd"
[ "$HAVE_SYSTEMCTL" = "0" ] && warn "无 systemd，将直接走手动拉起分支"

hr "1. 守护进程是否在跑 + CLI 是否连得上"
# systemctl is-active 既打印状态又返回非 0（inactive 时退 3），直接套 || 会拼成 "inactive unknown"
SYS_RAW=$(systemctl is-active docker 2>/dev/null)
SYS_ACTIVE=$(printf '%s' "$SYS_RAW" | head -1)
[ -z "$SYS_ACTIVE" ] && SYS_ACTIVE="unknown"
info "systemctl is-active docker = $SYS_ACTIVE"
[ "$SYS_ACTIVE" = "active" ] || hr "1B·预备：守护进程未激活，稍后走第 2 步前台实跑"

if [ "$SYS_ACTIVE" = "active" ]; then
  systemctl status docker --no-pager 2>&1 | head -6
  if docker info >/dev/null 2>&1; then
    ok "CLI 已连上守护进程，无需修复"
    docker version --format '  Client: {{.Client.Version}} · Server: {{.Server.Version}}'
    exit 0
  fi
  hr "1B. 守护进程在跑但 CLI 连不上 —— 定位 socket 层"
  # 触发源：docker.socket（socket 激活）与 docker.service 并存时容易出岔子
  TRIGGERED_BY=$(systemctl show docker -p TriggeredBy --value 2>/dev/null || echo "")
  info "TriggeredBy = ${TRIGGERED_BY:-（无）}"
  [ -n "$TRIGGERED_BY" ] && warn "docker.socket 激活模式：dockerd 由 socket 触发拉起，sock 文件可能被 systemd 接管/清掉"

  XDG_RT="${XDG_RUNTIME_DIR:-/run/user/0}"
  SOCK_LIST="/var/run/docker.sock /run/docker.sock $HOME/.docker/run/docker.sock $XDG_RT/docker.sock"
  echo
  echo "  ── 事实采集 ──"
  SOCK_OK=""
  for s in $SOCK_LIST; do
    [ -z "$s" ] && continue
    if [ -S "$s" ]; then
      [ -z "$SOCK_OK" ] && SOCK_OK="$s"
      info "socket 存在: $s  $(ls -l "$s" 2>/dev/null | awk '{print $1, $3":"$4}')"
    elif [ -e "$s" ]; then
      info "注意: $s 存在但不是 socket: $(file -b "$s" 2>/dev/null || echo unknown)"
    else
      info "socket 缺失: $s"
    fi
  done
  CLI_PATH=$(command -v docker 2>/dev/null || echo "(未找到)")
  info "docker CLI 路径: $CLI_PATH"
  case "$CLI_PATH" in
    /snap/*) warn "这是 snap 版 CLI（沙箱约束下可能读不到 /var/run/docker.sock）；建议用 apt 装 docker-ce 或改用 /usr/bin/docker" ;;
    /usr/*|/bin/docker) info "CLI 为系统包安装版，正常" ;;
    *) info "CLI 在非常规路径，请确认 PATH 是否指向预期版本" ;;
  esac
  info "DOCKER_HOST = ${DOCKER_HOST:-（未设置，走默认 unix:///var/run/docker.sock）}"
  info "docker context = $(docker context show 2>/dev/null || echo '(取不到)')"
  DOCKERD_CMD=$(ps -o args= -C dockerd 2>/dev/null | head -1)
  info "dockerd 命令行: ${DOCKERD_CMD:-(取不到)}"
  echo "$DOCKERD_CMD" | grep -q -- "-H\|--host\|--socket" \
    && warn "dockerd 显式指定了监听路径，-H/--host 与 CLI 默认路径不一致是典型原因" \
    || info "dockerd 未指定 -H，默认应监听 unix:///var/run/docker.sock"

  # ---- 对症修复 ----
  echo
  if [ -n "${DOCKER_HOST:-}" ]; then
    warn "检测到 DOCKER_HOST=$DOCKER_HOST，会让 CLI 连到非默认地址"
    [ "${DOCKER_HOST#unix://}" != "$DOCKER_HOST" ] && info "确为 unix socket：请执行 unset DOCKER_HOST 后重跑 ./deploy.sh"
  fi

  if [ -z "$SOCK_OK" ]; then
    ok "结论：dockerd 在跑，但默认 socket 文件不存在 → 去掉 socket 激活、重启服务重建 socket"
    systemctl stop docker.socket >/dev/null 2>&1 && info "已 stop docker.socket"
    systemctl disable docker.socket >/dev/null 2>&1 && ok "已 disable docker.socket（socket 激活模式与 service 并存易出问题）"
    systemctl restart docker >/dev/null 2>&1 && info "已 restart docker"
    sleep 5
    systemctl enable docker >/dev/null 2>&1
    if docker info >/dev/null 2>&1; then
      ok "修复成功，CLI 已连上守护进程"
      docker version --format '  Client: {{.Client.Version}} · Server: {{.Server.Version}}'
      exit 0
    fi
  else
    # 注意：docker info 本身退出非 0，直接管道给 grep 会被 pipefail 带偏，先收进变量
    PERM_MSG=$(docker info 2>&1 || true)
    if printf '%s' "$PERM_MSG" | grep -qi "permission denied"; then
      ok "结论：socket 存在但权限/属主不对"
      usermod -aG docker root >/dev/null 2>&1 && info "已把 root 加入 docker 组（需新开 shell 才生效）"
      chown root:docker "$SOCK_OK" 2>/dev/null && info "已修正 socket 属主: $SOCK_OK → root:docker"
      chmod 660 "$SOCK_OK" 2>/dev/null && info "已修正 socket 权限 → 660"
      systemctl restart docker >/dev/null 2>&1
      sleep 4
      if docker info >/dev/null 2>&1; then
        ok "权限修复后已连通"; docker version --format '  Server: {{.Server.Version}}'; exit 0
      fi
      warn "改完权限仍连不上，可能需要重设 context，见 1C 日志"
    else
      warn "未识别的具体报错：
$PERM_MSG" | head -6
    fi
  fi

  hr "1C. 仍连不上 —— dockerd 自己怎么说"
  systemctl status docker --no-pager 2>&1 | head -8
  journalctl -u docker -n 25 --no-pager 2>/dev/null | tail -25
  exit 1
fi

hr "2. 直接前台运行 dockerd 12 秒，看真实报错（守护进程未起时的最关键一步）"
code=0
: > /tmp/dockerd-manual.log 2>/dev/null || true
dockerd > /tmp/dockerd-manual.log 2>&1 &
DPID=$!
sleep 12
kill "$DPID" >/dev/null 2>&1
wait "$DPID" >/dev/null 2>&1
code=$?
if [ "$code" = "0" ]; then
  :
elif [ "$code" = "143" ]; then
  ok "dockerd 前台跑满 12 秒仍在运行 —— 它能正常启动，之前只是 systemd 没拉起来"
else
  msg=$(cat /tmp/dockerd-manual.log 2>/dev/null)
  warn "dockerd 启动失败（退出码 ${code:-未知}），日志如下："
  echo "$msg" | tail -20
  echo
  echo "  常见对应："
  printf '%s' "$msg" | grep -qi "iptables" \
    && echo "    → 命中 iptables 后端冲突，本脚本第 3 步会自动处理" \
    || printf '%s' "$msg" | grep -qi "still running" \
       && echo "    → 已有 dockerd 在跑（多半是 socket 激活拉起的），请走本脚本第 1B 步的 socket 分支" \
       || echo "    → 非 iptables 问题，按上面日志反馈"
fi

hr "3. 修复 iptables 后端（dockerd 起不来的头号原因：nft/legacy 混用）"
if command -v iptables >/dev/null 2>&1; then
  update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 \
    && ok "iptables 已切到 legacy 后端（未清任何规则）" \
    || warn "切换 legacy 失败，继续下一步"
else
  echo "  正在安装 iptables（缺失会导致 dockerd 报 iptables not found）"
  (apt-get update -qq && apt-get install -y -qq iptables) >/dev/null 2>&1 \
    && ok "iptables 安装完成" \
    || die "iptables 安装失败，可能无外网或源有问题，请先手动：apt-get install -y iptables"
fi

hr "4. 拉起服务"
systemctl unmask docker containerd >/dev/null 2>&1
systemctl daemon-reload >/dev/null 2>&1
if command -v containerd >/dev/null 2>&1; then
  systemctl enable --now containerd >/dev/null 2>&1 && ok "containerd 已启动" || warn "containerd 启动异常"
fi
systemctl enable --now docker >/dev/null 2>&1
sleep 4
systemctl status docker --no-pager 2>&1 | head -6

hr "5. 最终判定"
if docker info >/dev/null 2>&1; then
  ok "Docker 守护进程已就绪！现在可以执行：./deploy.sh"
  docker version --format '  Client: {{.Client.Version}}
  Server: {{.Server.Version}}'
  exit 0
fi

die "守护进程仍未起来。请贴出下面这段日志，可精确定位："
echo
echo "  journalctl -u docker -n 30 --no-pager"
echo "  ---------- 日志原文 ----------"
journalctl -u docker -n 30 --no-pager 2>/dev/null | tail -30
exit 1
