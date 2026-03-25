#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildShellEnv, buildSpawnInvocation } from "../core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENCLAW_PACKAGE_NAME = "openclaw";
const WEIXIN_PLUGIN_ID = "openclaw-weixin";
const REQUIRED_OPENCLAW_MODULE = "openclaw/plugin-sdk/channel-config-schema";
const WEIXIN_PLUGIN_PACKAGE = "@tencent-weixin/openclaw-weixin";
const WEIXIN_INSTALLER_SPEC = process.env.CLAW_DEPLOY_WEIXIN_INSTALLER || "@tencent-weixin/openclaw-weixin-cli@latest";
const OPENCLAW_MIN_VERSION = { major: 2026, minor: 3, patch: 0 };
const OPENCLAW_NEW_HOST_MIN_VERSION = { major: 2026, minor: 3, patch: 22 };
const WEIXIN_DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const WEIXIN_DEFAULT_BOT_TYPE = "3";
const WEIXIN_QR_POLL_TIMEOUT_MS = 35_000;
const WEIXIN_QR_LOGIN_TIMEOUT_MS = 480_000;
const WEIXIN_QR_MAX_REFRESH_COUNT = 3;
const WEIXIN_DEFAULT_ACCOUNT_ID = "default";
const WEIXIN_VALID_ACCOUNT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/iu;
const WEIXIN_INVALID_ACCOUNT_ID_CHARS_RE = /[^a-z0-9_-]+/giu;
const WEIXIN_ACCOUNT_ID_LEADING_DASH_RE = /^-+/u;
const WEIXIN_ACCOUNT_ID_TRAILING_DASH_RE = /-+$/u;
const WEIXIN_PLUGIN_ARCHIVE_RE = /\.(?:tgz|tar\.gz|zip)$/iu;

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

function isLocalOrExplicitPluginSpec(spec) {
  const normalized = String(spec || "").trim();

  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("npm:") || normalized.startsWith("clawhub:") || normalized.startsWith("file:")) {
    return true;
  }

  if (path.isAbsolute(normalized)) {
    return true;
  }

  return (
    normalized.startsWith("./") ||
    normalized.startsWith(".\\") ||
    normalized.startsWith("../") ||
    normalized.startsWith("..\\") ||
    normalized.startsWith("~/") ||
    normalized.startsWith("~\\") ||
    WEIXIN_PLUGIN_ARCHIVE_RE.test(normalized)
  );
}

function resolveNpmOnlyPluginSpec(spec) {
  const normalized = String(spec || "").trim();

  if (!normalized) {
    return normalized;
  }

  return isLocalOrExplicitPluginSpec(normalized) ? normalized : `npm:${normalized}`;
}

