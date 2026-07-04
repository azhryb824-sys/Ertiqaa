# تطبيق شموس iOS

## بناء التطبيق (على macOS فقط)

### المتطلبات
- macOS 13+ مع Xcode 15+
- CocoaPods (brew install cocoapods)
- Node.js 18+

### الخطوات

```bash
# 1. تثبيت الاعتماديات
cd "نظام إدارة شركات ومؤسسات صيانة وتركيب المصاعد الالكترونية"
npm install

# 2. مزامنة ملفات Capacitor (ينسخ ملفات mobile/ إلى ios/)
npx cap sync ios

# 3. فتح المشروع في Xcode
npx cap open ios

# 4. في Xcode:
#    - اختر Team للتوقيع (Apple Developer account)
#    - غير Bundle Identifier إذا لزم الأمر
#    - اختر iOS 15.0 كحد أدنى
#    - Build (Cmd+B) ثم Run (Cmd+R)
```

### ملاحظات مهمة
- التطبيق يستخدم **Live Reload** من الخادم البعيد (https://ertiqaa.onrender.com)
- لا يحتاج بناء Web Assets محلياً - كل التحديثات من الخادم
- للإصدار النهائي: غيّر `server.url` في `capacitor.config.json` إلى `""` وانسخ ملفات الويب محلياً
