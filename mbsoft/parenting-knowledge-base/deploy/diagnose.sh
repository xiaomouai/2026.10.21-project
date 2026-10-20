#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 好宝宝育儿知识库 —— 部署连通性一键诊断
#
# 症状：容器日志显示 "✓ Ready in 52ms" 但浏览器访问不了。
# 用途：从上到下逐层打通，定位到底断在哪一层。
#
# 用法（在服务器上，项目根目录执行）：
#   bash deploy/diagnose.sh
#   KB_HOST_PORT=3100 bash deploy/diagnose.sh     # 自定义端口
# ---------------------------------------------------------------------------
set -uo pipefail

PORT="${KB_HOST_PORT:-3100}"        # 应用原端口（Nginx 的 upstream）
HTTP_PORT="${KB_HTTP_PORT:-80}"     # 域名 HTTP 直连端口（浏览器默认）
CONTAINER="${CONTAINER:-parenting-kb}"
DOMAIN="${DOMAIN:-baby.mingboai.com}"

ok()   { printf '  \033[32m✅ %s\033[0m\n' "$1"; }
bad()  { printf '  \033[31m❌ %s\033[0m\n' "$1"; }
warn() { printf '  \033[33m⚠️  %s\033[0m\n' "$1"; }
head2(){ printf '\n\033[1m%s\033[0m\n' "$1"; }

# 取两个空格分隔字段的辅助
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null || echo '000'; }

echo "=============================================================="
echo " 育儿知识库 · 连通性诊断   (端口 ${PORT} / 容器 ${CONTAINER})"
echo "=============================================================="

# ---------- 1. 容器是否在跑 ----------
head2 "[1] 容器运行状态"
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
    ok "容器 ${CONTAINER} 正在运行"
    docker ps --filter "name=${CONTAINER}" --format '     状态: {{.Status}}'
  else
    bad "容器 ${CONTAINER} 未在运行"
    docker ps -a --format '     - {{.Names}}  [{{.Status}}]' 2>/dev/null | head -5
    # 最常见的启动失败原因：80 被 Web 服务器占着，容器抢不到
    OWN80=$(ss -tlnp 2>/dev/null | grep ':80 ' | head -1)
    if [ -n "${OWN80}" ]; then
      warn "80 端口已被占用 —— 极可能就是启动失败的原因："
      echo "     ${OWN80}"
      echo '     → 容器不能占 80：注释掉 docker-compose.yml 的 "${KB_HTTP_PORT:-80}:3100" 行，'
      echo "       改用该 Web 服务器反代 80 → 127.0.0.1:${PORT}（见 deploy/nginx/）"
      echo '       宝塔面板：网站 → 设置 → 反向代理 → 目标 URL http://127.0.0.1:3100'
    fi
    echo "     → 看日志：docker compose logs --tail=30"
  fi
else
  warn "未安装 docker 命令，跳过容器检查（是否直接在宿主机跑 node server.js？）"
fi

# ---------- 2. 端口映射 ----------
head2 "[2] 端口映射（宿主机 ↔ 容器 3100）"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  MAP=$(docker port "${CONTAINER}" 3100 2>/dev/null | head -4)
  if [ -n "${MAP}" ]; then
    echo "${MAP}" | sed 's/^/     /'
    if echo "${MAP}" | grep -q "^0\.0\.0\.0:${HTTP_PORT}\|^\[::\]:${HTTP_PORT}"; then
      ok "已映射 ${HTTP_PORT} → 域名 http://${DOMAIN} 可直接访问"
    else
      warn "未映射 ${HTTP_PORT} —— http://${DOMAIN} 打不开（浏览器默认走 80）"
      echo "     → 修复：docker compose up -d（compose 已默认 ${KB_HTTP_PORT:-80}:3100）"
    fi
    if echo "${MAP}" | grep -q "^127\.0\.0\.1:${PORT}\$"; then
      warn "${PORT} 只听回环 —— 外网 http://服务器IP:${PORT} 超时（Nginx 模式下这是正常的）"
    fi
  else
    bad "未查到 3100 的端口映射"
    echo "     → 检查 docker-compose.yml 的 ports 段"
  fi
