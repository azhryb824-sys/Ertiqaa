# تطبيق ارتقاء للجوال

هذا المجلد يجهز تطبيق Android و iOS باستخدام Capacitor.

## إنشاء التطبيقات

1. ثبت الحزم:
   `npm install`
2. أضف Android:
   `npm run cap:add:android`
3. أضف iOS على جهاز macOS:
   `npm run cap:add:ios`
4. مزامنة الإعدادات:
   `npm run cap:sync`

## فتح روابط الدعوة داخل التطبيق

على Render اضبط:

- `ANDROID_PACKAGE_NAME=com.ertiqaa.app`
- `ANDROID_SHA256_CERT_FINGERPRINTS=SHA256_FINGERPRINT`
- `IOS_TEAM_ID=TEAMID`
- `IOS_BUNDLE_ID=com.ertiqaa.app`

الخادم يوفّر:

- `/.well-known/assetlinks.json`
- `/.well-known/apple-app-site-association`

بعد ضبط شهادات Android و Apple Universal Links، سيظهر للمستخدم خيار فتح رابط الدعوة داخل التطبيق.

## الإشعارات

التطبيق يسجل Push Token محليًا. لتفعيل إرسال الإشعارات حتى والتطبيق مغلق يجب ربط Firebase Cloud Messaging على Android و APNs على iOS ثم إرسال الإشعارات من خادم موثوق باستخدام التوكنات المخزنة في `/api/push/register`.
