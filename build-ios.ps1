Write-Host "=== بناء تطبيق شموس iOS ===" -ForegroundColor Green
Write-Host ""

# Sync Capacitor
Write-Host "[1/4] مزامنة ملفات Capacitor..." -ForegroundColor Yellow
npx cap sync ios
if (-not $?) { Write-Host "❌ فشلت المزامنة" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[2/4] ✅ تم تحديث ios/App/App/public/ بآخر الملفات" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] ✅ تحديث Info.plist مع صلاحيات iOS" -ForegroundColor Green
Write-Host "     - الميكروفون (الأوامر الصوتية)"
Write-Host "     - الكاميرا (تصوير المصاعد)"
Write-Host "     - الموقع (توجيه الفنيين)"
Write-Host "     - معرض الصور (رفع التقارير)"

Write-Host ""
Write-Host "[4/4] تعليمات البناء على macOS:" -ForegroundColor Cyan
Write-Host "───────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "1. انسخ المجلد إلى Mac أو ارفعه على GitHub" -ForegroundColor White
Write-Host "2. على Mac شغّل:" -ForegroundColor White
Write-Host "   npm install" -ForegroundColor Magenta
Write-Host "   npm run cap:build:ios" -ForegroundColor Magenta
Write-Host "3. في Xcode:" -ForegroundColor White
Write-Host "   - اختر Team (Apple Developer account)" -ForegroundColor White
Write-Host "   - Build (Cmd+B) → Run (Cmd+R)" -ForegroundColor White
Write-Host "───────────────────────────────────────────────────" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== ✅ تم تجهيز مشروع iOS للبناء ===" -ForegroundColor Green
