#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { buildShellEnv } from "../core.js";

const OPENCLAW_PACKAGE_NAME = "openclaw";
const WEIXIN_PLUGIN_ID = "openclaw-weixin";
const REQUIRED_OPENCLAW_MODULE = "openclaw/plugin-sdk/channel-config-schema";
const WEIXIN_INSTALLER_SPEC = process.env.CLAW_DEPLOY_WEIXIN_INSTALLER || "@tencent-weixin/openclaw-weixin-cli@latest";

function log(message) {
  console.log(`[openclaw-weixin] ${message}`);
}

function normalizePathForCompare(targetPath) {
  return path.resolve(targetPath).replace(/[\\/]+$/u, "");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getOpenClawHome() {
  return process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
}

function getWeixinPluginRoot() {
  const extensionsDir = process.env.OPENCLAW_EXTENSIONS_DIR || path.join(getOpenClawHome(), "extensions");
  return path.join(extensionsDir, WEIXIN_PLUGIN_ID);
}

function extractPackageRootFromPath(targetPath) {
  const normalized = path.normalize(targetPath);
  const marker = `${path.sep}node_modules${path.sep}${OPENCLAW_PACKAGE_NAME}`;
  const index = normalized.lastIndexOf(marker);

  if (index === -1) {
    return "";
  }

  return normalized.slice(0, index + marker.length);
}

async function isValidOpenClawPackageRoot(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    return false;
  }

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    return packageJson.name === OPENCLAW_PACKAGE_NAME;
  } catch {
    return false;
  }
}

