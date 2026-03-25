param(
  [int]$TimeoutSeconds = 30,
  [switch]$Restart
)

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

function Get-OpenClawPath {
  $command = Get-Command openclaw -ErrorAction SilentlyContinue
  if ($command) {
    $resolvedPath = $command.Source
    $extension = [System.IO.Path]::GetExtension($resolvedPath)
    if ($extension -and @(".cmd", ".bat") -contains $extension.ToLowerInvariant()) {
      $ps1Candidate = [System.IO.Path]::ChangeExtension($resolvedPath, ".ps1")
      if (Test-Path $ps1Candidate) {
        return $ps1Candidate
      }
    }

    return $resolvedPath
  }

  $candidates = @(
    (Join-Path $HOME ".claw-deploy\bin\openclaw.cmd")
  )
  if ($env:APPDATA) {
    $candidates += @(
      (Join-Path $env:APPDATA "npm\openclaw.ps1"),
      (Join-Path $env:APPDATA "npm\openclaw.cmd")
    )
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "未找到 openclaw 命令入口。"
}

function Test-GatewayReady {
  param(
    [string]$OpenClawPath
  )

  try {
    & $OpenClawPath gateway status --deep *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

$openclawPath = Get-OpenClawPath
if ($Restart) {
  try {
    & $openclawPath gateway stop *> $null
  } catch {
    # 停止失败通常意味着当前没有正在运行的 Gateway，继续按启动流程处理即可。
  }
  Start-Sleep -Milliseconds 500
} elseif (Test-GatewayReady -OpenClawPath $openclawPath) {
  Write-Host "  ✓ Gateway 已在后台运行"
  exit 0
}

$logsDir = Join-Path $HOME ".openclaw\logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
$stdoutLog = Join-Path $logsDir "gateway.stdout.log"
$stderrLog = Join-Path $logsDir "gateway.stderr.log"
$powershellPath = Get-WindowsPowerShellPath
$escapedOpenClawPath = $openclawPath.Replace("'", "''")
$launchCommand = @"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
& '$escapedOpenClawPath' gateway run
exit `$LASTEXITCODE
"@

Write-Host "  · 正在后台启动 Gateway（Windows 原生模式）..."
$process = Start-Process `
  -FilePath $powershellPath `
  -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $launchCommand `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if (Test-GatewayReady -OpenClawPath $openclawPath) {
    Write-Host "  ✓ Gateway 已在后台启动"
    exit 0
  }

  $process.Refresh()
  if ($process.HasExited) {
    Write-Host "  ✗ Gateway 启动失败，最近日志如下："
    foreach ($logFile in @($stderrLog, $stdoutLog)) {
      if (Test-Path $logFile) {
        Get-Content -Path $logFile -Tail 20 | ForEach-Object {
          Write-Host "  │ $_"
        }
      }
    }
    $exitCode = if ($null -ne $process.ExitCode) { $process.ExitCode } else { 1 }
    exit $exitCode
  }

  Start-Sleep -Milliseconds 500
}

Write-Host "  ✗ Gateway 启动超时，最近日志如下："
foreach ($logFile in @($stderrLog, $stdoutLog)) {
  if (Test-Path $logFile) {
    Get-Content -Path $logFile -Tail 20 | ForEach-Object {
      Write-Host "  │ $_"
    }
  }
}
exit 1
