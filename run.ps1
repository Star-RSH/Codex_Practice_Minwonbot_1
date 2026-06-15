$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$serverPath = Join-Path $projectRoot "server.mjs"
$port = if ($env:PORT) { $env:PORT } else { "4173" }

if (-not (Test-Path $nodePath)) {
  Write-Error "번들 Node를 찾을 수 없습니다: $nodePath"
}

if (-not (Test-Path $serverPath)) {
  Write-Error "server.mjs를 찾을 수 없습니다: $serverPath"
}

Write-Host "민원 지식봇 서버를 시작합니다."
Write-Host "주소: http://127.0.0.1:$port"
Write-Host "중지하려면 Ctrl+C를 누르세요."

Push-Location $projectRoot
try {
  & $nodePath $serverPath
} finally {
  Pop-Location
}
