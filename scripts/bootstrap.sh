#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_SCRIPT="${ROOT_DIR}/scripts/deploy.js"

print_step() {
  printf "\n[%s] %s\n" "$1" "$2"
}

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

print_step "步骤 2/3" "检测运行环境"

if [ -z "${node_path}" ]; then
  echo "  · 未检测到 Node 22+，准备自动安装运行环境"
  bash "${ROOT_DIR}/scripts/install-openclaw-runtime.sh"
  node_path="$(find_node || true)"
fi

if [ -z "${node_path}" ]; then
  echo "自动安装后仍未找到 node，请重新打开终端后再执行本脚本。"
  exit 1
fi

node_major="$("${node_path}" -p 'process.versions.node.split(".")[0]')"

if [ "${node_major}" -lt 22 ]; then
  echo "  · 当前 Node 版本低于 22，准备自动升级运行环境"
  bash "${ROOT_DIR}/scripts/install-openclaw-runtime.sh"
  node_path="$(find_node || true)"
  node_major="$("${node_path}" -p 'process.versions.node.split(".")[0]')"
fi

print_step "步骤 3/3" "启动部署向导"
echo "  ✓ Node.js ${node_major} 已就绪"

# 通过 curl | bash 运行时，stdin 会变成已结束的 pipe，这里只在当前会话确实绑定终端时再接回 tty。
if [ ! -t 0 ] && [ -t 1 ] && [ -r /dev/tty ]; then
  exec </dev/tty
fi

exec "${node_path}" "${TARGET_SCRIPT}" "$@"
