$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Get-WindowsPowerShellPath {
  $systemRoot = if ($env:SystemRoot) { $env:SystemRoot } else { $env:WINDIR }
  if (-not $systemRoot) {
    return "powershell.exe"
  }

  return Join-Path $systemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
}

function Invoke-CustomInstallerCommand {
  param(
    [string]$CommandText
  )

  if (-not $CommandText) {
    return
  }

  Write-Host "  · 正在执行自定义运行环境安装命令..."
  Invoke-Expression $CommandText

  if ($LASTEXITCODE -and ($LASTEXITCODE -ne 0)) {
    throw "自定义运行环境安装命令执行失败，退出码：$LASTEXITCODE"
  }
}

function Invoke-OfficialInstaller {
  $installerPath = Join-Path $env:TEMP ("openclaw-install-" + [System.Guid]::NewGuid().ToString("N") + ".ps1")
  $powershellPath = Get-WindowsPowerShellPath

  try {
    Write-Host "  · 正在下载 OpenClaw 官方安装器..."
    Invoke-WebRequest -Uri "https://openclaw.ai/install.ps1" -OutFile $installerPath

    # 继续使用子 PowerShell 执行官方脚本，但保留当前终端输出，
    # 这样既能看到真实进度，也能用 UTF-8 避免 Node 读取后出现乱码。
    $escapedInstallerPath = $installerPath.Replace("'", "''")
    $bootstrapCommand = @"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
& '$escapedInstallerPath' -NoOnboard
exit `$LASTEXITCODE
"@

    Write-Host "  · 正在安装 Node.js / OpenClaw 运行环境，首次执行可能需要几分钟..."
    & $powershellPath -NoProfile -ExecutionPolicy Bypass -Command $bootstrapCommand

    if ($LASTEXITCODE -and ($LASTEXITCODE -ne 0)) {
      throw "OpenClaw 官方安装器执行失败，退出码：$LASTEXITCODE"
    }
  } finally {
    if (Test-Path $installerPath) {
      Remove-Item -Path $installerPath -Force
    }
  }
}

if ($env:CLAW_DEPLOY_OPENCLAW_INSTALL_COMMAND) {
  Invoke-CustomInstallerCommand -CommandText $env:CLAW_DEPLOY_OPENCLAW_INSTALL_COMMAND
} else {
  Invoke-OfficialInstaller
}
