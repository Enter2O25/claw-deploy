import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROVIDER_CATALOG = {
  openai: {
    id: "openai",
    setupMode: "onboard-api-key",
    label: "OpenAI",
    authChoice: "openai-api-key",
    keyFlag: "--openai-api-key",
    keyLabel: "OpenAI API Key",
    placeholder: "sk-...",
    hint: "适合 GPT 系列模型与通用助手场景。",
    preferredModels: ["openai/gpt-5.4", "openai/gpt-5.4-pro", "openai/gpt-5.2"],
  },
  anthropic: {
    id: "anthropic",
    setupMode: "onboard-api-key",
    label: "Anthropic",
    keyFlag: "--anthropic-api-key",
    keyLabel: "Anthropic API Key",
    placeholder: "sk-ant-...",
    hint: "适合 Claude 系列模型与高质量长文本任务。",
    preferredModels: ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-5"],
  },
  google: {
    id: "google",
    setupMode: "onboard-api-key",
    label: "Google Gemini",
    authChoice: "gemini-api-key",
    keyFlag: "--gemini-api-key",
    keyLabel: "Gemini API Key",
    placeholder: "AIza...",
    hint: "适合 Gemini 系列模型与多模态场景。",
    preferredModels: ["google/gemini-3-pro-preview", "google/gemini-2.5-pro"],
  },
  zai: {
    id: "zai",
    setupMode: "onboard-api-key",
    label: "Z.AI",
    authChoice: "zai-api-key",
    keyFlag: "--zai-api-key",
    keyLabel: "Z.AI API Key",
    placeholder: "zai_...",
    hint: "适合 GLM 系列与中文本地化场景。",
    preferredModels: ["zai/glm-5", "zai/glm-4.7"],
  },
  huggingface: {
    id: "huggingface",
    setupMode: "onboard-api-key",
    label: "Hugging Face",
    authChoice: "huggingface-api-key",
    keyFlag: "--huggingface-api-key",
    keyLabel: "Hugging Face Token",
    placeholder: "hf_...",
    hint: "适合通过 Hugging Face 路由访问多种开源模型。",
    preferredModels: ["huggingface/deepseek-ai/DeepSeek-R1", "huggingface/deepseek-ai/DeepSeek-V3.2"],
  },
  together: {
    id: "together",
    setupMode: "onboard-api-key",
    label: "Together AI",
    authChoice: "together-api-key",
    keyFlag: "--together-api-key",
    keyLabel: "Together API Key",
    placeholder: "sk-...",
    hint: "适合一把 API Key 访问大量开源模型。",
    preferredModels: [
      "together/deepseek-ai/DeepSeek-R1",
      "together/deepseek-ai/DeepSeek-V3.1",
      "together/moonshotai/Kimi-K2.5",
    ],
  },
  mistral: {
    id: "mistral",
    setupMode: "onboard-api-key",
    label: "Mistral",
    authChoice: "mistral-api-key",
    keyFlag: "--mistral-api-key",
    keyLabel: "Mistral API Key",
    placeholder: "sk-...",
    hint: "适合 Mistral 自家模型与欧盟数据驻留场景。",
    preferredModels: ["mistral/mistral-large-latest"],
  },
  moonshot: {
    id: "moonshot",
    setupMode: "onboard-api-key",
    label: "Moonshot AI",
    authChoice: "moonshot-api-key",
    keyFlag: "--moonshot-api-key",
    keyLabel: "Moonshot API Key",
    placeholder: "sk-...",
    hint: "适合 Kimi 官方 API 与长上下文推理场景。",
    preferredModels: ["moonshot/kimi-k2.5", "moonshot/kimi-k2-thinking"],
  },
  "kimi-coding": {
    id: "kimi-coding",
    setupMode: "onboard-api-key",
    label: "Kimi Coding",
    authChoice: "kimi-code-api-key",
    keyFlag: "--kimi-code-api-key",
    keyLabel: "Kimi Coding API Key",
    placeholder: "sk-...",
    hint: "适合 Moonshot 专门面向代码场景的 Kimi Coding 目录。",
    preferredModels: ["kimi-coding/k2p5"],
  },
  opencode: {
    id: "opencode",
    setupMode: "onboard-api-key",
    label: "OpenCode Zen",
    authChoice: "opencode-zen",
    keyFlag: "--opencode-zen-api-key",
    keyLabel: "OpenCode API Key",
    placeholder: "sk-...",
    hint: "适合使用 OpenCode 提供的 Zen 模型目录。",
    preferredModels: ["opencode/claude-opus-4-6", "opencode/gpt-5.2"],
  },
  "opencode-go": {
    id: "opencode-go",
    setupMode: "onboard-api-key",
    label: "OpenCode Go",
    authChoice: "opencode-go",
    keyFlag: "--opencode-go-api-key",
    keyLabel: "OpenCode API Key",
    placeholder: "sk-...",
    hint: "适合使用 OpenCode 托管的 Kimi/GLM/MiniMax 目录。",
    preferredModels: ["opencode-go/kimi-k2.5", "opencode-go/glm-5"],
  },
  openrouter: {
    id: "openrouter",
    setupMode: "onboard-api-key",
    label: "OpenRouter",
    authChoice: "apiKey",
    tokenProvider: "openrouter",
    keyLabel: "OpenRouter API Key",
    placeholder: "sk-or-...",
    hint: "适合一把 API Key 访问大量第三方模型目录。",
    preferredModels: ["openrouter/anthropic/claude-sonnet-4-5", "openrouter/openai/gpt-5.4"],
  },
  synthetic: {
    id: "synthetic",
    setupMode: "onboard-api-key",
    label: "Synthetic",
    authChoice: "synthetic-api-key",
    keyFlag: "--synthetic-api-key",
    keyLabel: "Synthetic API Key",
    placeholder: "sk-...",
    hint: "适合通过 Synthetic 访问兼容 Anthropic 的聚合模型目录。",
    preferredModels: ["synthetic/hf:MiniMaxAI/MiniMax-M2.5"],
  },
  volcengine: {
    id: "volcengine",
    setupMode: "onboard-api-key",
    label: "Volcano Engine",
    authChoice: "volcengine-api-key",
    keyFlag: "--volcengine-api-key",
    keyLabel: "Volcano Engine API Key",
    placeholder: "sk-...",
    hint: "适合在火山引擎目录里访问 Doubao、Kimi、GLM 与 DeepSeek 模型。",
    preferredModels: [
      "volcengine/deepseek-v3-2-251201",
      "volcengine/kimi-k2-5-260127",
      "volcengine/glm-4-7-251222",
    ],
  },
  "amazon-bedrock": {
    id: "amazon-bedrock",
    setupMode: "preconfigured",
    label: "Amazon Bedrock",
    hint: "支持全量 Bedrock 目录；需要主机预先配置 AWS 凭证链与 AWS_REGION。",
    preferredModels: [
      "amazon-bedrock/anthropic.claude-sonnet-4-6",
      "amazon-bedrock/deepseek.v3.2",
      "amazon-bedrock/moonshotai.kimi-k2.5",
    ],
  },
  "azure-openai-responses": {
    id: "azure-openai-responses",
    setupMode: "preconfigured",
    label: "Azure OpenAI Responses",
    hint: "支持 Azure OpenAI Responses 目录；需要主机预先配置 Azure endpoint 与认证信息。",
    preferredModels: ["azure-openai-responses/gpt-5.4", "azure-openai-responses/gpt-5.4-pro"],
  },
  cerebras: {
    id: "cerebras",
    setupMode: "env-api-key",
    envVar: "CEREBRAS_API_KEY",
    label: "Cerebras",
    keyLabel: "Cerebras API Key",
    placeholder: "csk-...",
    hint: "适合使用 Cerebras 托管的开源与 GLM 模型；脚本会自动写入 CEREBRAS_API_KEY。",
    preferredModels: ["cerebras/gpt-oss-120b", "cerebras/qwen-3-235b-a22b-instruct-2507"],
  },
  "github-copilot": {
    id: "github-copilot",
    setupMode: "preconfigured",
    label: "GitHub Copilot",
    hint: "支持 GitHub Copilot 目录；首次使用前需要先在主机上完成设备登录。",
    preferredModels: ["github-copilot/gpt-5.4", "github-copilot/claude-sonnet-4.6"],
  },
  "google-antigravity": {
    id: "google-antigravity",
    setupMode: "preconfigured",
    label: "Google Antigravity",
    hint: "支持 Antigravity 目录；首次使用前需要先在主机上完成 OAuth 登录。",
    preferredModels: ["google-antigravity/gemini-3.1-pro-high", "google-antigravity/claude-sonnet-4-6"],
  },
  "google-gemini-cli": {
    id: "google-gemini-cli",
    setupMode: "preconfigured",
    label: "Google Gemini CLI",
    hint: "支持 Gemini CLI 目录；首次使用前需要先在主机上完成 OAuth 登录。",
    preferredModels: ["google-gemini-cli/gemini-3.1-pro-preview", "google-gemini-cli/gemini-3-pro-preview"],
  },
  "google-vertex": {
    id: "google-vertex",
    setupMode: "preconfigured",
    label: "Google Vertex",
    hint: "支持 Vertex 目录；需要主机预先配置 gcloud ADC 或服务账号凭证。",
    preferredModels: ["google-vertex/gemini-3.1-pro-preview", "google-vertex/gemini-3-pro-preview"],
  },
  groq: {
    id: "groq",
    setupMode: "env-api-key",
    envVar: "GROQ_API_KEY",
    label: "Groq",
    keyLabel: "Groq API Key",
    placeholder: "gsk_...",
    hint: "适合低延迟推理；脚本会自动写入 GROQ_API_KEY。",
    preferredModels: ["groq/openai/gpt-oss-120b", "groq/moonshotai/kimi-k2-instruct"],
  },
  minimax: {
    id: "minimax",
    setupMode: "env-api-key",
    envVar: "MINIMAX_API_KEY",
    label: "MiniMax",
    keyLabel: "MiniMax API Key",
    placeholder: "sk-...",
    hint: "适合 MiniMax 官方目录；脚本会自动写入 MINIMAX_API_KEY。",
    preferredModels: ["minimax/MiniMax-M2.5", "minimax/MiniMax-M2.1"],
  },
  "minimax-cn": {
    id: "minimax-cn",
    setupMode: "env-api-key",
    envVar: "MINIMAX_API_KEY",
    label: "MiniMax CN",
    keyLabel: "MiniMax API Key",
    placeholder: "sk-...",
    hint: "适合中国区 MiniMax 目录；脚本会复用同一把 MINIMAX_API_KEY。",
    preferredModels: ["minimax-cn/MiniMax-M2.5", "minimax-cn/MiniMax-M2.1"],
  },
  "openai-codex": {
    id: "openai-codex",
    setupMode: "preconfigured",
    label: "OpenAI Codex",
    hint: "支持 Codex OAuth 目录；首次使用前需要先在主机上完成 OpenAI Codex 登录。",
    preferredModels: ["openai-codex/gpt-5.4", "openai-codex/gpt-5.3-codex"],
  },
  "vercel-ai-gateway": {
    id: "vercel-ai-gateway",
    setupMode: "onboard-api-key",
    label: "Vercel AI Gateway",
    authChoice: "ai-gateway-api-key",
    keyFlag: "--ai-gateway-api-key",
    keyLabel: "AI Gateway API Key",
    placeholder: "ag_...",
    hint: "适合用一把 AI Gateway Key 访问大量第三方模型目录。",
    preferredModels: ["vercel-ai-gateway/openai/gpt-5.4", "vercel-ai-gateway/anthropic/claude-opus-4.6"],
  },
  xai: {
    id: "xai",
    setupMode: "env-api-key",
    envVar: "XAI_API_KEY",
    label: "xAI",
    keyLabel: "xAI API Key",
    placeholder: "xai-...",
    hint: "适合 Grok 系列模型；脚本会自动写入 XAI_API_KEY。",
    preferredModels: ["xai/grok-4", "xai/grok-code-fast-1"],
  },
};