fi

# ---------- 2b. 80 端口是否被别人占用 ----------
if command -v ss >/dev/null 2>&1; then
  OWNER=$(ss -tlnp 2>/dev/null | grep ":${HTTP_PORT} " | head -1)
  if [ -n "${OWNER}" ]; then
    if echo "${OWNER}" | grep -q 'docker\|containerd'; then
      ok "${HTTP_PORT} 由 docker 占用（预期，就是本应用）"
    else
      warn "${HTTP_PORT} 被其他进程占用，容器会启动失败："
      echo "     ${OWNER}"
      echo "     → 常见于宿主机已装 Nginx/Apache；用 Nginx 反代即可，"
      echo "       并注释掉 compose 里的 KB_HTTP_PORT 那一行"
    fi
  else
    warn "宿主机 ${HTTP_PORT} 无人监听 —— 容器没起来或没映射 80"
  fi
fi

# ---------- 3. 容器内自测 ----------
head2 "[3] 应用自身（容器内）"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  IN_CODE=$(docker exec "${CONTAINER}" node -e "fetch('http://127.0.0.1:${PORT}/').then(r=>console.log(r.status)).catch(()=>console.log('000'))" 2>/dev/null)
  if [ "${IN_CODE}" = "200" ]; then
    ok "容器内 HTTP ${IN_CODE} —— 应用本身正常（问题在容器外）"
  else
    bad "容器内返回 ${IN_CODE} —— 应用未就绪，看日志：docker compose logs --tail=50"
  fi
fi

# ---------- 4. 宿主机回环 ----------
head2 "[4] 宿主机回环 127.0.0.1:${PORT}"
C1=$(code "http://127.0.0.1:${PORT}/")
if [ "${C1}" = "200" ]; then ok "HTTP 200"; else bad "HTTP ${C1}（000=连不上）"; fi

# ---------- 5. 域名访问（走 80，最接近真实用户） ----------
head2 "[5] 域名 HTTP 访问 http://${DOMAIN}"
CD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: ${DOMAIN}" "http://127.0.0.1:${HTTP_PORT}/" 2>/dev/null || echo '000')
if [ "${CD}" = "200" ]; then
  ok "${DOMAIN} → HTTP 200（域名直连可用）"
else
  bad "${DOMAIN} → HTTP ${CD}"
  echo "     → 依次排查：容器是否映射 80、DNS 是否指向本机、安全组是否放行 80"
fi

# ---------- 5b. 宿主机内网 IP ----------
head2 "[5b] 宿主机内网 IP:${PORT}"
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "${LAN_IP}" ]; then
  C2=$(code "http://${LAN_IP}:${PORT}/")
  if [ "${C2}" = "200" ]; then ok "HTTP 200 via ${LAN_IP}"; else bad "HTTP ${C2} via ${LAN_IP} —— 端口未对外网卡开放"; fi
else
  warn "取不到内网 IP"
fi

# ---------- 6. 实际监听地址 ----------
head2 "[6] 宿主机实际监听情况"
if command -v ss >/dev/null 2>&1; then
  LISTEN=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | head -3)
  if [ -n "${LISTEN}" ]; then
    echo "${LISTEN}" | sed 's/^/     /'
    echo "${LISTEN}" | grep -q '127.0.0.1:'"${PORT}" && warn "仅监听回环" || ok "监听地址对外开放"
  else
    bad "宿主机没有进程监听 ${PORT}"
  fi
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep ":${PORT} " | sed 's/^/     /' | head -3
fi

