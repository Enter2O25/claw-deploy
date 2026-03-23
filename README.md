# OpenClaw 极简部署脚本

这是一个面向非专业用户的 OpenClaw 纯脚本部署方案。

目标只有一个：把原本需要手动安装环境、执行 `openclaw onboard`、调整默认配置的流程，压缩成下面 3 个主输入项：

1. 选择模型
2. 输入 API Key
3. 选择聊天机器人

如果选择 `Telegram`，会额外要求 1 个必要字段：

4. `Telegram Bot Token`

其余动作全部由向导自动执行：

- 检测 Node / npm / OpenClaw 是否可用
- 缺少环境时调用 OpenClaw 官方安装脚本补齐
- 以非交互模式执行 `openclaw onboard`
- 写入默认模型
- 关闭默认心跳，避免首次部署后自动发消息
- 按聊天机器人类型写入安全默认配置
- 重启 Gateway 并做最终状态检查

## 推荐用法

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
bash install.sh --model openai-gpt-5-2 --api-key sk-xxxx --bot dashboard --yes
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 --model openai-gpt-5-2 --api-key sk-xxxx --bot dashboard --yes
```

这适合后续做成官网复制命令、远程安装或自动化发放脚本。

### Telegram 一条命令

macOS / Linux:

```bash
bash install.sh --model openai-gpt-5-2 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 --model openai-gpt-5-2 --api-key sk-xxxx --bot telegram --telegram-bot-token 123456789:AAExample --yes
```

## 当前极简模式支持

- `控制台网页聊天`
  - 最低门槛
  - 部署完成后直接打开 OpenClaw Dashboard 使用
- `WhatsApp 机器人`
  - 自动写入安全默认值
  - 最后一步进入二维码登录流程
- `Telegram`
  - 自动写入 `channels.telegram.enabled`、`botToken`、`dmPolicy=pairing`
  - 默认关闭群消息，先用私聊完成首轮 pairing
  - 首次接入时先给机器人发一条普通私聊消息，再执行 `openclaw pairing list telegram` / `openclaw pairing approve telegram <CODE>`

暂未纳入默认脚本流程的渠道：

- `Discord`

原因不是技术不能做，而是这类渠道通常还需要用户提前去平台后台创建 Bot 并拿到额外 Token。Telegram 已在本版本中兼容，但会诚实地多要一个 Bot Token 字段。

## 目录说明

- [install.sh](/Users/liujinglong/my/project/claw-deploy/install.sh)
  - macOS / Linux 主入口
- [install.ps1](/Users/liujinglong/my/project/claw-deploy/install.ps1)
  - Windows PowerShell 主入口
- [scripts/deploy.js](/Users/liujinglong/my/project/claw-deploy/scripts/deploy.js)
  - 终端交互式部署脚本
  - 支持 `--model`、`--api-key`、`--bot`、`--telegram-bot-token`、`--yes`、`--dry-run`
- [scripts/bootstrap.sh](/Users/liujinglong/my/project/claw-deploy/scripts/bootstrap.sh)
  - macOS / Linux 自举脚本
  - 缺少 Node 22+ 时先自动补环境
- [scripts/bootstrap.ps1](/Users/liujinglong/my/project/claw-deploy/scripts/bootstrap.ps1)
  - Windows PowerShell 自举脚本
  - 缺少 Node 22+ 时先自动补环境
- [core.js](/Users/liujinglong/my/project/claw-deploy/core.js)
  - 部署能力核心模块
  - 负责环境探测、部署编排和日志脱敏

## 实现假设

- 使用 OpenClaw 官方文档推荐的安装方式：
  - `install.sh`
  - `install.ps1`
  - `openclaw onboard --non-interactive`
- Dashboard 视为最低门槛聊天入口，因为它不需要额外渠道凭证。
- WhatsApp 允许保留最后一步扫码登录，因为它不是额外文本输入，仍符合“极简输入”的目标。
- Telegram 按 OpenClaw 官方接入方式，需要额外提供 BotFather 的 Bot Token；脚本会把这一步收敛成单独一个字段。
- 默认把群消息关闭、私聊改成 `pairing`，先保证安全，再考虑开放更多范围。
- 如果后续把 `install.sh` / `install.ps1` 发布到可访问地址，就可以直接包装成真正的远程一键命令：
  - `curl -fsSL https://your-domain/install.sh | bash`
  - `powershell -ExecutionPolicy Bypass -Command "iwr https://your-domain/install.ps1 -UseBasicParsing | iex"`
