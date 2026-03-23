$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$targetScript = Join-Path $rootDir "scripts\deploy.js"

function Write-Step {
  param(
    [string]$Index,
    [string]$Title
  )

  Write-Host ""
  Write-Host "[$Index] $Title"
}

function Add-PathLineIfMissing {
  param(
    [string]$FilePath,
    [string]$Line
  )

  if (-not (Test-Path $FilePath)) {
    Set-Content -Path $FilePath -Value $Line
    return
  }

  $content = Get-Content -Path $FilePath -Raw
  if ($content -notmatch [regex]::Escape($Line)) {
    Add-Content -Path $FilePath -Value "`n$Line"
  }
}

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

function Find-OpenClaw {
  $shimPath = [System.IO.Path]::GetFullPath((Join-Path $HOME ".claw-deploy\bin\openclaw.cmd"))
  $commands = Get-Command openclaw -All -ErrorAction SilentlyContinue

  # 跳过我们自己生成的 shim，避免二次执行时把 shim 再包装成指向自身的入口。
  foreach ($command in $commands) {
    $candidate = [System.IO.Path]::GetFullPath($command.Source)
    if ($candidate -ne $shimPath) {
      return $candidate
    }
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    $npmPrefix = & $npm.Source prefix -g 2>$null
    if ($npmPrefix) {
      $candidate = Join-Path $npmPrefix "openclaw.cmd"
      if (Test-Path $candidate) {
        return $candidate
      }
    }
  }

  if ($env:APPDATA) {
    $candidate = Join-Path $env:APPDATA "npm\openclaw.cmd"
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Ensure-OpenClawCommand {
  param(
    [string]$OpenClawPath
  )

  $shimDir = Join-Path $HOME ".claw-deploy\bin"
  $shimPath = Join-Path $shimDir "openclaw.cmd"

  if ([System.IO.Path]::GetFullPath($OpenClawPath) -eq [System.IO.Path]::GetFullPath($shimPath)) {
    return
  }

  New-Item -ItemType Directory -Path $shimDir -Force | Out-Null

  # 用固定 shim 包一层，避免 npm 全局目录变动后用户还要重新找真正的 openclaw 可执行文件。
  Set-Content -Path $shimPath -Value "@echo off`r`n""$OpenClawPath"" %*"

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $pathEntries = @()
  if ($userPath) {
    $pathEntries = $userPath -split ";" | Where-Object { $_ }
  }

  if ($pathEntries -notcontains $shimDir) {
    $newUserPath = @($shimDir) + $pathEntries
    [Environment]::SetEnvironmentVariable("Path", ($newUserPath -join ";"), "User")
  }
}

$nodePath = Find-Node

Write-Step "步骤 2/3" "检测运行环境"

if (-not $nodePath) {
  Write-Host "  · 未检测到 Node 22+，准备自动安装运行环境"
  & powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "scripts\install-openclaw-runtime.ps1")
  $nodePath = Find-Node
}

if (-not $nodePath) {
  throw "自动安装后仍未找到 node，请重新打开 PowerShell 后再执行本脚本。"
}

$nodeMajor = & $nodePath -p "process.versions.node.split('.')[0]"

if ([int]$nodeMajor -lt 22) {
  Write-Host "  · 当前 Node 版本低于 22，准备自动升级运行环境"
  & powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "scripts\install-openclaw-runtime.ps1")
  $nodePath = Find-Node
  $nodeMajor = & $nodePath -p "process.versions.node.split('.')[0]"
}

$openclawPath = Find-OpenClaw
if ($openclawPath) {
  Ensure-OpenClawCommand -OpenClawPath $openclawPath
}

Write-Step "步骤 3/3" "启动部署向导"
Write-Host "  ✓ Node.js $nodeMajor 已就绪"
if ($openclawPath) {
  Write-Host "  ✓ 已配置 openclaw 命令入口"
  Write-Host "  · 如需在当前终端直接使用 openclaw，请重新打开 PowerShell"
}
& $nodePath $targetScript @args
