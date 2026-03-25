#!/usr/bin/env node
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { ReadStream, WriteStream } from "node:tty";
import {
  BOT_CATALOG,
  buildSpawnInvocation,
  buildDeploymentPlan,
  buildShellEnv,
  detectEnvironment,
  loadModelCatalog,
  resolveModelRef,
  sanitizeLog,
} from "../core.js";

const bots = Object.values(BOT_CATALOG);
const CREDENTIAL_ARG_MAP = {
  "--telegram-bot-token": "telegramBotToken",
  "--feishu-app-id": "feishuAppId",
  "--feishu-app-secret": "feishuAppSecret",
};

function createInteractiveTerminal() {
  if (input.isTTY && output.isTTY) {
    return {
      input,
      output,
      cleanup() {},
    };
  }

  const inputPath = process.platform === "win32" ? "CONIN$" : "/dev/tty";
  const outputPath = process.platform === "win32" ? "CONOUT$" : "/dev/tty";

  try {
    const inputFd = openSync(inputPath, "r");
    const outputFd = openSync(outputPath, "w");

    return {
      input: new ReadStream(inputFd),
      output: new WriteStream(outputFd),
      cleanup() {
        closeSync(inputFd);
        closeSync(outputFd);
      },
    };
  } catch {
    return {
      input,
      output,
      cleanup() {},
    };
  }
}

/**
 * 普通文本输入尽量不碰 raw mode，避免某些服务器终端对 setRawMode 支持不稳定。
 */
async function promptLine(question, terminal) {
  terminal.output.write(question);
  terminal.input.resume();
  terminal.input.setEncoding("utf8");

  return new Promise((resolve) => {
    let buffer = "";

    const cleanup = () => {
      terminal.input.removeListener("data", onData);
      terminal.input.removeListener("end", onEnd);
    };

    const finish = (value) => {
      cleanup();
      resolve(value.trim());
    };

    const onEnd = () => {
      terminal.output.write("\n");
      finish(buffer);
    };

    const onData = (chunk) => {
      const value = String(chunk);

      if (value.includes("\u0003")) {
        terminal.output.write("\n已取消部署。\n");
        process.exit(1);
      }

      buffer += value;
      if (!buffer.includes("\n") && !buffer.includes("\r")) {
        return;
      }

      terminal.output.write("\n");
      finish(buffer.replace(/[\r\n]+$/, ""));
    };

    terminal.input.on("data", onData);
    terminal.input.on("end", onEnd);
  });
}

/**
 * 解析命令行参数，既支持纯交互，也支持自动化场景直接传参。
 */
