$ErrorActionPreference = "Stop"

# 既支持本地仓库直接执行，也支持远程 Invoke-Expression 在线拉起。
$scriptDir = $null
if ($PSCommandPath) {
  $scriptDir = Split-Path -Parent $PSCommandPath
}

if ($scriptDir -and (Test-Path (Join-Path $scriptDir "scripts\bootstrap.ps1"))) {
  & (Join-Path $scriptDir "scripts\bootstrap.ps1") @args
  exit $LASTEXITCODE
}

$repository = if ($env:CLAW_DEPLOY_REPOSITORY) { $env:CLAW_DEPLOY_REPOSITORY } else { "Enter2O25/claw-deploy" }
$refName = if ($env:CLAW_DEPLOY_REF) { $env:CLAW_DEPLOY_REF } else { "main" }
$installHome = if ($env:CLAW_DEPLOY_HOME) { $env:CLAW_DEPLOY_HOME } else { Join-Path $HOME ".claw-deploy" }
$archiveUrl = if ($env:CLAW_DEPLOY_ARCHIVE_URL) {
  $env:CLAW_DEPLOY_ARCHIVE_URL
} else {
  "https://github.com/$repository/archive/refs/heads/$refName.zip"
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("claw-deploy-" + [System.Guid]::NewGuid().ToString("N"))
$archiveFile = Join-Path $tmpDir "claw-deploy.zip"
$extractDir = Join-Path $tmpDir "extract"
$backupDir = "$installHome.backup"

function Write-Step {
  param(
    [string]$Index,
    [string]$Title
  )

  Write-Host ""
  Write-Host "[$Index] $Title"
}

# 直接按 UTF-8 读取并补写 BOM，避免 Windows PowerShell 5.1
# 把仓库里的 UTF-8 无 BOM 脚本按本地代码页误读后触发解析错误。
function Convert-PowerShellScriptsToUtf8Bom {
  param(
    [string]$RootPath
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false, $true
  $utf8Bom = New-Object System.Text.UTF8Encoding -ArgumentList $true

  Get-ChildItem -Path $RootPath -Filter "*.ps1" -File -Recurse | ForEach-Object {
    try {
      $content = [System.IO.File]::ReadAllText($_.FullName, $utf8NoBom)
      [System.IO.File]::WriteAllText($_.FullName, $content, $utf8Bom)
    } catch {
      throw "标准化 PowerShell 脚本编码失败：$($_.FullName) - $($_.Exception.Message)"
    }
  }
}

try {
  Write-Step "步骤 1/3" "下载并准备部署脚本"
  Write-Host "  · 仓库来源: $repository@$refName"
  New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
  Invoke-WebRequest -Uri $archiveUrl -OutFile $archiveFile
  Expand-Archive -Path $archiveFile -DestinationPath $extractDir -Force

  # 既兼容 GitHub 自动归档，也兼容镜像站直接把仓库根目录打进压缩包。
  $sourceDir = $null
  if (Test-Path (Join-Path $extractDir "scripts\bootstrap.ps1")) {
    $sourceDir = Get-Item $extractDir
  } else {
    $sourceDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
  }

  if (-not $sourceDir -or -not (Test-Path (Join-Path $sourceDir.FullName "scripts\bootstrap.ps1"))) {
    throw "远程安装包结构不符合预期，缺少 scripts/bootstrap.ps1。"
  }

  Write-Host "  · 准备本地安装目录"
  New-Item -ItemType Directory -Path (Split-Path -Parent $installHome) -Force | Out-Null

  if (Test-Path $backupDir) {
    Remove-Item -Path $backupDir -Recurse -Force
  }

  if (Test-Path $installHome) {
    Move-Item -Path $installHome -Destination $backupDir -Force
  }

  Move-Item -Path $sourceDir.FullName -Destination $installHome -Force
  Convert-PowerShellScriptsToUtf8Bom -RootPath $installHome
  Write-Host "  ✓ 代码已安装到 $installHome"
  & (Join-Path $installHome "scripts\bootstrap.ps1") @args
  exit $LASTEXITCODE
} finally {
  if (Test-Path $tmpDir) {
    Remove-Item -Path $tmpDir -Recurse -Force
  }
}
