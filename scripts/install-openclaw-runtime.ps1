$ErrorActionPreference = "Stop"
$logFile = Join-Path $env:TEMP ("claw-deploy-openclaw-install-" + $PID + ".log")
$keepLog = $false
$installCommand = if ($env:CLAW_DEPLOY_OPENCLAW_INSTALL_COMMAND) {
  $env:CLAW_DEPLOY_OPENCLAW_INSTALL_COMMAND
} else {
@"
`$tmp = Join-Path `$env:TEMP 'openclaw-install.ps1'
Invoke-WebRequest -Uri 'https://openclaw.ai/install.ps1' -OutFile `$tmp
& powershell -ExecutionPolicy Bypass -File `$tmp --no-onboard
Remove-Item `$tmp -Force
"@
}

function Invoke-QuietInstaller {
  $frames = @("|", "/", "-", "\")
  $frameIndex = 0

  # 这里把官方安装器输出重定向到日志文件，只把我们自己的步骤提示留在前台。
  $wrappedCommand = "& { $installCommand } *> '$logFile'"
  $process = Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $wrappedCommand -PassThru -WindowStyle Hidden

  while (-not $process.HasExited) {
    $frame = $frames[$frameIndex % $frames.Count]
    Write-Host -NoNewline "`r  · 正在安装 Node.js / OpenClaw 运行环境 $frame"
    Start-Sleep -Milliseconds 200
    $process.Refresh()
    $frameIndex += 1
  }

  if ($process.ExitCode -eq 0) {
    Write-Host "`r  ✓ 正在安装 Node.js / OpenClaw 运行环境"
    return
  }

  $script:keepLog = $true
  Write-Host "`r  ✗ 正在安装 Node.js / OpenClaw 运行环境"
  Write-Host "  · 安装失败，最近日志如下："
  Get-Content -Path $logFile -Tail 40 | ForEach-Object {
    Write-Host "  │ $_"
  }
  exit $process.ExitCode
}

try {
  Invoke-QuietInstaller
} finally {
  if ((-not $keepLog) -and (Test-Path $logFile)) {
    Remove-Item -Path $logFile -Force
  }
}
