#!/usr/bin/env bash
set -euo pipefail

# 既支持本地仓库直接执行，也支持 curl | bash 远程拉起。
SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""

if [ -n "${SCRIPT_SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
fi

if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/scripts/bootstrap.sh" ]; then
  exec bash "${SCRIPT_DIR}/scripts/bootstrap.sh" "$@"
fi

REPOSITORY="${CLAW_DEPLOY_REPOSITORY:-Enter2O25/claw-deploy}"
REF_NAME="${CLAW_DEPLOY_REF:-main}"
INSTALL_HOME="${CLAW_DEPLOY_HOME:-${HOME}/.claw-deploy}"
ARCHIVE_URL="${CLAW_DEPLOY_ARCHIVE_URL:-https://github.com/${REPOSITORY}/archive/refs/heads/${REF_NAME}.tar.gz}"
TMP_DIR="$(mktemp -d)"
ARCHIVE_FILE="${TMP_DIR}/claw-deploy.tar.gz"
EXTRACT_DIR="${TMP_DIR}/extract"
BACKUP_DIR="${INSTALL_HOME}.backup"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

print_step() {
  printf "\n[%s] %s\n" "$1" "$2"
}

print_step "步骤 1/3" "下载并准备部署脚本"
echo "  · 仓库来源: ${REPOSITORY}@${REF_NAME}"
mkdir -p "${EXTRACT_DIR}"
curl -fsSL "${ARCHIVE_URL}" -o "${ARCHIVE_FILE}"
tar -xzf "${ARCHIVE_FILE}" -C "${EXTRACT_DIR}"

# 既兼容 GitHub 自动归档，也兼容镜像站直接把仓库根目录打进压缩包。
if [ -f "${EXTRACT_DIR}/scripts/bootstrap.sh" ]; then
  SOURCE_DIR="${EXTRACT_DIR}"
else
  SOURCE_DIR="$(find "${EXTRACT_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
fi

if [ -z "${SOURCE_DIR}" ] || [ ! -f "${SOURCE_DIR}/scripts/bootstrap.sh" ]; then
  echo "远程安装包结构不符合预期，缺少 scripts/bootstrap.sh。"
  exit 1
fi

echo "  · 准备本地安装目录"
mkdir -p "$(dirname "${INSTALL_HOME}")"

if [ -d "${BACKUP_DIR}" ]; then
  rm -rf "${BACKUP_DIR}"
fi

if [ -d "${INSTALL_HOME}" ]; then
  mv "${INSTALL_HOME}" "${BACKUP_DIR}"
fi

mv "${SOURCE_DIR}" "${INSTALL_HOME}"

echo "  ✓ 代码已安装到 ${INSTALL_HOME}"
exec bash "${INSTALL_HOME}/scripts/bootstrap.sh" "$@"
