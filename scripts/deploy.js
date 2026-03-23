#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import {
  BOT_CATALOG,
  MODEL_CATALOG,
  buildDeploymentPlan,
  buildShellEnv,
  detectEnvironment,
  sanitizeLog,
} from "../core.js";

const models = Object.values(MODEL_CATALOG);
const bots = Object.values(BOT_CATALOG);
const CREDENTIAL_ARG_MAP = {
  "--telegram-bot-token": "telegramBotToken",
};

/**
 * 解析命令行参数，既支持纯交互，也支持自动化场景直接传参。
 */
function parseArgs(argv) {
  const args = {
    modelId: "",
    apiKey: "",
    botId: "",
    telegramBotToken: "",
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

/**
 * 读取编号选择，并把输入映射为具体配置项。
 */
async function promptChoice(rl, title, items, describe, fallbackId = "") {
  renderChoices(title, items, describe);

  while (true) {
    const answer = (await rl.question(`请输入编号${fallbackId ? `，直接回车默认 ${fallbackId}` : ""}：`)).trim();

    if (!answer && fallbackId) {
      return items.find((item) => item.id === fallbackId);
    }

    const numericIndex = Number(answer);
    if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= items.length) {
      return items[numericIndex - 1];
    }

    const byId = items.find((item) => item.id === answer);
    if (byId) {
      return byId;
    }

    console.log("输入无效，请重新选择。");
  }
}

/**
 * 通过 raw mode 隐藏 API Key 回显，避免在终端里直接泄露凭证。
 */
async function promptSecret(question) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    const fallbackRl = readline.createInterface({ input, output });
    const answer = await fallbackRl.question(question);
    fallbackRl.close();
    return answer.trim();
  }

  return new Promise((resolve) => {
    const chunks = [];

    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const onData = (chunk) => {
      const value = String(chunk);

      if (value === "\r" || value === "\n") {
        output.write("\n");
        input.setRawMode(false);
        input.pause();
        input.removeListener("data", onData);
        resolve(chunks.join("").trim());
        return;
      }

      if (value === "\u0003") {
        output.write("\n已取消部署。\n");
        process.exit(1);
      }

      if (value === "\u007f") {
        chunks.pop();
        return;
      }

      chunks.push(value);
    };

    input.on("data", onData);
  });
}

/**
 * 用清晰摘要向用户确认即将执行的动作，避免误部署。
 */
function printSummary(selection) {
  console.log("\n部署摘要");
  console.log(`  模型: ${selection.model.provider} / ${selection.model.label}`);
  console.log(`  聊天机器人: ${selection.bot.label}`);
  if (selection.bot.credentialFields?.length) {
    console.log(`  额外凭证: ${selection.bot.credentialFields.map((field) => field.label).join("、")}`);
  }
  console.log("  自动动作: 环境检测 -> 安装/修复 -> onboard -> 默认配置 -> 状态校验");
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
      const child = spawn(step.command, step.args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk) => {
        output.write(`${sanitizeLog(chunk.toString(), secrets)}`);
      });

      child.stderr.on("data", (chunk) => {
        output.write(`${sanitizeLog(chunk.toString(), secrets)}`);
      });

      child.on("error", reject);
      child.on("close", (code) => {
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
async function collectBotCredentials(rl, args, bot) {
  const values = {};

  for (const field of bot.credentialFields || []) {
    let value = args[field.id] || "";

    if (!value) {
      if (field.secret) {
        rl.pause();
        value = await promptSecret(`请输入 ${field.label}: `);
        rl.resume();
      } else {
        value = (await rl.question(`请输入 ${field.label}: `)).trim();
      }
    }

    values[field.id] = value.trim();
  }

  return values;
}

/**
 * 终端模式的主流程，只保留最少问题，其余全部自动化。
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("OpenClaw 极简部署脚本");
  console.log("默认只需要选择模型、输入 API Key、选择聊天机器人；若选 Telegram，会额外要求一个 Bot Token。");

  const environment = await detectEnvironment();
  printEnvironment(environment);

  const rl = readline.createInterface({ input, output });

  try {
    const model =
      models.find((item) => item.id === args.modelId) ||
      (await promptChoice(
        rl,
        "请选择模型",
        models,
        (item) => `${item.provider} / ${item.label} - ${item.hint}`,
        "openai-gpt-5-2",
      ));

    const bot =
      bots.find((item) => item.id === args.botId) ||
      (await promptChoice(
        rl,
        "请选择聊天机器人",
        bots,
        (item) => `${item.label} - ${item.description}`,
        "dashboard",
      ));

    let apiKey = args.apiKey;

    if (!apiKey) {
      rl.pause();
      apiKey = await promptSecret(`请输入 ${model.provider} 的 API Key: `);
      rl.resume();
    }

    const botCredentials = await collectBotCredentials(rl, args, bot);
    const selection = { model, bot, apiKey, botCredentials };

    printSummary(selection);

    if (!args.yes) {
      const confirm = (await rl.question("确认开始部署吗？(Y/n): ")).trim().toLowerCase();
      if (confirm && confirm !== "y" && confirm !== "yes") {
        console.log("已取消部署。");
        return;
      }
    }

    const plan = buildDeploymentPlan(environment, {
      modelId: model.id,
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
    rl.close();
  }
}

main().catch((error) => {
  console.error(`\n部署失败：${error.message}`);
  process.exit(1);
});
