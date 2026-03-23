import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MODEL_CATALOG = {
  "anthropic-sonnet-4-5": {
    id: "anthropic-sonnet-4-5",
    provider: "Anthropic",
    label: "Claude Sonnet 4.5",
    modelRef: "anthropic/claude-sonnet-4-5",
    authChoice: "anthropic-api-key",
    keyFlag: "--anthropic-api-key",
    placeholder: "sk-ant-api03-...",
    hint: "适合稳定的高质量日常聊天与任务执行。",
  },
  "openai-gpt-5-2": {
    id: "openai-gpt-5-2",
    provider: "OpenAI",
    label: "GPT-5.2",
    modelRef: "openai/gpt-5.2",
    authChoice: "openai-api-key",
    keyFlag: "--openai-api-key",
    placeholder: "sk-...",
    hint: "工具调用和综合能力均衡，适合通用助手。",
  },
  "gemini-2-5-pro": {
    id: "gemini-2-5-pro",
    provider: "Google",
    label: "Gemini 2.5 Pro",
    modelRef: "gemini/gemini-2.5-pro",
    authChoice: "gemini-api-key",
    keyFlag: "--gemini-api-key",
    placeholder: "AIza...",
    hint: "多模态能力较强，适合资料整理和分析。",
  },
  "zai-glm-5": {
    id: "zai-glm-5",
    provider: "Z.AI",
    label: "GLM-5",
    modelRef: "zai/glm-5",
    authChoice: "zai-api-key",
    keyFlag: "--zai-api-key",
    placeholder: "zai_...",
    hint: "中文体验更自然，适合本地化助手场景。",
  },
  "huggingface-deepseek-r1": {
    id: "huggingface-deepseek-r1",
    provider: "Hugging Face",
    label: "DeepSeek-R1",
    modelRef: "huggingface/deepseek-ai/DeepSeek-R1",
    authChoice: "huggingface-api-key",
    keyFlag: "--huggingface-api-key",
    placeholder: "hf_...",
    hint: "适合已有 Hugging Face Token 的低门槛接入。",
  },
};

export const BOT_CATALOG = {
  dashboard: {
    id: "dashboard",
    label: "控制台网页聊天",
    description: "零额外配置，部署完成后直接在浏览器里聊天。",
    resultHint: "部署完成后可直接打开 Dashboard 使用。",
    credentialFields: [],
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp 机器人",
    description: "部署完成后自动进入二维码登录步骤，适合手机聊天。",
    resultHint: "部署完成后请按日志提示完成 WhatsApp 扫码登录。",
    credentialFields: [],
  },
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
};

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
  const model = MODEL_CATALOG[payload.modelId];
  const bot = BOT_CATALOG[payload.botId];

  if (!model || !bot) {
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
    args: [
      "onboard",
      "--non-interactive",
      "--mode",
      "local",
      "--auth-choice",
      model.authChoice,
      model.keyFlag,
      payload.apiKey,
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
    ],
  });

  steps.push({
    id: "set-model",
    title: "设置默认模型",
    command: "openclaw",
    args: ["config", "set", "agents.defaults.model.primary", JSON.stringify(model.modelRef), "--strict-json"],
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

  if (payload.botId === "dashboard") {
    steps.push({
      id: "dashboard-url",
      title: "生成 Dashboard 访问地址",
      command: "openclaw",
      args: ["dashboard", "--no-open"],
    });
  } else if (payload.botId === "whatsapp") {
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
    model,
    bot,
    steps,
    postDeployNotes: buildPostDeployNotes(payload.botId),
  };
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

  return ["可直接打开 Dashboard 进行聊天测试。"];
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
