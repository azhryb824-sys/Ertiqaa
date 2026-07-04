$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$jameelRoot = "D:\البرمجيات - نسخ احتياطية\jameel-ai"
$jameelPython = Join-Path $jameelRoot "venv\Scripts\python.exe"

if (-not (Test-Path $jameelPython)) {
  throw "لم يتم العثور على Python الخاص ببصمة الصوت: $jameelPython"
}

Write-Host "تشغيل خدمة بصمة الصوت jameel-ai على http://127.0.0.1:5050 ..." -ForegroundColor Cyan
Start-Process -FilePath $jameelPython -ArgumentList "app.py" -WorkingDirectory $jameelRoot -WindowStyle Hidden

Write-Host "تشغيل نظام شموس على http://127.0.0.1:4173 ..." -ForegroundColor Cyan
$env:JAMEEL_VOICE_ROOT = $jameelRoot
$env:JAMEEL_VOICE_ENDPOINT = "http://127.0.0.1:5050"
$env:JAMEEL_VOICE_TIMEOUT_MS = "90000"
$env:ALLOW_PAID_VOICE = "0"
Start-Process -FilePath "node" -ArgumentList "server.cjs" -WorkingDirectory $root -WindowStyle Hidden

Write-Host "تم التشغيل. افتح http://127.0.0.1:4173 بعد ثوان قليلة." -ForegroundColor Green
