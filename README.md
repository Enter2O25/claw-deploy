# OpenClaw 极简部署脚本

这是一个面向非专业用户的 OpenClaw 纯脚本部署方案。

目标只有一个：把原本需要手动安装环境、执行 `openclaw onboard`、调整默认配置的流程，压缩成下面 3 个主输入项：

1. 选择模型
2. 输入 API Key
3. 选择聊天机器人

如果选择 `Telegram`，会额外要求 1 个必要字段：

4. `Telegram Bot Token`

其余动作全部由向导自动执行：

- 从当前 OpenClaw 版本动态拉取最新模型目录
- 检测 Node / npm / OpenClaw 是否可用
- 缺少环境时调用 OpenClaw 官方安装脚本补齐
- 以非交互模式执行 `openclaw onboard`
- 写入默认模型
- 关闭默认心跳，避免首次部署后自动发消息
- 按聊天机器人类型写入安全默认配置
- 显式安装并启动后台 Gateway 服务
- 执行最终状态检查

## 推荐用法

### 远程一键命令

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Enter2O25/claw-deploy/main/install.sh | bash
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-WebRequest 'https://raw.githubusercontent.com/Enter2O25/claw-deploy/main/install.ps1' -UseBasicParsing).Content))"
```

这两个入口会自动：

- 下载当前仓库代码
- 安装到默认目录
  - macOS / Linux: `~/.claw-deploy`
  - Windows: `$HOME\.claw-deploy`
- 再调用本地部署脚本继续执行
- 安装过程中只展示本脚本自己的步骤提示，不直接暴露官方安装器原始输出
- 自动补一个稳定的 `openclaw` 命令入口，并写入常见 shell 的 PATH 配置

如果安装完成后当前终端仍然提示 `openclaw: command not found`：

- Linux / macOS 执行：`export PATH="$HOME/.local/bin:$PATH"`
- 或者重新打开一个终端会话

如果你是在 Linux 服务器上部署，并希望退出 SSH 后 OpenClaw 仍继续常驻，还需要执行一次：

```bash
sudo loginctl enable-linger $USER
```

如果要远程传参，也支持直接透传：

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Enter2O25/claw-deploy/main/install.sh | bash -s -- --model openai/gpt-5.4 --bot telegram --api-key sk-xxxx --telegram-bot-token 123456789:AAExample --yes
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-WebRequest 'https://raw.githubusercontent.com/Enter2O25/claw-deploy/main/install.ps1' -UseBasicParsing).Content)) --model openai/gpt-5.4 --bot telegram --api-key sk-xxxx --telegram-bot-token 123456789:AAExample --yes"
```

### 交互式一条命令

macOS / Linux:

```bash
bash install.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

执行后，脚本会在终端里依次引导用户：

1. 选择模型
2. 输入 API Key
3. 选择聊天机器人
4. 如果选择 Telegram，再输入 BotFather 生成的 Bot Token

其余步骤全部自动执行。

### 全自动一条命令

macOS / Linux:

```bash
bash install.sh --model openai/gpt-5.4 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 --model openai/gpt-5.4 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

这适合后续做成官网复制命令、远程安装或自动化发放脚本。

### Telegram 一条命令

macOS / Linux:

