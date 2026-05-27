param(
    [string]$HwpBridgeUrl = "http://host.docker.internal:8877",
    [int]$HwpBridgePort = 8877
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgeDir = Join-Path $repoRoot "HwpBridge"
$venvPython = Join-Path $bridgeDir ".venv\Scripts\python.exe"

if (!(Test-Path $venvPython)) {
    Push-Location $bridgeDir
    try {
        python -m venv .venv
        & $venvPython -m pip install -r requirements.txt
    } finally {
        Pop-Location
    }
}

$existingBridge = Get-NetTCPConnection -LocalPort $HwpBridgePort -State Listen -ErrorAction SilentlyContinue
if (!$existingBridge) {
    Start-Process `
        -FilePath $venvPython `
        -ArgumentList @("-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$HwpBridgePort") `
        -WorkingDirectory $bridgeDir `
        -WindowStyle Hidden
}

$env:HWP_EDIT_BASE_URL = $HwpBridgeUrl
docker compose up -d --build