const PROVIDER_ORDER = [
  "openai",
  "openai-codex",
  "anthropic",
  "google",
  "google-vertex",
  "google-gemini-cli",
  "google-antigravity",
  "azure-openai-responses",
  "amazon-bedrock",
  "zai",
  "huggingface",
  "together",
  "openrouter",
  "vercel-ai-gateway",
  "mistral",
  "moonshot",
  "kimi-coding",
  "minimax",
  "minimax-cn",
  "groq",
  "cerebras",
  "xai",
  "opencode",
  "opencode-go",
  "synthetic",
  "volcengine",
  "github-copilot",
];

const FALLBACK_MODEL_OPTIONS = Object.values(PROVIDER_CATALOG).flatMap((provider) =>
  provider.preferredModels.map((modelRef) => ({
    ref: modelRef,
    providerId: provider.id,
    providerLabel: provider.label,
    label: modelRef.split("/").slice(1).join("/"),
  })),
);

export const BOT_CATALOG = {
  telegram: {
    id: "telegram",
    label: "Telegram 机器人",
    description: "需要先准备 BotFather 生成的 Bot Token，部署后可直接在 Telegram 私聊接入。",
    resultHint: "部署完成后请先在 Telegram 私聊机器人，再按日志中的 pairing 命令批准首个配对码。",
    credentialFields: [
      {
        id: "telegramBotToken",
        label: "Telegram Bot Token",
        placeholder: "123456789:AAExampleBotToken",
        hint: "在 Telegram 的 @BotFather 中执行 /newbot 获取；这是 Telegram 官方 Bot API Token。",
        secret: true,
      },
    ],
  },
  feishu: {
    id: "feishu",
    label: "飞书机器人",
    description: "需要先在飞书开放平台创建企业自建应用并准备 App ID / App Secret，部署后可在飞书私聊接入。",
    resultHint:
      "部署完成后请确认飞书应用已开通机器人能力、开启长连接事件订阅并发布，然后在飞书私聊机器人按 pairing 命令批准首个配对码。",
    credentialFields: [
      {
        id: "feishuAppId",
        label: "飞书 App ID",
        placeholder: "cli_xxx",
        hint: "在飞书开放平台的“凭证与基础信息”页复制，通常形如 cli_xxx。",
        secret: false,
      },
      {
        id: "feishuAppSecret",
        label: "飞书 App Secret",
        placeholder: "xxx",
        hint: "在飞书开放平台的“凭证与基础信息”页复制；请妥善保管，不要泄露。",
        secret: true,
      },
    ],
  },
  weixin: {
    id: "weixin",
    label: "微信机器人",
    description: "无需额外输入文本凭证；脚本会调用官方微信安装器安装插件，并在部署过程中引导扫码连接。",
    resultHint: "部署过程中会展示微信二维码，请用微信扫码完成连接，然后回到当前终端继续等待安装器收尾。",
    credentialFields: [],
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp 机器人",
    description: "部署完成后自动进入二维码登录步骤，适合手机聊天。",
    resultHint: "部署完成后请按日志提示完成 WhatsApp 扫码登录。",
    credentialFields: [],
  },
};

