#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${TMPDIR:-/tmp}/claw-deploy-openclaw-install.$$.log"
KEEP_LOG=0
FRAMES=("|" "/" "-" "\\")
INSTALL_COMMAND="${CLAW_DEPLOY_OPENCLAW_INSTALL_COMMAND:-curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard}"

cleanup() {
  if [ "${KEEP_LOG}" -eq 0 ] && [ -f "${LOG_FILE}" ]; then
    rm -f "${LOG_FILE}"
  fi
}

trap cleanup EXIT

run_with_spinner() {
  local description="$1"
  shift

  : >"${LOG_FILE}"
  "$@" >"${LOG_FILE}" 2>&1 &
  local pid=$!
  local frame_index=0

  printf "  · %s " "${description}"

  # 这里轮询子进程，而不是直接透传官方输出，避免把第三方安装器的品牌信息暴露给最终用户。
  while kill -0 "${pid}" >/dev/null 2>&1; do
    local frame="${FRAMES[$frame_index]}"
    printf "\r  · %s %s" "${description}" "${frame}"
    frame_index=$(((frame_index + 1) % ${#FRAMES[@]}))
    sleep 0.2
  done

  if wait "${pid}"; then
    printf "\r  ✓ %s\n" "${description}"
    return 0
  fi

  KEEP_LOG=1
  printf "\r  ✗ %s\n" "${description}"
  echo "  · 安装失败，最近日志如下："
  tail -n 40 "${LOG_FILE}" | sed 's/^/  │ /'
  return 1
}

run_with_spinner "正在安装 Node.js / OpenClaw 运行环境" bash -lc "${INSTALL_COMMAND}"