```bash
bash install.sh --model openai/gpt-5.4 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 --model openai/gpt-5.4 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

## 模型选择说明

- 交互模式下，脚本会先调用 `openclaw models list --all --plain` 拉取当前版本支持的最新模型目录。
- 终端里会按 provider 分组展示 `openclaw models list --all --plain` 的全部模型，不再只限静态白名单。
- 能用一把 API Key 自动完成鉴权的 provider，会继续走极简一键部署。
- 依赖主机已有登录态、云凭证或高级 endpoint 配置的 provider，也会显示在列表中，但脚本会提示你先完成对应的预配置。
- `--model` 参数建议直接传完整模型引用，例如：
  - `openai/gpt-5.4`
  - `anthropic/claude-sonnet-4-5`
  - `google/gemini-2.5-pro`
  - `huggingface/deepseek-ai/DeepSeek-R1`
  - `together/deepseek-ai/DeepSeek-R1`
  - `volcengine/deepseek-v3-2-251201`
  - `openrouter/openai/gpt-5.4`
- 为兼容旧版本脚本，`openai-gpt-5-2` 这类历史短 id 仍然可以识别，但不再推荐继续使用。
- DeepSeek 现在会优先通过 OpenClaw 已支持的一键 provider 出现在目录里，例如 `Hugging Face`、`Together AI`、`Volcano Engine`、`OpenRouter`。

## 当前极简模式支持

- `Telegram`
  - 自动写入 `channels.telegram.enabled`、`botToken`、`dmPolicy=pairing`
  - 会显式安装并启动后台 Gateway 服务
  - 默认关闭群消息，先用私聊完成首轮 pairing
  - 首次接入时先给机器人发一条普通私聊消息，再执行 `~/.local/bin/openclaw pairing list telegram` / `~/.local/bin/openclaw pairing approve telegram <CODE>`
- `WhatsApp 机器人`
  - 自动写入安全默认值
  - 会显式安装并启动后台 Gateway 服务
  - 最后一步进入二维码登录流程

暂未纳入默认脚本流程的渠道：

- `Discord`

原因不是技术不能做，而是这类渠道通常还需要用户提前去平台后台创建 Bot 并拿到额外 Token。Telegram 已在本版本中兼容，但会诚实地多要一个 Bot Token 字段。

## 目录说明

- [install.sh](/Users/liujinglong/my/project/claw-deploy/install.sh)
  - macOS / Linux 主入口
  - 支持本地执行和 `curl | bash` 远程执行
- [install.ps1](/Users/liujinglong/my/project/claw-deploy/install.ps1)
  - Windows PowerShell 主入口
  - 支持本地执行和远程 `Invoke-WebRequest` 在线执行
- [scripts/deploy.js](/Users/liujinglong/my/project/claw-deploy/scripts/deploy.js)
  - 终端交互式部署脚本
  - 支持 `--model`、`--api-key`、`--bot`、`--telegram-bot-token`、`--yes`、`--dry-run`
  - `--model` 推荐使用完整模型引用 `provider/model`
- [scripts/bootstrap.sh](/Users/liujinglong/my/project/claw-deploy/scripts/bootstrap.sh)
  - macOS / Linux 自举脚本
  - 缺少 Node 22+ 时先自动补环境
  - 在 `curl | bash` 场景下会主动把 stdin 接回当前终端
- [scripts/bootstrap.ps1](/Users/liujinglong/my/project/claw-deploy/scripts/bootstrap.ps1)
  - Windows PowerShell 自举脚本
  - 缺少 Node 22+ 时先自动补环境
- [core.js](/Users/liujinglong/my/project/claw-deploy/core.js)
  - 部署能力核心模块
  - 负责环境探测、最新模型目录拉取、部署编排和日志脱敏

## 实现假设

- 使用 OpenClaw 官方文档推荐的安装方式：
  - `install.sh`
  - `install.ps1`
  - `openclaw onboard --non-interactive`
  - `openclaw gateway install --runtime node --force`
  - `openclaw gateway start`
- WhatsApp 允许保留最后一步扫码登录，因为它不是额外文本输入，仍符合“极简输入”的目标。
- Telegram 按 OpenClaw 官方接入方式，需要额外提供 BotFather 的 Bot Token；脚本会把这一步收敛成单独一个字段。
- 默认把群消息关闭、私聊改成 `pairing`，先保证安全，再考虑开放更多范围。
- Linux 服务器若要求“退出 SSH 后仍继续运行”，仍需按 systemd user service 的要求启用 `loginctl enable-linger`。
- 现在会展示 OpenClaw 全量模型目录；其中一部分 provider 只能在主机上先完成 OAuth、云凭证或 endpoint 配置后再使用。
- 远程安装入口默认从 GitHub Raw 下载当前脚本，再从 GitHub 仓库归档下载完整代码。
- 如需切换仓库、分支或安装目录，可覆盖下面这些环境变量：
  - `CLAW_DEPLOY_REPOSITORY`
  - `CLAW_DEPLOY_REF`
  - `CLAW_DEPLOY_HOME`
  - `CLAW_DEPLOY_ARCHIVE_URL`
