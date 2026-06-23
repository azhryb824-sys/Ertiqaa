# ربط روابط الدعوة بتطبيق Android و iOS

بعد تنفيذ:

`npm install`
`npm run cap:add:android`
`npm run cap:add:ios`
`npm run cap:sync`

## Android

في `android/app/src/main/AndroidManifest.xml` داخل `MainActivity` أضف intent filter:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="ertiqaa.onrender.com" android:pathPrefix="/invite" />
</intent-filter>
```

ثم ضع بصمة شهادة التطبيق في Render:

`ANDROID_SHA256_CERT_FINGERPRINTS`

## iOS

في Xcode فعّل Associated Domains وأضف:

`applinks:ertiqaa.onrender.com`

ثم ضع في Render:

`IOS_TEAM_ID`
`IOS_BUNDLE_ID=com.ertiqaa.app`

## الإشعارات

لظهور الإشعارات أعلى شاشة الجوال حتى والتطبيق مغلق:

- Android: أضف مشروع Firebase وملف `google-services.json`.
- iOS: فعّل Push Notifications و APNs في Apple Developer و Firebase.
- Render: أضف `FCM_SERVER_KEY` لإرسال الإشعارات من الخادم.