function buildLegacyModelAliases() {
  return {
    "anthropic-sonnet-4-5": "anthropic/claude-sonnet-4-5",
    "openai-gpt-5-2": "openai/gpt-5.2",
    "gemini-2-5-pro": "google/gemini-2.5-pro",
    "zai-glm-5": "zai/glm-5",
    "huggingface-deepseek-r1": "huggingface/deepseek-ai/DeepSeek-R1",
  };
}

export const LEGACY_MODEL_ALIASES = buildLegacyModelAliases();

function providerRequiresApiKey(provider) {
  return provider.setupMode === "onboard-api-key" || provider.setupMode === "env-api-key";
}

function humanizeProviderId(providerId) {
  return providerId
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function createDynamicProvider(providerId) {
  return {
    id: providerId,
    setupMode: "preconfigured",
    label: humanizeProviderId(providerId),
    hint: "脚本会展示该目录；如主机上已提前完成该 provider 的登录或配置，可直接使用。",
    preferredModels: [],
  };
}

function getProviderMetadata(providerId) {
  return PROVIDER_CATALOG[providerId] || createDynamicProvider(providerId);
}

function sortProviders(providers) {
  const order = new Map(PROVIDER_ORDER.map((providerId, index) => [providerId, index]));

  return [...providers].sort((left, right) => {
    const leftOrder = order.has(left.id) ? order.get(left.id) : Number.POSITIVE_INFINITY;
    const rightOrder = order.has(right.id) ? order.get(right.id) : Number.POSITIVE_INFINITY;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.label.localeCompare(right.label, "en");
  });
}

/**
 * Windows 环境变量名通常保留为 Path；这里保留原始大小写并清理重复键，
 * 避免子进程拿到空 PATH 后连 powershell.exe 都找不到。
 */
function resolvePathEnvKey(env) {
  if (process.platform !== "win32") {
    return "PATH";
  }

  return Object.keys(env).find((key) => key.toLowerCase() === "path") || "Path";
}

function setPathEnvValue(env, value) {
  const pathKey = resolvePathEnvKey(env);

  if (process.platform === "win32") {
    for (const key of Object.keys(env)) {
      if (key !== pathKey && key.toLowerCase() === "path") {
        delete env[key];
      }
    }
  }

  env[pathKey] = value;
}

function getWindowsPowerShellCommand() {
  if (process.platform !== "win32") {
    return "powershell";
  }

  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (!systemRoot) {
    return "powershell.exe";
  }

  return path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

/**
 * 统一补齐常见安装路径，避免安装脚本刚写入 PATH 时当前进程还感知不到。
 */
export async function buildShellEnv(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const pathKey = resolvePathEnvKey(env);
  const currentPath = env[pathKey] || env.PATH || env.Path || "";
  const pathEntries = new Set(currentPath.split(path.delimiter).filter(Boolean));

  if (process.platform === "darwin") {
    pathEntries.add("/opt/homebrew/bin");
    pathEntries.add("/usr/local/bin");
  }

  if (process.platform === "win32") {
    const systemRoot = env.SystemRoot || env.WINDIR;
    if (systemRoot) {
      pathEntries.add(path.join(systemRoot, "System32"));
      pathEntries.add(path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0"));
    }
    if (env.APPDATA) {
      pathEntries.add(path.join(env.APPDATA, "npm"));
    }
    pathEntries.add(path.join(os.homedir(), ".claw-deploy", "bin"));
  } else {
    pathEntries.add(path.join(os.homedir(), ".local", "bin"));
    pathEntries.add(path.join(os.homedir(), ".npm-global", "bin"));
    pathEntries.add(path.join(os.homedir(), ".openclaw", "bin"));
  }

  try {
    const prefixResult = await execCommand("npm", ["prefix", "-g"], { allowFailure: true });
    const prefix = prefixResult.stdout.trim();

    if (prefix) {
      pathEntries.add(process.platform === "win32" ? prefix : path.join(prefix, "bin"));
    }
  } catch {
    // npm 可能尚未安装，这里保持静默即可，后续交给安装步骤处理。
  }

  setPathEnvValue(env, Array.from(pathEntries).join(path.delimiter));
  env.SHARP_IGNORE_GLOBAL_LIBVIPS = env.SHARP_IGNORE_GLOBAL_LIBVIPS || "1";
  return env;
}

/**
 * 以 Promise 形式运行命令，便于环境探测和状态查询统一处理。
 */
function execCommand(command, args, options = {}) {
  const {
    cwd = __dirname,
    env = process.env,
    allowFailure = false,
    shell = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

/**
 * 将版本号转成可比较的结构，无法识别时返回 null。
 */
function parseSemver(rawVersion) {
  const normalized = String(rawVersion || "").trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return null;
  }

  return {
    raw: normalized,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * 探测单个命令是否存在以及版本信息，给脚本展示环境状态。
 */
async function detectBinary(command, versionArgs = ["--version"]) {
  const env = await buildShellEnv();
  const result = await execCommand(command, versionArgs, { env, allowFailure: true });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const version = parseSemver(output.split(/\s+/)[0]);

  return {
    command,
    available: result.code === 0,
    raw: output,
    version,
  };
}

/**
 * 汇总当前机器可用于一键部署的环境状态。
 */
export async function detectEnvironment() {
  const [nodeInfo, npmInfo, openclawInfo] = await Promise.all([
    detectBinary("node", ["--version"]),
    detectBinary("npm", ["--version"]),
    detectBinary("openclaw", ["--version"]),
  ]);

  return {
    platform: {
      os: process.platform,
      release: os.release(),
      arch: process.arch,
    },
    node: nodeInfo,
    npm: npmInfo,
    openclaw: openclawInfo,
    bootstrapRecommended: !nodeInfo.available || !nodeInfo.version || nodeInfo.version.major < 22,
  };
}

/**
 * 把用户输入统一映射成标准模型引用，兼容旧版短 id 与完整 provider/model 形式。
 */
export function resolveModelRef(input) {
  const raw = String(input || "").trim();

  if (!raw) {
    return "";
  }

  if (LEGACY_MODEL_ALIASES[raw]) {
    return LEGACY_MODEL_ALIASES[raw];
  }

  return raw;
}

/**
 * 解析 OpenClaw 返回的一行模型引用；即使 provider 需要预配置，也要把模型展示在选择列表中。
 */
function parseModelLine(line) {
  const ref = String(line || "").trim();

  if (!ref.includes("/")) {
    return null;
  }

  const providerId = ref.split("/")[0].toLowerCase();
  const provider = getProviderMetadata(providerId);

  return {
    ref,
    providerId,
    providerLabel: provider.label,
    label: ref.split("/").slice(1).join("/"),
  };
}

function sortModelsForProvider(provider, models) {
  const preferredOrder = new Map((provider.preferredModels || []).map((ref, index) => [ref, index]));

  return [...models].sort((left, right) => {
    const leftPreferred = preferredOrder.has(left.ref) ? preferredOrder.get(left.ref) : Number.POSITIVE_INFINITY;
    const rightPreferred = preferredOrder.has(right.ref) ? preferredOrder.get(right.ref) : Number.POSITIVE_INFINITY;

    if (leftPreferred !== rightPreferred) {
      return leftPreferred - rightPreferred;
    }

    return left.label.localeCompare(right.label, "en");
  });
}

/**
 * 从已安装的 OpenClaw 动态拉取最新模型目录；失败时退回到内置保底列表。
 */
export async function loadModelCatalog() {
  const env = await buildShellEnv();
  const customCommand = process.env.CLAW_DEPLOY_MODELS_COMMAND;
  const result = customCommand
    ? await execCommand("bash", ["-lc", customCommand], { env, allowFailure: true })
    : await execCommand("openclaw", ["models", "list", "--all", "--plain"], { env, allowFailure: true });

  const rawLines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dynamicModels = Array.from(
    new Map(
      rawLines
        .map(parseModelLine)
        .filter(Boolean)
        .map((model) => [model.ref, model]),
    ).values(),
  );

  if (!dynamicModels.length) {
    const fallbackProviders = Object.values(PROVIDER_CATALOG)
      .map((provider) => {
        const models = sortModelsForProvider(
          provider,
          FALLBACK_MODEL_OPTIONS.filter((model) => model.providerId === provider.id),
        );

        return {
          ...provider,
          count: models.length,
          models,
        };
      })
      .filter((provider) => provider.count > 0);

    return {
      source: "fallback",
      totalCount: FALLBACK_MODEL_OPTIONS.length,
      availableCount: FALLBACK_MODEL_OPTIONS.length,
      providers: fallbackProviders,
    };
  }

  const providerIds = Array.from(new Set(dynamicModels.map((model) => model.providerId)));
  const providers = sortProviders(
    providerIds.map((providerId) => {
      const provider = getProviderMetadata(providerId);
      const models = sortModelsForProvider(
        provider,
        dynamicModels.filter((model) => model.providerId === provider.id),
      );

      return {
        ...provider,
        count: models.length,
        models,
      };
    }).filter((provider) => provider.count > 0),
  );

  return {
    source: "openclaw",
    totalCount: rawLines.length,
    availableCount: dynamicModels.length,
    providers,
  };
}

/**
 * 生成官方安装脚本步骤，优先复用 OpenClaw 官方安装器来处理缺失环境。
 */
function buildInstallerStep() {
  if (process.platform === "win32") {
    return {
      id: "install-openclaw",
      title: "安装或修复 OpenClaw 运行环境",
      command: getWindowsPowerShellCommand(),
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(__dirname, "scripts", "install-openclaw-runtime.ps1"),
      ],
    };
  }

  return {
    id: "install-openclaw",
    title: "安装或修复 OpenClaw 运行环境",
    command: "bash",
    args: [path.join(__dirname, "scripts", "install-openclaw-runtime.sh")],
  };
}

function buildWeixinInstallerStep() {
  return {
    id: "install-weixin-plugin",
    title: "安装微信渠道插件并进入扫码连接流程",
    command: process.execPath,
    args: [path.join(__dirname, "scripts", "install-weixin-plugin.js")],
  };
}

/**
 * 只暴露极简输入项，因此这里固定好安全默认值和标准化的部署动作。
 */
export function buildDeploymentPlan(envState, payload) {
  const modelRef = resolveModelRef(payload.modelRef || payload.modelId);
  const providerId = modelRef.split("/")[0]?.toLowerCase();
  const provider = getProviderMetadata(providerId);
  const bot = BOT_CATALOG[payload.botId];

  if (!modelRef || !provider || !bot) {
    throw new Error("无效的模型或聊天机器人选择。");
  }

  if (providerRequiresApiKey(provider) && !String(payload.apiKey || "").trim()) {
    throw new Error(`${provider.keyLabel || "API Key"} 不能为空。`);
  }

  for (const field of bot.credentialFields || []) {
    if (!String(payload[field.id] || "").trim()) {
      throw new Error(`${field.label} 不能为空。`);
    }
  }

  const steps = [];

  if (!envState.node.available || !envState.node.version || envState.node.version.major < 22 || !envState.openclaw.available) {
    steps.push(buildInstallerStep());
  }

  steps.push({
    id: "onboard",
    title: "写入模型鉴权并执行 OpenClaw 初始配置",
    command: "openclaw",
    args: buildOnboardArgs(provider, payload.apiKey),
  });

  if (provider.setupMode === "env-api-key" && provider.envVar) {
    steps.push({
      id: `configure-${provider.id}-env`,
      title: `写入 ${provider.keyLabel}`,
      command: "openclaw",
      args: ["config", "set", `env.${provider.envVar}`, JSON.stringify(payload.apiKey), "--strict-json"],
    });
  }

  steps.push({
    id: "set-model",
    title: "设置默认模型",
    command: "openclaw",
    args: ["config", "set", "agents.defaults.model.primary", JSON.stringify(modelRef), "--strict-json"],
  });

  steps.push({
    id: "disable-heartbeat",
    title: "关闭默认心跳，避免未配置完成时主动发消息",
    command: "openclaw",
    args: ["config", "set", "agents.defaults.heartbeat.every", JSON.stringify("0m"), "--strict-json"],
  });

  if (payload.botId === "whatsapp") {
    steps.push(
      {
        id: "enable-whatsapp",
        title: "写入 WhatsApp 安全默认配置",
        command: "openclaw",
        args: ["config", "set", "channels.whatsapp.enabled", "true", "--strict-json"],
      },
      {
        id: "whatsapp-dm-policy",
        title: "启用 WhatsApp 配对式私聊权限",
        command: "openclaw",
        args: ["config", "set", "channels.whatsapp.dmPolicy", JSON.stringify("pairing"), "--strict-json"],
      },
      {
        id: "whatsapp-group-policy",
        title: "关闭 WhatsApp 群消息，默认更安全",
        command: "openclaw",
        args: ["config", "set", "channels.whatsapp.groupPolicy", JSON.stringify("disabled"), "--strict-json"],
      },
    );
  }

  if (payload.botId === "telegram") {
    steps.push(
      {
        id: "enable-telegram",
        title: "启用 Telegram 渠道",
        command: "openclaw",
        args: ["config", "set", "channels.telegram.enabled", "true", "--strict-json"],
      },
      {
        id: "telegram-bot-token",
        title: "写入 Telegram Bot Token",
        command: "openclaw",
        args: ["config", "set", "channels.telegram.botToken", JSON.stringify(payload.telegramBotToken), "--strict-json"],
      },
      {
        id: "telegram-dm-policy",
        title: "启用 Telegram 配对式私聊权限",
        command: "openclaw",
        args: ["config", "set", "channels.telegram.dmPolicy", JSON.stringify("pairing"), "--strict-json"],
      },
      {
        id: "telegram-group-policy",
        title: "关闭 Telegram 群消息，默认更安全",
        command: "openclaw",
        args: ["config", "set", "channels.telegram.groupPolicy", JSON.stringify("disabled"), "--strict-json"],
      },
      {
        id: "telegram-group-mentions",
        title: "预写入 Telegram 群聊提及规则",
        command: "openclaw",
        args: [
          "config",
          "set",
          "channels.telegram.groups",
          JSON.stringify({ "*": { requireMention: true } }),
          "--strict-json",
        ],
      },
    );
  }

  if (payload.botId === "feishu") {
    steps.push(
      {
        id: "enable-feishu",
        title: "启用飞书渠道",
        command: "openclaw",
        args: ["config", "set", "channels.feishu.enabled", "true", "--strict-json"],
      },
      {
        id: "feishu-default-account",
        title: "设置飞书默认账号",
        command: "openclaw",
        args: ["config", "set", "channels.feishu.defaultAccount", JSON.stringify("main"), "--strict-json"],
      },
      {
        id: "feishu-app-id",
        title: "写入飞书 App ID",
        command: "openclaw",
        args: ["config", "set", "channels.feishu.accounts.main.appId", JSON.stringify(payload.feishuAppId), "--strict-json"],
      },
      {
        id: "feishu-app-secret",
        title: "写入飞书 App Secret",
        command: "openclaw",
        args: [
          "config",
          "set",
          "channels.feishu.accounts.main.appSecret",
          JSON.stringify(payload.feishuAppSecret),
          "--strict-json",
        ],
      },
      {
        id: "feishu-dm-policy",
        title: "启用飞书配对式私聊权限",
        command: "openclaw",
        args: ["config", "set", "channels.feishu.dmPolicy", JSON.stringify("pairing"), "--strict-json"],
      },
      {
        id: "feishu-group-policy",
        title: "关闭飞书群消息，默认更安全",
        command: "openclaw",
        args: ["config", "set", "channels.feishu.groupPolicy", JSON.stringify("disabled"), "--strict-json"],
      },
      {
        id: "feishu-group-mentions",
        title: "预写入飞书群聊提及规则",
        command: "openclaw",
        args: [
          "config",
          "set",
          "channels.feishu.groups",
          JSON.stringify({ "*": { requireMention: true } }),
          "--strict-json",
        ],
      },
    );
  }

  steps.push(
    {
      id: "validate-config",
      title: "校验配置是否可用",
      command: "openclaw",
      args: ["config", "validate"],
    },
    {
      id: "install-gateway-service",
      title: "安装后台 Gateway 服务",
      command: "openclaw",
      args: ["gateway", "install", "--runtime", "node", "--force"],
    },
    {
      id: "start-gateway-service",
      title: "启动后台 Gateway 服务",
      command: "openclaw",
      args: ["gateway", "start"],
    },
  );

  if (payload.botId === "weixin") {
    steps.push(buildWeixinInstallerStep());
  }

  if (payload.botId === "whatsapp") {
    steps.push({
      id: "whatsapp-login",
      title: "进入 WhatsApp 扫码登录流程",
      command: "openclaw",
      args: ["channels", "login", "--channel", "whatsapp"],
    });
  }

  steps.push({
    id: "health-check",
    title: "执行最终状态检查",
    command: "openclaw",
    args: ["gateway", "status", "--deep"],
  });

  return {
    model: {
      modelRef,
      provider: provider.label,
      label: modelRef.split("/").slice(1).join("/"),
      providerId,
      keyLabel: provider.keyLabel,
    },
    bot,
    steps,
    postDeployNotes: buildPostDeployNotes(provider, payload.botId),
  };
}

/**
 * 根据不同模型提供商拼装 OpenClaw 的非交互 onboarding 参数。
 */
function buildOnboardArgs(provider, apiKey) {
  const args = [
    "onboard",
    "--non-interactive",
    "--mode",
    "local",
    "--secret-input-mode",
    "plaintext",
    "--gateway-port",
    "18789",
    "--gateway-bind",
    "loopback",
    "--skip-health",
    "--skip-skills",
    "--accept-risk",
  ];

  if (provider.setupMode === "env-api-key" || provider.setupMode === "preconfigured") {
    args.push("--auth-choice", "skip");
    return args;
  }

  if (provider.authChoice) {
    args.push("--auth-choice", provider.authChoice);
  }

  if (provider.tokenProvider) {
    args.push("--token-provider", provider.tokenProvider, "--token", apiKey);
    return args;
  }

  if (!provider.keyFlag) {
    throw new Error(`当前脚本暂不支持 ${provider.label} 的一键鉴权参数。`);
  }

  args.push(provider.keyFlag, apiKey);
  return args;
}

/**
 * 为不同渠道生成部署后的下一步说明，减少用户自己查文档的成本。
 */
function buildPostDeployNotes(provider, botId) {
  const openclawCommand = getUserFacingOpenClawCommand();
  const pathHint = getUserFacingPathRefreshHint();
  const providerNotes = buildProviderSetupNotes(provider, openclawCommand);
  const backgroundNotes = [...buildBackgroundServiceNotes(openclawCommand), ...providerNotes];

  if (botId === "telegram") {
    return [
      ...backgroundNotes,
      "Telegram 已启用。先去 Telegram 私聊你的机器人，发送一条普通消息来触发首个 pairing code。",
      `如果当前终端提示 openclaw: command not found，可先执行：${pathHint}`,
      `如果只发 /start 仍没看到配对码，请先执行 ${openclawCommand} pairing list telegram 检查待审批请求。`,
      `查看待审批请求：${openclawCommand} pairing list telegram`,
      `批准配对码：${openclawCommand} pairing approve telegram <CODE>`,
    ];
  }

  if (botId === "feishu") {
    return [
      ...backgroundNotes,
      "飞书已启用。请先到飞书开放平台确认应用已发布、机器人能力已开启，并把事件订阅切到长连接后添加 im.message.receive_v1。",
      "随后在飞书里私聊机器人，发送一条普通消息来触发首个 pairing code。",
      `如果当前终端提示 openclaw: command not found，可先执行：${pathHint}`,
      `查看待审批请求：${openclawCommand} pairing list feishu`,
      `批准配对码：${openclawCommand} pairing approve feishu <CODE>`,
      '脚本默认关闭飞书群消息；如需群聊接入，可把 channels.feishu.groupPolicy 改为 "open" 或 "allowlist"。',
    ];
  }

  if (botId === "weixin") {
    return [
      ...backgroundNotes,
      "脚本会按官方兼容矩阵选择微信插件版本线，直接执行 openclaw plugins install，避免官方安装器在宿主链接未补好时抢先发起首次登录。",
      "安装完成后，脚本会额外校验插件能否解析宿主 openclaw/plugin-sdk；若插件目录缺少宿主包链接，会自动补修。",
      "为避免安装阶段的自动发现误加载，脚本会主动写入 plugins.allow 显式信任列表，并把 openclaw-weixin 加入可信插件名单。",
      "随后脚本会重启 Gateway，再展示微信二维码；请在执行过程中直接用微信扫一扫完成绑定。",
      `如需稍后手动重试扫码，可执行：${openclawCommand} channels login --channel openclaw-weixin`,
      "如果需要完整重装微信插件，可重新执行：npx -y @tencent-weixin/openclaw-weixin-cli install",
      `如果当前终端提示 openclaw: command not found，可先执行：${pathHint}`,
    ];
  }

  if (botId === "whatsapp") {
    return [
      ...backgroundNotes,
      `如果当前终端提示 openclaw: command not found，可先执行：${pathHint}`,
      "按日志提示完成 WhatsApp 扫码登录后，即可开始私聊测试。",
    ];
  }

  return backgroundNotes;
}

/**
 * 给最终用户输出一个当前终端可直接复制执行的 openclaw 命令入口，避免依赖 shell 重新加载 PATH。
 */
function getUserFacingOpenClawCommand() {
  if (process.platform === "win32") {
    return `& "${path.join(os.homedir(), ".claw-deploy", "bin", "openclaw.cmd")}"`;
  }

  return path.join(os.homedir(), ".local", "bin", "openclaw");
}

/**
 * 安装脚本会写入 rc 文件，但当前 shell 无法被子进程回写；这里给出一次性立即生效的补 PATH 命令。
 */
function getUserFacingPathRefreshHint() {
  if (process.platform === "win32") {
    return `$env:Path = "${path.join(os.homedir(), ".claw-deploy", "bin")};" + $env:Path`;
  }

  return 'export PATH="$HOME/.local/bin:$PATH"';
}

/**
 * 后台服务已经由脚本显式安装并启动；Linux 服务器若要求退出 SSH 后继续常驻，还需要开启 linger。
 */
function buildBackgroundServiceNotes(openclawCommand) {
  const notes = [`后台 Gateway 服务已启动，可执行 ${openclawCommand} gateway status --deep 查看当前状态。`];

  if (process.platform === "linux") {
    notes.push("如需在 Linux 服务器退出 SSH 后仍继续常驻，请执行一次：sudo loginctl enable-linger $USER");
  }

  return notes;
}

/**
 * 全量模型目录里有一部分 provider 依赖主机已有登录态或云凭证，这里在部署结果里提前说明。
 */
function buildProviderSetupNotes(provider, openclawCommand) {
  if (provider.setupMode === "env-api-key" && provider.envVar) {
    return [`已为 ${provider.label} 写入 ${provider.envVar}，后续重启服务后会自动生效。`];
  }

  if (provider.id === "amazon-bedrock") {
    return ["Amazon Bedrock 依赖主机上的 AWS 凭证链与 AWS_REGION；若未预配，后续校验会失败。"];
  }

  if (provider.id === "google-vertex") {
    return ["Google Vertex 依赖主机上的 gcloud ADC 或服务账号；若未预配，后续校验会失败。"];
  }

  if (provider.id === "github-copilot") {
    return [`GitHub Copilot 首次使用前请先在主机上执行：${openclawCommand} models auth login-github-copilot`];
  }

  if (provider.id === "openai-codex") {
    return [`OpenAI Codex 首次使用前请先在主机上执行：${openclawCommand} models auth login --provider openai-codex`];
  }

  if (provider.id === "google-antigravity") {
    return [
      `Google Antigravity 首次使用前请先执行：${openclawCommand} plugins enable google-antigravity-auth`,
      `然后执行：${openclawCommand} models auth login --provider google-antigravity --set-default`,
    ];
  }

  if (provider.id === "google-gemini-cli") {
    return [
      `Google Gemini CLI 首次使用前请先执行：${openclawCommand} plugins enable google`,
      `然后执行：${openclawCommand} models auth login --provider google-gemini-cli --set-default`,
    ];
  }

  if (provider.id === "azure-openai-responses") {
    return ["Azure OpenAI Responses 需要主机上已完成 Azure endpoint 与认证配置；脚本当前只负责把模型加入选择与设为默认。"];
  }

  if (provider.setupMode === "preconfigured") {
    return [`${provider.label} 需要主机上已有该 provider 的登录态或环境凭证；脚本当前不会额外弹出该 provider 的高级认证流程。`];
  }

  return [];
}

/**
 * 对日志做最小脱敏，避免 API Key 或渠道 Token 在部署日志里被完整暴露。
 */
export function sanitizeLog(text, secretValues = []) {
  return secretValues.reduce((sanitized, secret) => {
    if (!secret) {
      return sanitized;
    }

    return sanitized.split(secret).join("[已隐藏敏感信息]");
  }, text);
}
