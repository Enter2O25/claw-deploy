#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_SCRIPT="${ROOT_DIR}/scripts/deploy.js"

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  if [ -x /opt/homebrew/bin/node ]; then
    echo /opt/homebrew/bin/node
    return 0
  fi

  if [ -x /usr/local/bin/node ]; then
    echo /usr/local/bin/node
    return 0
  fi

  return 1
}

node_path="$(find_node || true)"

if [ -z "${node_path}" ]; then
  echo "未检测到 Node 22+，正在调用 OpenClaw 官方安装脚本自动补齐环境..."
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
  node_path="$(find_node || true)"
fi

if [ -z "${node_path}" ]; then
  echo "自动安装后仍未找到 node，请重新打开终端后再执行本脚本。"
  exit 1
fi

node_major="$("${node_path}" -p 'process.versions.node.split(".")[0]')"

if [ "${node_major}" -lt 22 ]; then
  echo "当前 Node 版本低于 22，正在尝试通过 OpenClaw 官方安装脚本升级..."
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
fi

echo "启动 OpenClaw 极简部署向导..."
exec "${node_path}" "${TARGET_SCRIPT}" "$@"
