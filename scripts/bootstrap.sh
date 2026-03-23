#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_SCRIPT="${ROOT_DIR}/scripts/deploy.js"

print_step() {
  printf "\n[%s] %s\n" "$1" "$2"
}

append_path_line_if_missing() {
  local file_path="$1"
  local export_line="$2"

  if [ ! -f "${file_path}" ]; then
    printf '%s\n' "${export_line}" >>"${file_path}"
    return
  fi

  if ! grep -Fqx "${export_line}" "${file_path}"; then
    printf '\n%s\n' "${export_line}" >>"${file_path}"
  fi
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

find_openclaw() {
  local shim_path="${HOME}/.local/bin/openclaw"
  local candidate=""

  # 跳过我们自己生成的 shim，避免二次执行时把 shim 再包成指向自身的递归入口。
  while IFS= read -r candidate; do
    if [ -n "${candidate}" ] && [ "${candidate}" != "${shim_path}" ]; then
      echo "${candidate}"
      return 0
    fi
  done < <(type -a -p openclaw 2>/dev/null || true)

  if command -v npm >/dev/null 2>&1; then
    local npm_prefix
    npm_prefix="$(npm prefix -g 2>/dev/null || true)"

    if [ -n "${npm_prefix}" ] && [ -x "${npm_prefix}/bin/openclaw" ]; then
      echo "${npm_prefix}/bin/openclaw"
      return 0
    fi
  fi

  if [ -x "${HOME}/.npm-global/bin/openclaw" ]; then
    echo "${HOME}/.npm-global/bin/openclaw"
    return 0
  fi

  if [ -x "${HOME}/.openclaw/bin/openclaw" ]; then
    echo "${HOME}/.openclaw/bin/openclaw"
    return 0
  fi

  return 1
}

ensure_openclaw_command() {
  local openclaw_path="$1"
  local shim_dir="${HOME}/.local/bin"
  local shim_path="${shim_dir}/openclaw"
  local export_line='export PATH="$HOME/.local/bin:$PATH"'

  if [ "${openclaw_path}" = "${shim_path}" ]; then
    return 0
  fi

  mkdir -p "${shim_dir}"

  # 用固定 shim 包一层，避免 npm 全局目录变动后用户还要重新找真正的 openclaw 可执行文件。
  cat >"${shim_path}" <<EOF
#!/usr/bin/env bash
exec "${openclaw_path}" "\$@"
EOF
  chmod +x "${shim_path}"

  append_path_line_if_missing "${HOME}/.profile" "${export_line}"
  append_path_line_if_missing "${HOME}/.bashrc" "${export_line}"
  append_path_line_if_missing "${HOME}/.zprofile" "${export_line}"
  append_path_line_if_missing "${HOME}/.zshrc" "${export_line}"
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

openclaw_path="$(find_openclaw || true)"
if [ -n "${openclaw_path}" ]; then
  ensure_openclaw_command "${openclaw_path}"
fi

print_step "步骤 3/3" "启动部署向导"
echo "  ✓ Node.js ${node_major} 已就绪"
if [ -n "${openclaw_path}" ]; then
  echo "  ✓ 已配置 openclaw 命令入口"
  echo "  · 如需在当前终端直接使用 openclaw，请执行: source ~/.bashrc"
fi

# 通过 curl | bash 运行时，stdin 会变成已结束的 pipe，这里只在当前会话确实绑定终端时再接回 tty。
if [ ! -t 0 ] && [ -t 1 ] && [ -r /dev/tty ]; then
  exec </dev/tty
fi

exec "${node_path}" "${TARGET_SCRIPT}" "$@"
