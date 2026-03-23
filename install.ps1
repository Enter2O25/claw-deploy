$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $rootDir "scripts\bootstrap.ps1") @args
