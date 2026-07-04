$ErrorActionPreference = "Stop"

$jameelUrl = "http://127.0.0.1:5050"
$out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "free-voice-test.wav"
$body = @{ text = "مرحبا، هذه تجربة مجانية لبصمة صوتي داخل نظام شموس."; style = "sudanese" } | ConvertTo-Json -Compress

Write-Host "اختبار خدمة بصمة الصوت المجانية..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing "$jameelUrl/speech" -Method POST -ContentType "application/json" -Body $body -OutFile $out -TimeoutSec 120
Write-Host "تم إنشاء ملف الاختبار: $out" -ForegroundColor Green