async function runCommand(command, args, options = {}) {
  const {
    env = process.env,
    allowFailure = false,
    shell = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (allowFailure) {
        resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
        return;
      }

      reject(error);
    });

    child.on("close", (code) => {
      const result = { code: code ?? 0, stdout, stderr };

      if ((code ?? 0) !== 0 && !allowFailure) {
        const error = new Error(stderr || stdout || `${command} exited with code ${code}`);
        error.result = result;
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

async function runStreamingCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if ((code ?? 0) !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function resolvePackageRootFromExecutablePath(executablePath, visited = new Set()) {
  const normalizedPath = normalizePathForCompare(executablePath);

  if (visited.has(normalizedPath)) {
    return "";
  }

  visited.add(normalizedPath);

  const resolvedPath = await fs.realpath(executablePath).catch(() => executablePath);
  const directPackageRoot = extractPackageRootFromPath(resolvedPath) || extractPackageRootFromPath(executablePath);

  if (directPackageRoot && (await isValidOpenClawPackageRoot(directPackageRoot))) {
    return directPackageRoot;
  }

  const nearbyCandidates = [
    path.resolve(path.dirname(resolvedPath), ".."),
    path.resolve(path.dirname(resolvedPath), "..", "node_modules", OPENCLAW_PACKAGE_NAME),
    path.resolve(path.dirname(resolvedPath), "..", "lib", "node_modules", OPENCLAW_PACKAGE_NAME),
  ];

  for (const candidate of nearbyCandidates) {
    if (await isValidOpenClawPackageRoot(candidate)) {
      return candidate;
    }
  }

  if (!(await pathExists(executablePath))) {
    return "";
  }

  const rawContent = await fs.readFile(executablePath, "utf8").catch(() => "");

  if (!rawContent) {
    return "";
  }

  // 兼容 bootstrap.sh 里生成的 openclaw shim：exec "/actual/path/openclaw" "$@"
  const shimTarget = rawContent.match(/exec\s+"([^"]+openclaw[^"]*)"\s+"\$@"/u)?.[1];
  if (shimTarget) {
    return resolvePackageRootFromExecutablePath(shimTarget, visited);
  }

  return "";
}

async function listOpenClawExecutableCandidates(env) {
  const candidates = new Set();

  if (process.platform === "win32") {
    for (const binaryName of ["openclaw.cmd", "openclaw.exe", "openclaw.ps1"]) {
      candidates.add(path.join(os.homedir(), ".claw-deploy", "bin", binaryName));
    }
  } else {
    for (const binaryPath of [
      path.join(os.homedir(), ".local", "bin", "openclaw"),
      path.join(os.homedir(), ".npm-global", "bin", "openclaw"),
      path.join(os.homedir(), ".openclaw", "bin", "openclaw"),
    ]) {
      candidates.add(binaryPath);
    }
  }

  const prefixResult = await runCommand("npm", ["prefix", "-g"], { env, allowFailure: true });
  const npmPrefix = prefixResult.stdout.trim();

  if (npmPrefix) {
    if (process.platform === "win32") {
      for (const binaryName of ["openclaw.cmd", "openclaw.exe", "openclaw.ps1"]) {
        candidates.add(path.join(npmPrefix, binaryName));
      }
      candidates.add(path.join(npmPrefix, "node_modules", OPENCLAW_PACKAGE_NAME));
    } else {
      candidates.add(path.join(npmPrefix, "bin", "openclaw"));
      candidates.add(path.join(npmPrefix, "lib", "node_modules", OPENCLAW_PACKAGE_NAME));
    }
  }

  const lookupResult =
    process.platform === "win32"
      ? await runCommand("where.exe", ["openclaw"], { env, allowFailure: true })
      : await runCommand("bash", ["-lc", "type -a -p openclaw"], { env, allowFailure: true });

  for (const line of `${lookupResult.stdout}\n${lookupResult.stderr}`.split(/\r?\n/u)) {
    const candidate = line.trim();
    if (candidate) {
      candidates.add(candidate);
    }
  }

  return Array.from(candidates);
}

async function findHostOpenClawPackageRoot(env) {
  const explicitRoot = process.env.OPENCLAW_PACKAGE_ROOT;
  if (explicitRoot && (await isValidOpenClawPackageRoot(explicitRoot))) {
    return explicitRoot;
  }

  const executableCandidates = await listOpenClawExecutableCandidates(env);

  for (const candidate of executableCandidates) {
    if (await isValidOpenClawPackageRoot(candidate)) {
      return candidate;
    }

    const resolvedRoot = await resolvePackageRootFromExecutablePath(candidate);
    if (resolvedRoot) {
      return resolvedRoot;
    }
  }

  return "";
}

async function ensurePluginLinksHostOpenClaw(pluginRoot, hostPackageRoot) {
  const nodeModulesRoot = path.join(pluginRoot, "node_modules");
  const openclawLinkPath = path.join(nodeModulesRoot, OPENCLAW_PACKAGE_NAME);

  await fs.mkdir(nodeModulesRoot, { recursive: true });

  if (await pathExists(openclawLinkPath)) {
    const currentTarget = await fs.realpath(openclawLinkPath).catch(() => "");

    if (currentTarget && normalizePathForCompare(currentTarget) === normalizePathForCompare(hostPackageRoot)) {
      return { changed: false, reason: "already-linked", linkPath: openclawLinkPath };
    }

    const stats = await fs.lstat(openclawLinkPath);
    if (!stats.isSymbolicLink()) {
      return { changed: false, reason: "occupied", linkPath: openclawLinkPath };
    }

    await fs.unlink(openclawLinkPath);
  }

  await fs.symlink(hostPackageRoot, openclawLinkPath, process.platform === "win32" ? "junction" : "dir");
  return { changed: true, reason: "linked", linkPath: openclawLinkPath };
}

function validatePluginResolution(pluginRoot) {
  const pluginRequire = createRequire(path.join(pluginRoot, "index.ts"));

  return {
    packageEntryPath: pluginRequire.resolve("openclaw"),
    modulePath: pluginRequire.resolve(REQUIRED_OPENCLAW_MODULE),
  };
}

async function repairWeixinPlugin(env) {
  const pluginRoot = getWeixinPluginRoot();

  if (!(await pathExists(pluginRoot))) {
    throw new Error(`未找到微信插件目录：${pluginRoot}`);
  }

  let initialValidationError = null;

  try {
    return {
      pluginRoot,
      repaired: false,
      validation: validatePluginResolution(pluginRoot),
    };
  } catch (error) {
    initialValidationError = error;
  }

  const hostPackageRoot = await findHostOpenClawPackageRoot(env);
  if (!hostPackageRoot) {
    throw new Error(
      `已安装微信插件，但无法定位宿主 openclaw 包根目录，无法修复 ${REQUIRED_OPENCLAW_MODULE} 解析失败。`,
    );
  }

  log(`检测到宿主 openclaw 包根目录: ${hostPackageRoot}`);
  const linkResult = await ensurePluginLinksHostOpenClaw(pluginRoot, hostPackageRoot);

  if (linkResult.changed) {
    log(`已补充宿主 openclaw 软链接: ${linkResult.linkPath}`);
  } else if (linkResult.reason === "occupied") {
    log(`插件目录下已存在独立的 openclaw 依赖目录，保留原状并继续校验: ${linkResult.linkPath}`);
  }

  try {
    const validation = validatePluginResolution(pluginRoot);

    return {
      pluginRoot,
      hostPackageRoot,
      repaired: linkResult.changed,
      initialValidationError,
      validation,
    };
  } catch (error) {
    const reasons = [initialValidationError?.message, error.message].filter(Boolean).join("；修复后仍失败：");
    throw new Error(
      `微信插件已安装到 ${pluginRoot}，但仍无法解析 ${REQUIRED_OPENCLAW_MODULE}。失败详情：${reasons}`,
    );
  }
}

async function main() {
  const env = await buildShellEnv();
  let installerFailed = false;

  log("正在调用官方微信安装器...");

  try {
    await runStreamingCommand("npx", ["-y", WEIXIN_INSTALLER_SPEC, "install"], env);
  } catch (error) {
    installerFailed = true;
    log(`官方安装器返回异常，准备执行宿主兼容修复并视情况重试连接：${error.message}`);
  }

  const repairResult = await repairWeixinPlugin(env);
  log(`微信插件依赖校验通过: ${repairResult.validation.modulePath}`);

  if (installerFailed || repairResult.repaired) {
    log("开始重试微信首次连接...");
    await runStreamingCommand("openclaw", ["channels", "login", "--channel", WEIXIN_PLUGIN_ID], env);
  }
}

main().catch((error) => {
  console.error(`[openclaw-weixin] ${error.message}`);
  process.exit(1);
});