function parseArgs(argv) {
  const args = {
    modelId: "",
    apiKey: "",
    botId: "",
    telegramBotToken: "",
    feishuAppId: "",
    feishuAppSecret: "",
    yes: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--model") {
      args.modelId = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (current === "--api-key") {
      args.apiKey = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (current === "--bot") {
      args.botId = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (CREDENTIAL_ARG_MAP[current]) {
      args[CREDENTIAL_ARG_MAP[current]] = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (current === "--yes") {
      args.yes = true;
      continue;
    }

    if (current === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

/**
 * 把可选项渲染成编号列表，降低终端交互时的认知负担。
 */
function renderChoices(title, items, describe) {
  console.log(`\n${title}`);
  items.forEach((item, index) => {
    console.log(`  ${index + 1}. ${describe(item)}`);
  });
}

function getChoiceIdentity(item) {
  return item.id || item.ref || "";
}

function buildModelAuthSummary(provider) {
  if (provider.setupMode === "onboard-api-key") {
    return `输入 ${provider.keyLabel} 后，脚本会自动完成一键鉴权。`;
  }

  if (provider.setupMode === "env-api-key") {
    return `输入 ${provider.keyLabel} 后，脚本会自动写入 ${provider.envVar}。`;
  }

  return "该 provider 依赖主机已有登录态或环境凭证，脚本会直接沿用。";
}

/**
 * 读取编号选择，并把输入映射为具体配置项。
 */
async function promptChoice(terminal, title, items, describe, fallbackId = "") {
  renderChoices(title, items, describe);
  const fallbackItem = fallbackId ? items.find((item) => getChoiceIdentity(item) === fallbackId) : undefined;

  while (true) {
    const answer = (await promptLine(`请输入编号${fallbackItem ? `，直接回车默认 ${getChoiceIdentity(fallbackItem)}` : ""}：`, terminal)).trim();

    if (!answer && fallbackItem) {
      return fallbackItem;
    }

    const numericIndex = Number(answer);
    if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= items.length) {
      return items[numericIndex - 1];
    }

    const byId = items.find((item) => getChoiceIdentity(item) === answer);
    if (byId) {
      return byId;
    }

    console.log("输入无效，请重新选择。");
  }
}

/**
 * 通过 raw mode 隐藏 API Key 回显，避免在终端里直接泄露凭证。
 */
async function promptSecret(question, terminal) {
  if (!terminal.input.isTTY || typeof terminal.input.setRawMode !== "function") {
    return promptLine(question, terminal);
  }

  return new Promise((resolve) => {
    const chunks = [];
    let rawModeEnabled = false;

    terminal.output.write(question);
    try {
      terminal.input.setRawMode(true);
      rawModeEnabled = true;
      terminal.input.resume();
      terminal.input.setEncoding("utf8");
    } catch {
      terminal.output.write("\n");
      resolve(promptLine("", terminal));
      return;
    }

    const onData = (chunk) => {
      const value = String(chunk);

      if (value === "\r" || value === "\n") {
        terminal.output.write("\n");
        if (rawModeEnabled) {
          terminal.input.setRawMode(false);
        }
        terminal.input.pause();
        terminal.input.removeListener("data", onData);
        resolve(chunks.join("").trim());
        return;
      }

      if (value === "\u0003") {
        terminal.output.write("\n已取消部署。\n");
        process.exit(1);
      }

      if (value === "\u007f") {
        chunks.pop();
        return;
      }

      chunks.push(value);
    };

    terminal.input.on("data", onData);
  });
}

/**
 * 用清晰摘要向用户确认即将执行的动作，避免误部署。
 */
function printSummary(selection) {
  console.log("\n部署摘要");
  console.log(`  模型: ${selection.model.provider} / ${selection.model.label}`);
  console.log(`  聊天机器人: ${selection.bot.label}`);
  if (selection.model.authSummary) {
    console.log(`  模型鉴权: ${selection.model.authSummary}`);
  }
  if (selection.bot.credentialFields?.length) {
    console.log(`  额外凭证: ${selection.bot.credentialFields.map((field) => field.label).join("、")}`);
  }
  console.log("  自动动作: 环境检测 -> 安装/修复 -> onboard -> 默认配置 -> 后台服务 -> 状态校验");
}

function printModelCatalogSummary(catalog) {
  const automatedProviderCount = catalog.providers.filter((provider) => provider.setupMode !== "preconfigured").length;

  if (catalog.source === "openclaw") {
    console.log(
      `已从 OpenClaw 拉取最新模型目录：共发现 ${catalog.totalCount} 个模型，当前脚本会展示其中全部 ${catalog.availableCount} 个，已内建自动鉴权能力的 provider 共 ${automatedProviderCount} 个。`,
    );
    return;
  }

  console.log("未能读取 OpenClaw 在线模型目录，已退回到内置保底模型列表。");
}

/**
 * 把环境检测结果压缩成终端友好的状态面板。
 */
function printEnvironment(environment) {
  console.log("环境检测");
  console.log(`  系统: ${environment.platform.os} / ${environment.platform.arch}`);
  console.log(
    `  Node: ${
      environment.node.available
        ? `${environment.node.version?.raw || environment.node.raw}${environment.node.version?.major >= 22 ? " (可用)" : " (需要升级)"}`
        : "未检测到，将自动安装"
    }`,
  );
  console.log(
    `  npm: ${
      environment.npm.available ? `${environment.npm.version?.raw || environment.npm.raw} (可用)` : "未检测到，将自动补齐"
    }`,
  );
  console.log(
    `  OpenClaw: ${
      environment.openclaw.available ? `${environment.openclaw.version?.raw || environment.openclaw.raw} (可用)` : "未检测到，将自动安装"
    }`,
  );
}

/**
 * 统一执行部署步骤并实时打印日志，便于直接用脚本完成整套流程。
 */
async function runPlan(plan, secrets) {
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const env = await buildShellEnv();

    console.log(`\n[${index + 1}/${plan.steps.length}] ${step.title}`);

    await new Promise((resolve, reject) => {
      const invocation = buildSpawnInvocation(step.command, step.args, {
        env,
        shell: step.shell ?? false,
      });
      const completionEvent = step.waitForExit ? "exit" : "close";
      const child = spawn(invocation.command, invocation.args, {
        ...invocation.options,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk) => {
        output.write(`${sanitizeLog(chunk.toString(), secrets)}`);
      });

      child.stderr.on("data", (chunk) => {
        output.write(`${sanitizeLog(chunk.toString(), secrets)}`);
      });

      child.on("error", reject);
      child.on(completionEvent, (code) => {
        if ((code ?? 0) !== 0) {
          reject(new Error(`${step.title} 失败，退出码 ${code}`));
          return;
        }

        resolve();
      });
    });
  }
}

/**
 * 根据所选渠道收集必要凭证，避免把 Telegram 这类特殊要求硬编码到主流程里。
 */
async function collectBotCredentials(args, bot, terminal) {
  const values = {};

  for (const field of bot.credentialFields || []) {
    let value = args[field.id] || "";

    if (!value) {
      if (field.secret) {
        value = await promptSecret(`请输入 ${field.label}: `, terminal);
      } else {
        value = (await promptLine(`请输入 ${field.label}: `, terminal)).trim();
      }
    }

    values[field.id] = value.trim();
  }

  return values;
}

function findModelByRef(catalog, modelRef) {
  for (const provider of catalog.providers) {
    const found = provider.models.find((model) => model.ref === modelRef);
    if (found) {
      return { provider, model: found };
    }
  }

  return null;
}

/**
 * 模型数量会随着 OpenClaw 版本增长，因此改成运行时拉取并按提供商分组选择。
 */
async function selectModel(terminal, args) {
  const catalog = await loadModelCatalog();
  const requestedRef = resolveModelRef(args.modelId);

  printModelCatalogSummary(catalog);

  if (requestedRef) {
    const resolved = findModelByRef(catalog, requestedRef);
    if (!resolved) {
      throw new Error(`未在当前 OpenClaw 模型目录中找到 ${requestedRef}。`);
    }

    return {
      provider: resolved.provider,
      model: resolved.model,
      catalog,
    };
  }

  const provider = await promptChoice(
    terminal,
    "请选择模型提供商",
    catalog.providers,
    (item) => `${item.label} - ${item.count} 个模型 - ${item.hint}`,
    catalog.providers.find((item) => item.id === "openai")?.id || catalog.providers[0]?.id || "",
  );

  const defaultModelRef = provider.preferredModels.find((ref) => provider.models.some((model) => model.ref === ref));
  const defaultModel = provider.models.find((model) => model.ref === defaultModelRef) || provider.models[0];
  const model = await promptChoice(
    terminal,
    `请选择 ${provider.label} 模型`,
    provider.models,
    (item) => item.ref,
    defaultModel?.ref || "",
  );

  return {
    provider,
    model,
    catalog,
  };
}

/**
 * 终端模式的主流程，只保留最少问题，其余全部自动化。
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const terminal = createInteractiveTerminal();

  console.log("OpenClaw 极简部署脚本");
  console.log("默认只需要选择模型、输入 API Key、选择聊天机器人；若选 Telegram 或飞书，会额外要求对应渠道凭证。");

  const environment = await detectEnvironment();
  printEnvironment(environment);

  try {
    const selection = await selectModel(terminal, args);
    const model = {
      id: selection.model.ref,
      provider: selection.provider.label,
      label: selection.model.label,
      modelRef: selection.model.ref,
      keyLabel: selection.provider.keyLabel,
      setupMode: selection.provider.setupMode,
      envVar: selection.provider.envVar,
      authSummary: buildModelAuthSummary(selection.provider),
    };

    const bot =
      bots.find((item) => item.id === args.botId) ||
      (await promptChoice(
        terminal,
        "请选择聊天机器人",
        bots,
        (item) => `${item.label} - ${item.description}`,
        "telegram",
      ));

    let apiKey = args.apiKey;

    if ((selection.provider.setupMode === "onboard-api-key" || selection.provider.setupMode === "env-api-key") && !apiKey) {
      apiKey = await promptLine(`请输入 ${model.keyLabel}（将直接显示，便于核对）: `, terminal);
    }

    const botCredentials = await collectBotCredentials(args, bot, terminal);
    const summarySelection = { model, bot, apiKey, botCredentials };

    printSummary(summarySelection);

    if (!args.yes) {
      const confirm = (await promptLine("确认开始部署吗？(Y/n): ", terminal)).trim().toLowerCase();
      if (confirm && confirm !== "y" && confirm !== "yes") {
        console.log("已取消部署。");
        return;
      }
    }

    const plan = buildDeploymentPlan(environment, {
      modelRef: model.modelRef,
      apiKey,
      botId: bot.id,
      ...botCredentials,
    });

    if (args.dryRun) {
      console.log("\nDry run 模式，不实际执行命令。");
      plan.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.title}`);
      });
      for (const note of plan.postDeployNotes || []) {
        console.log(`  提示: ${note}`);
      }
      return;
    }

    await runPlan(plan, [apiKey, ...Object.values(botCredentials)]);
    console.log(`\n部署完成。${bot.resultHint}`);
    for (const note of plan.postDeployNotes || []) {
      console.log(`- ${note}`);
    }
  } finally {
    terminal.cleanup();
  }
}

main().catch((error) => {
  console.error(`\n部署失败：${error.message}`);
  process.exit(1);
});
