import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROVIDER_CATALOG = {
  openai: {
    id: "openai",
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
    label: "Anthropic",
    keyFlag: "--anthropic-api-key",
    keyLabel: "Anthropic API Key",
    placeholder: "sk-ant-...",
    hint: "适合 Claude 系列模型与高质量长文本任务。",
    preferredModels: ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-5"],
  },
  google: {
    id: "google",
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
};

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

/**
 * 统一补齐常见安装路径，避免安装脚本刚写入 PATH 时当前进程还感知不到。
 */
export async function buildShellEnv(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const pathEntries = new Set((env.PATH || "").split(path.delimiter).filter(Boolean));

  if (process.platform === "darwin") {
    pathEntries.add("/opt/homebrew/bin");
    pathEntries.add("/usr/local/bin");
  }

  if (process.platform === "win32") {
    if (env.APPDATA) {
      pathEntries.add(path.join(env.APPDATA, "npm"));
    }
  } else {
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

  env.PATH = Array.from(pathEntries).join(path.delimiter);
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
 * 解析 OpenClaw 返回的一行模型引用，并过滤掉当前一键脚本无法自动配置鉴权的提供商。
 */
function parseModelLine(line) {
  const ref = String(line || "").trim();

  if (!ref.includes("/")) {
    return null;
  }

  const providerId = ref.split("/")[0].toLowerCase();
  const provider = PROVIDER_CATALOG[providerId];

  if (!provider) {
    return null;
  }

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

  const providers = Object.values(PROVIDER_CATALOG)
    .map((provider) => {
      const models = sortModelsForProvider(
        provider,
        dynamicModels.filter((model) => model.providerId === provider.id),
      );

      return {
        ...provider,
        count: models.length,
        models,
      };
    })
    .filter((provider) => provider.count > 0);

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
      command: "powershell.exe",
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

/**
 * 只暴露极简输入项，因此这里固定好安全默认值和标准化的部署动作。
 */
export function buildDeploymentPlan(envState, payload) {
  const modelRef = resolveModelRef(payload.modelRef || payload.modelId);
  const providerId = modelRef.split("/")[0]?.toLowerCase();
  const provider = PROVIDER_CATALOG[providerId];
  const bot = BOT_CATALOG[payload.botId];

  if (!modelRef || !provider || !bot) {
    throw new Error("无效的模型或聊天机器人选择。");
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

  steps.push(
    {
      id: "validate-config",
      title: "校验配置是否可用",
      command: "openclaw",
      args: ["config", "validate"],
    },
    {
      id: "restart-gateway",
      title: "重启 Gateway 使配置生效",
      command: "openclaw",
      args: ["gateway", "restart"],
    },
  );

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
    args: ["gateway", "status"],
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
    postDeployNotes: buildPostDeployNotes(payload.botId),
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
    "--install-daemon",
    "--daemon-runtime",
    "node",
    "--skip-skills",
    "--accept-risk",
  ];

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
function buildPostDeployNotes(botId) {
  if (botId === "telegram") {
    return [
      "Telegram 已启用。先去 Telegram 私聊你的机器人，发送一条普通消息来触发首个 pairing code。",
      "如果只发 /start 仍没看到配对码，请先执行 openclaw pairing list telegram 检查待审批请求。",
      "然后执行：openclaw pairing list telegram",
      "批准配对码：openclaw pairing approve telegram <CODE>",
    ];
  }

  if (botId === "whatsapp") {
    return ["按日志提示完成 WhatsApp 扫码登录后，即可开始私聊测试。"];
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
