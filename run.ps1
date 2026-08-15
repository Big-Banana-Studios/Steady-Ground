# Starts Steady Ground locally and opens it in your browser.
#
# Just right-click this file and choose "Run with PowerShell", or from a
# terminal in this folder:  .\run.ps1
#
# The app needs Chrome or Edge — it uses WebGPU to run the helper on your own
# machine, and Firefox and Safari are not there yet on Windows.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host '  Node.js is not installed, and this little server needs it.' -ForegroundColor Yellow
    Write-Host '  Get it from https://nodejs.org (the LTS button), then run this again.'
    Write-Host ''
    Read-Host '  Press Enter to close'
    exit 1
}

Write-Host ''
Write-Host '  Starting Steady Ground...' -ForegroundColor Cyan
Write-Host ''

# Give the server a moment to bind before the browser goes looking for it.
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:$using:port/"
} | Out-Null

node (Join-Path $here 'tools\serve.mjs') $port
