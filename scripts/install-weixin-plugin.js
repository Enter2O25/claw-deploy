#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { buildShellEnv, buildSpawnInvocation } from "../core.js";

const OPENCLAW_PACKAGE_NAME = "openclaw";
const WEIXIN_PLUGIN_ID = "openclaw-weixin";
const REQUIRED_OPENCLAW_MODULE = "openclaw/plugin-sdk/channel-config-schema";
const WEIXIN_PLUGIN_PACKAGE = "@tencent-weixin/openclaw-weixin";
const WEIXIN_INSTALLER_SPEC = process.env.CLAW_DEPLOY_WEIXIN_INSTALLER || "@tencent-weixin/openclaw-weixin-cli@latest";
const OPENCLAW_MIN_VERSION = { major: 2026, minor: 3, patch: 0 };
const OPENCLAW_NEW_HOST_MIN_VERSION = { major: 2026, minor: 3, patch: 22 };

function log(message) {
  console.log(`[openclaw-weixin] ${message}`);
}

function normalizePathForCompare(targetPath) {
  return path.resolve(targetPath).replace(/[\\/]+$/u, "");
}

function parseSemver(rawVersion) {
  const match = String(rawVersion || "").match(/(\d+)\.(\d+)\.(\d+)/u);

  if (!match) {
    return null;
  }

  return {
    raw: `${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
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

function getExtensionsRoot() {
  return process.env.OPENCLAW_EXTENSIONS_DIR || path.join(getOpenClawHome(), "extensions");
}

function getOpenClawConfigPath() {
  return path.join(getOpenClawHome(), "openclaw.json");
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())));
}

async function readOpenClawConfig() {
  const configPath = getOpenClawConfigPath();

  if (!(await pathExists(configPath))) {
    return {};
  }

  const content = await fs.readFile(configPath, "utf8");
  return JSON.parse(content);
}

async function writeOpenClawConfig(config) {
  const configPath = getOpenClawConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function listDiscoveredPluginIds() {
  const extensionsRoot = getExtensionsRoot();

  if (!(await pathExists(extensionsRoot))) {
    return [];
  }

  const entries = await fs.readdir(extensionsRoot, { withFileTypes: true });
  return uniqueStrings(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."))
      .map((entry) => entry.name),
  );
}

function readConfiguredAllowlist(config) {
  const allow = config?.plugins?.allow;
  return Array.isArray(allow) ? uniqueStrings(allow) : [];
}

async function setPluginsAllow(allowlist) {
  const config = await readOpenClawConfig();
  const nextConfig = { ...config };
  const nextPlugins = { ...(nextConfig.plugins || {}) };

  nextPlugins.allow = uniqueStrings(allowlist);
  nextConfig.plugins = nextPlugins;

  await writeOpenClawConfig(nextConfig);
}

async function preparePluginAllowlist() {
  const originalConfig = await readOpenClawConfig();
  const originalAllow = readConfiguredAllowlist(originalConfig);
  const discoveredPluginIds = await listDiscoveredPluginIds();
  const baselineAllow = uniqueStrings(originalAllow.length ? originalAllow : discoveredPluginIds);
  const tempAllow = uniqueStrings(baselineAllow.filter((id) => id !== WEIXIN_PLUGIN_ID));
  const wroteTempAllow = tempAllow.length > 0;

  if (wroteTempAllow) {
    await setPluginsAllow(tempAllow);
    log(`已临时写入 plugins.allow，避免安装阶段抢先自动加载微信插件: ${tempAllow.join(", ")}`);
  }

  return {
    originalHadExplicitAllow: originalAllow.length > 0,
    originalAllow,
    discoveredPluginIds,
    wroteTempAllow,
  };
}

async function finalizePluginAllowlist(state) {
  const currentDiscoveredPluginIds = await listDiscoveredPluginIds();
  const baselineAllow = state.originalHadExplicitAllow ? state.originalAllow : uniqueStrings([...state.discoveredPluginIds, ...currentDiscoveredPluginIds]);
  const finalAllow = uniqueStrings([...baselineAllow, WEIXIN_PLUGIN_ID]);

  await setPluginsAllow(finalAllow);
  log(`已写入 plugins.allow 显式信任列表: ${finalAllow.join(", ")}`);
}

async function ensureSharedHostOpenClawLink(hostPackageRoot) {
  const sharedNodeModulesRoot = path.join(getExtensionsRoot(), "node_modules");
  const sharedOpenClawLinkPath = path.join(sharedNodeModulesRoot, OPENCLAW_PACKAGE_NAME);

  await fs.mkdir(sharedNodeModulesRoot, { recursive: true });

  if (await pathExists(sharedOpenClawLinkPath)) {
    const currentTarget = await fs.realpath(sharedOpenClawLinkPath).catch(() => "");

    if (currentTarget && normalizePathForCompare(currentTarget) === normalizePathForCompare(hostPackageRoot)) {
      return { changed: false, reason: "already-linked", linkPath: sharedOpenClawLinkPath };
    }

    const stats = await fs.lstat(sharedOpenClawLinkPath);
    if (!stats.isSymbolicLink()) {
      return { changed: false, reason: "occupied", linkPath: sharedOpenClawLinkPath };
    }

    await fs.unlink(sharedOpenClawLinkPath);
  }

  await fs.symlink(hostPackageRoot, sharedOpenClawLinkPath, process.platform === "win32" ? "junction" : "dir");
  return { changed: true, reason: "linked", linkPath: sharedOpenClawLinkPath };
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
    allowFailure = false,
    ...spawnOptions
  } = options;
  const invocation = buildSpawnInvocation(command, args, spawnOptions);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      ...invocation.options,
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
  const invocation = buildSpawnInvocation(command, args, { env });

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      ...invocation.options,
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

async function detectOpenClawVersion(env) {
  const versionResult = await runCommand("openclaw", ["--version"], { env, allowFailure: true });
  const version = parseSemver(`${versionResult.stdout}\n${versionResult.stderr}`);

  if (versionResult.code !== 0 || !version) {
    throw new Error(`无法检测 openclaw 版本：${(`${versionResult.stdout}\n${versionResult.stderr}`).trim() || "无输出"}`);
  }

  return version;
}

async function installWeixinPlugin(env) {
  const explicitPluginSpec = String(process.env.CLAW_DEPLOY_WEIXIN_PLUGIN_SPEC || "").trim();

  if (explicitPluginSpec) {
    log(`使用显式指定的微信插件版本: ${explicitPluginSpec}`);
    log(`正在安装插件 ${explicitPluginSpec}...`);
    await runStreamingCommand("openclaw", ["plugins", "install", explicitPluginSpec], env);
    return { pluginSpec: explicitPluginSpec, mode: "override" };
  }

  const openclawVersion = await detectOpenClawVersion(env);
  log(`检测到 OpenClaw 版本: ${openclawVersion.raw}`);

  if (compareSemver(openclawVersion, OPENCLAW_NEW_HOST_MIN_VERSION) >= 0) {
    const pluginSpec = `${WEIXIN_PLUGIN_PACKAGE}@latest`;
    log("匹配兼容版本: 2.0.x (新宿主线) (dist-tag: latest)");
    log(`正在安装插件 ${pluginSpec}...`);
    await runStreamingCommand("openclaw", ["plugins", "install", pluginSpec], env);
    return { pluginSpec, mode: "matrix", distTag: "latest", openclawVersion: openclawVersion.raw };
  }

  if (compareSemver(openclawVersion, OPENCLAW_MIN_VERSION) >= 0) {
    const pluginSpec = `${WEIXIN_PLUGIN_PACKAGE}@legacy`;
    log("匹配兼容版本: 1.0.x (旧宿主线) (dist-tag: legacy)");
    log(`正在安装插件 ${pluginSpec}...`);
    await runStreamingCommand("openclaw", ["plugins", "install", pluginSpec], env);
    return { pluginSpec, mode: "matrix", distTag: "legacy", openclawVersion: openclawVersion.raw };
  }

  throw new Error(
    `当前 OpenClaw 版本 ${openclawVersion.raw} 不在微信插件支持范围内；需升级到 >=2026.3.0，或手动执行 ${WEIXIN_INSTALLER_SPEC} 进一步排查。`,
  );
}

async function restartGateway(env) {
  log("正在重启 OpenClaw Gateway...");
  await runStreamingCommand("openclaw", ["gateway", "restart"], env);
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
  const allowlistState = await preparePluginAllowlist();
  const hostPackageRoot = await findHostOpenClawPackageRoot(env);

  if (hostPackageRoot) {
    const sharedLinkResult = await ensureSharedHostOpenClawLink(hostPackageRoot);

    if (sharedLinkResult.changed) {
      log(`已补充共享宿主 openclaw 软链接: ${sharedLinkResult.linkPath}`);
    }
  } else {
    log("安装前暂未定位到宿主 openclaw 包根目录，将在安装后继续尝试修复插件链接。");
  }

  await installWeixinPlugin(env);

  const repairResult = await repairWeixinPlugin(env);
  log(`微信插件依赖校验通过: ${repairResult.validation.modulePath}`);
  await finalizePluginAllowlist(allowlistState);
  await restartGateway(env);
  log("开始微信扫码登录...");
  await runStreamingCommand("openclaw", ["channels", "login", "--channel", WEIXIN_PLUGIN_ID], env);
}

main().catch((error) => {
  console.error(`[openclaw-weixin] ${error.message}`);
  process.exit(1);
});
