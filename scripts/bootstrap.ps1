$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$targetScript = Join-Path $rootDir "scripts\deploy.js"

function Find-Node {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

$nodePath = Find-Node

if (-not $nodePath) {
  Write-Host "未检测到 Node 22+，正在调用 OpenClaw 官方安装脚本自动补齐环境..."
  $tempScript = Join-Path $env:TEMP "openclaw-install.ps1"
  Invoke-WebRequest -Uri "https://openclaw.ai/install.ps1" -OutFile $tempScript
  & powershell -ExecutionPolicy Bypass -File $tempScript --no-onboard
  Remove-Item $tempScript -Force
  $nodePath = Find-Node
}

if (-not $nodePath) {
  throw "自动安装后仍未找到 node，请重新打开 PowerShell 后再执行本脚本。"
}

$nodeMajor = & $nodePath -p "process.versions.node.split('.')[0]"

if ([int]$nodeMajor -lt 22) {
  Write-Host "当前 Node 版本低于 22，正在尝试通过 OpenClaw 官方安装脚本升级..."
  $tempScript = Join-Path $env:TEMP "openclaw-install.ps1"
  Invoke-WebRequest -Uri "https://openclaw.ai/install.ps1" -OutFile $tempScript
  & powershell -ExecutionPolicy Bypass -File $tempScript --no-onboard
  Remove-Item $tempScript -Force
}

Write-Host "启动 OpenClaw 极简部署向导..."
& $nodePath $targetScript @args