# ---------- 7. 防火墙 ----------
head2 "[7] 防火墙 / 安全组"
if command -v ufw >/dev/null 2>&1; then
  UFW=$(ufw status 2>/dev/null | head -1)
  echo "     ufw: ${UFW}"
  if echo "${UFW}" | grep -q 'active'; then
    ufw status 2>/dev/null | grep -E "${PORT}|80|443|Nginx" | sed 's/^/     /' || warn "ufw 已开启但未放行 ${PORT} / 80 / 443"
  fi
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --list-ports 2>/dev/null | sed 's/^/     firewalld ports: /'
else
  warn "未检测到 ufw/firewalld"
fi
warn "云服务器还需在控制台『安全组』放行：直接访问放 ${PORT}；走 Nginx 放 80/443"

# ---------- 8. Nginx ----------
head2 "[8] Nginx 反代"
if command -v nginx >/dev/null 2>&1; then
  if systemctl is-active --quiet nginx 2>/dev/null || pgrep -x nginx >/dev/null 2>&1; then
    ok "Nginx 运行中"
    [ -f /etc/nginx/conf.d/${DOMAIN}.conf ] && ok "已加载 ${DOMAIN}.conf" \
      || warn "未找到 /etc/nginx/conf.d/${DOMAIN}.conf（需 cp deploy/nginx/*.conf 过去）"
    nginx -t 2>&1 | tail -2 | sed 's/^/     /'
  else
    warn "已安装但未启动：sudo systemctl start nginx"
  fi
else
  warn "未安装 Nginx —— 此时只能 http://服务器IP:${PORT} 访问（需放行 ${PORT}）"
fi

# ---------- 9. DNS ----------
head2 "[9] 域名解析 ${DOMAIN}"
if command -v dig >/dev/null 2>&1; then
  DNS_IP=$(dig +short "${DOMAIN}" 2>/dev/null | tail -1)
elif command -v nslookup >/dev/null 2>&1; then
  DNS_IP=$(nslookup "${DOMAIN}" 2>/dev/null | awk '/^Address: /{print $2}' | tail -1)
else
  DNS_IP=""
fi
PUB_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || curl -s --max-time 5 http://ifconfig.me 2>/dev/null)
if [ -n "${DNS_IP}" ]; then
  echo "     ${DOMAIN} → ${DNS_IP}"
  [ -n "${PUB_IP}" ] && echo "     本机公网 IP → ${PUB_IP}"
  [ "${DNS_IP}" = "${PUB_IP}" ] && ok "解析已指向本机" || warn "解析与本机公网 IP 不一致（DNS 未生效或指向别处）"
else
  warn "解析不到 ${DOMAIN} —— 需到域名服务商加 A 记录指向 ${PUB_IP}"
fi

# ---------- 结论 ----------
head2 "================= 结论 ================="
echo " 目标：http://${DOMAIN} （以及 https://${DOMAIN}）可访问"
echo
if [ "${CD:-000}" = "200" ]; then
  ok "域名直连已通（走 ${HTTP_PORT}）。"
  echo "  下一步上 HTTPS："
  echo "    sudo apt install -y nginx certbot python3-certbot-nginx"
  echo "    sudo cp deploy/nginx/${DOMAIN}.conf /etc/nginx/conf.d/"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
  echo "    sudo certbot --nginx -d ${DOMAIN}"
  echo "  ⚠️ 上 Nginx 前先让出 80：注释 compose 的 KB_HTTP_PORT 行，再 docker compose up -d"
elif [ "${C1:-000}" != "200" ]; then
  echo " 回环都不可达 → 应用或映射有问题。看日志："
  echo "     docker compose logs --tail=50"
elif [ "${C2:-000}" != "200" ]; then
  echo " 容器内正常、回环可达、但网卡 IP 不可达 → 只绑了回环。修复："
  echo "     echo 'KB_HOST_PORT=${PORT}' >> .env && docker compose up -d"
else
  echo " 本机各层可达，域名仍不通 → 检查 DNS 解析与云安全组（放行 80）。"
fi
echo
echo " 说明：443 不能直接映射给容器（容器内是纯 HTTP，映射后 https 握手必失败），"
echo "       HTTPS 必须由 Nginx 终结 TLS 再反代到 ${PORT}。"
echo "=============================================================="
