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

Write-Step "步骤 3/3" "启动部署向导"
Write-Host "  ✓ Node.js $nodeMajor 已就绪"
& $nodePath $targetScript @args