function stripNpmPrefix(spec) {
  return String(spec || "").trim().replace(/^npm:/u, "");
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

function resolveWeixinStateDir() {
  return path.join(getOpenClawHome(), WEIXIN_PLUGIN_ID);
}

function resolveWeixinAccountsDir() {
  return path.join(resolveWeixinStateDir(), "accounts");
}

function resolveWeixinAccountIndexPath() {
  return path.join(resolveWeixinStateDir(), "accounts.json");
}

function normalizeAccountId(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return WEIXIN_DEFAULT_ACCOUNT_ID;
  }

  if (WEIXIN_VALID_ACCOUNT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(WEIXIN_INVALID_ACCOUNT_ID_CHARS_RE, "-")
    .replace(WEIXIN_ACCOUNT_ID_LEADING_DASH_RE, "")
    .replace(WEIXIN_ACCOUNT_ID_TRAILING_DASH_RE, "")
    .slice(0, 64);

  return normalized || WEIXIN_DEFAULT_ACCOUNT_ID;
}

async function ensureWeixinChannelConfig() {
  const config = await readOpenClawConfig();
  const nextConfig = { ...config };
  const nextChannels = { ...(nextConfig.channels || {}) };
  const existingSection = nextChannels[WEIXIN_PLUGIN_ID];
  const nextSection =
    existingSection && typeof existingSection === "object" && !Array.isArray(existingSection)
      ? { ...existingSection }
      : {};

  if (!nextSection.accounts || typeof nextSection.accounts !== "object" || Array.isArray(nextSection.accounts)) {
    nextSection.accounts = {};
  }

  nextChannels[WEIXIN_PLUGIN_ID] = nextSection;
  nextConfig.channels = nextChannels;

  await writeOpenClawConfig(nextConfig);
}

async function registerWeixinAccountId(accountId) {
  const normalizedAccountId = normalizeAccountId(accountId);
  if (!normalizedAccountId) {
    throw new Error("无法写入微信账号索引：accountId 为空。");
  }

  const indexPath = resolveWeixinAccountIndexPath();
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  let existing = [];

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string" && value.trim()) : [];
  } catch {
    existing = [];
  }

  if (!existing.includes(normalizedAccountId)) {
    existing.push(normalizedAccountId);
    await fs.writeFile(indexPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  }
}

async function loadWeixinStoredAccount(accountId) {
  const normalizedAccountId = normalizeAccountId(accountId);
  if (!normalizedAccountId) {
    return {};
  }

  const accountPath = path.join(resolveWeixinAccountsDir(), `${normalizedAccountId}.json`);

  try {
    const raw = await fs.readFile(accountPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveWeixinAccount(accountId, update) {
  const normalizedAccountId = normalizeAccountId(accountId);
  if (!normalizedAccountId) {
    throw new Error("无法保存微信账号：accountId 为空。");
  }

  const accountsDir = resolveWeixinAccountsDir();
  const accountPath = path.join(accountsDir, `${normalizedAccountId}.json`);
  const existing = await loadWeixinStoredAccount(normalizedAccountId);
  const token = String(update.token || existing.token || "").trim();
  const baseUrl = String(update.baseUrl || existing.baseUrl || "").trim();
  const userId = update.userId === undefined ? String(existing.userId || "").trim() : String(update.userId || "").trim();
  const payload = {
    ...(token ? { token, savedAt: new Date().toISOString() } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(userId ? { userId } : {}),
  };

  await fs.mkdir(accountsDir, { recursive: true });
  await fs.writeFile(accountPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function getWeixinRouteTag(config, accountId) {
  const section = config?.channels?.[WEIXIN_PLUGIN_ID];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return "";
  }

  if (accountId) {
    const scopedTag = section.accounts?.[accountId]?.routeTag;
    if (typeof scopedTag === "number") {
      return String(scopedTag);
    }
    if (typeof scopedTag === "string" && scopedTag.trim()) {
      return scopedTag.trim();
    }
  }

  if (typeof section.routeTag === "number") {
    return String(section.routeTag);
  }

  return typeof section.routeTag === "string" && section.routeTag.trim() ? section.routeTag.trim() : "";
}

async function buildWeixinHeaders(options = {}) {
  const config = await readOpenClawConfig();
  const routeTag = getWeixinRouteTag(config, options.accountId);
  const headers = { ...(options.extraHeaders || {}) };

  if (routeTag) {
    headers.SKRouteTag = routeTag;
  }

  return headers;
}

function createWeixinPluginRequire(pluginRoot) {
  return createRequire(path.join(pluginRoot, "index.ts"));
}

async function renderWeixinQrInTerminal(qrUrl, pluginRoot) {
  const pluginRequire = createWeixinPluginRequire(pluginRoot);
  const qrcodeTerminal = pluginRequire("qrcode-terminal");

  await new Promise((resolve) => {
    qrcodeTerminal.generate(qrUrl, (renderedQr) => {
      process.stdout.write("\n");
      process.stdout.write(`${renderedQr}\n`);
      resolve();
    });
  });
}

async function fetchWeixinQrCode(options = {}) {
  const headers = await buildWeixinHeaders({ accountId: options.accountId });
  const url = new URL(`ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(options.botType || WEIXIN_DEFAULT_BOT_TYPE)}`, `${options.apiBaseUrl || WEIXIN_DEFAULT_BASE_URL}/`);
  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`获取微信二维码失败：${response.status} ${response.statusText}${body ? `，响应：${body}` : ""}`);
  }

  return response.json();
}

async function pollWeixinQrStatus(qrcode, options = {}) {
  const headers = await buildWeixinHeaders({
    accountId: options.accountId,
    extraHeaders: {
      "iLink-App-ClientVersion": "1",
    },
  });
  const url = new URL(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, `${options.apiBaseUrl || WEIXIN_DEFAULT_BASE_URL}/`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEIXIN_QR_POLL_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`轮询微信登录状态失败：${response.status} ${response.statusText}${rawText ? `，响应：${rawText}` : ""}`);
    }

    return JSON.parse(rawText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "wait" };
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
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

async function runStreamingCommand(command, args, env, options = {}) {
  const completionEvent = options.waitForExit ? "exit" : "close";
  const invocation = buildSpawnInvocation(command, args, { env });

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      ...invocation.options,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on(completionEvent, (code) => {
      if ((code ?? 0) !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

async function installPluginFromArchive(spec, env) {
  const bareSpec = stripNpmPrefix(spec);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claw-deploy-weixin-pack-"));
  const packResult = await runCommand("npm", ["pack", bareSpec], {
    env,
    cwd: tempRoot,
    allowFailure: true,
  });

  if (packResult.code !== 0) {
    throw new Error(`npm pack ${bareSpec} 失败：${(`${packResult.stdout}\n${packResult.stderr}`).trim() || "无输出"}`);
  }

  const archiveFileName = `${packResult.stdout}\n${packResult.stderr}`
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => WEIXIN_PLUGIN_ARCHIVE_RE.test(line))
    .pop();

  if (!archiveFileName) {
    throw new Error(`npm pack ${bareSpec} 未返回归档文件名。`);
  }

  const archivePath = path.join(tempRoot, archiveFileName);
  log(`已转为本地归档安装: ${archivePath}`);
  await runStreamingCommand("openclaw", ["plugins", "install", archivePath], env);
}

async function installWeixinPluginSpec(spec, env) {
  const installSpec = resolveNpmOnlyPluginSpec(spec);

  try {
    await runStreamingCommand("openclaw", ["plugins", "install", installSpec], env);
  } catch (error) {
    if (installSpec.startsWith("npm:")) {
      log(`直接通过 OpenClaw 安装 ${installSpec} 失败，改用本地归档重试...`);
      await installPluginFromArchive(installSpec, env);
      return;
    }

    throw error;
  }
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
    const installSpec = resolveNpmOnlyPluginSpec(explicitPluginSpec);
    log(`使用显式指定的微信插件版本: ${explicitPluginSpec}`);
    log(`正在安装插件 ${installSpec}...`);
    await installWeixinPluginSpec(explicitPluginSpec, env);
    return { pluginSpec: installSpec, mode: "override" };
  }

  const openclawVersion = await detectOpenClawVersion(env);
  log(`检测到 OpenClaw 版本: ${openclawVersion.raw}`);

  if (compareSemver(openclawVersion, OPENCLAW_NEW_HOST_MIN_VERSION) >= 0) {
    const pluginSpec = `${WEIXIN_PLUGIN_PACKAGE}@latest`;
    const installSpec = resolveNpmOnlyPluginSpec(pluginSpec);
    log("匹配兼容版本: 2.0.x (新宿主线) (dist-tag: latest)");
    log(`正在安装插件 ${installSpec}...`);
    await installWeixinPluginSpec(pluginSpec, env);
    return { pluginSpec: installSpec, mode: "matrix", distTag: "latest", openclawVersion: openclawVersion.raw };
  }

  if (compareSemver(openclawVersion, OPENCLAW_MIN_VERSION) >= 0) {
    const pluginSpec = `${WEIXIN_PLUGIN_PACKAGE}@legacy`;
    const installSpec = resolveNpmOnlyPluginSpec(pluginSpec);
    log("匹配兼容版本: 1.0.x (旧宿主线) (dist-tag: legacy)");
    log(`正在安装插件 ${installSpec}...`);
    await installWeixinPluginSpec(pluginSpec, env);
    return { pluginSpec: installSpec, mode: "matrix", distTag: "legacy", openclawVersion: openclawVersion.raw };
  }

  throw new Error(
    `当前 OpenClaw 版本 ${openclawVersion.raw} 不在微信插件支持范围内；需升级到 >=2026.3.0，或手动执行 ${WEIXIN_INSTALLER_SPEC} 进一步排查。`,
  );
}

async function restartGateway(env) {
  log("正在重启 OpenClaw Gateway...");
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
    await runStreamingCommand(
      path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(__dirname, "start-openclaw-gateway.ps1"),
        "-Restart",
      ],
      env,
      { waitForExit: true },
    );
    return;
  }

  await runStreamingCommand("openclaw", ["gateway", "restart"], env);
}

// Windows PowerShell 经典终端对 small 模式的半块字符兼容较差，这里改成 ANSI 彩色终端二维码。
async function runWindowsWeixinLogin(env, pluginRoot) {
  log("检测到 Windows 原生终端，已切换为终端兼容二维码模式。");
  await ensureWeixinChannelConfig();

  let qrState = await fetchWeixinQrCode({
    apiBaseUrl: WEIXIN_DEFAULT_BASE_URL,
    botType: WEIXIN_DEFAULT_BOT_TYPE,
  });

  if (!qrState?.qrcode || !qrState?.qrcode_img_content) {
    throw new Error("未能获取微信二维码链接，请稍后重试。");
  }

  log("请直接在当前终端中扫码，脚本会继续等待登录结果。");
  await renderWeixinQrInTerminal(qrState.qrcode_img_content, pluginRoot);

  const deadline = Date.now() + WEIXIN_QR_LOGIN_TIMEOUT_MS;
  let refreshCount = 1;
  let scannedPrinted = false;

  while (Date.now() < deadline) {
    const statusResponse = await pollWeixinQrStatus(qrState.qrcode, {
      apiBaseUrl: WEIXIN_DEFAULT_BASE_URL,
    });

    switch (statusResponse?.status) {
      case "wait":
        break;
      case "scaned":
        if (!scannedPrinted) {
          log("已扫码，请在微信中确认授权。");
          scannedPrinted = true;
        }
        break;
      case "expired": {
        refreshCount += 1;
        if (refreshCount > WEIXIN_QR_MAX_REFRESH_COUNT) {
          throw new Error("登录超时：二维码多次过期，请重新开始登录流程。");
        }

        log(`二维码已过期，正在刷新...(${refreshCount}/${WEIXIN_QR_MAX_REFRESH_COUNT})`);
        qrState = await fetchWeixinQrCode({
          apiBaseUrl: WEIXIN_DEFAULT_BASE_URL,
          botType: WEIXIN_DEFAULT_BOT_TYPE,
        });

        if (!qrState?.qrcode || !qrState?.qrcode_img_content) {
          throw new Error("二维码刷新失败：未拿到新的二维码链接。");
        }

        log("二维码已刷新，请重新扫码。");
        await renderWeixinQrInTerminal(qrState.qrcode_img_content, pluginRoot);
        scannedPrinted = false;
        break;
      }
      case "confirmed": {
        const accountId = normalizeAccountId(statusResponse.ilink_bot_id);
        const botToken = String(statusResponse.bot_token || "").trim();

        if (!accountId || !botToken) {
          throw new Error("登录失败：微信服务端未返回完整的账号标识或 Bot Token。");
        }

        await saveWeixinAccount(accountId, {
          token: botToken,
          baseUrl: String(statusResponse.baseurl || WEIXIN_DEFAULT_BASE_URL).trim() || WEIXIN_DEFAULT_BASE_URL,
          userId: String(statusResponse.ilink_user_id || "").trim(),
        });
        await registerWeixinAccountId(accountId);
        await ensureWeixinChannelConfig();

        log(`✅ 与微信连接成功，账号已写入本地: ${accountId}`);
        await restartGateway(env);
        return;
      }
      default:
        break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("登录超时，请重新执行部署脚本后再次扫码。");
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

  if (process.platform === "win32") {
    await runWindowsWeixinLogin(env, repairResult.pluginRoot);
    return;
  }

  await runStreamingCommand("openclaw", ["channels", "login", "--channel", WEIXIN_PLUGIN_ID], env);
}

main().catch((error) => {
  console.error(`[openclaw-weixin] ${error.message}`);
  process.exit(1);
});
