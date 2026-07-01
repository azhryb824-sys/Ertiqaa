package com.ertiqaa.app;

import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 1. الأداء العتادي: تفعيل التسريع قبل بناء أي واجهة
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        super.onCreate(savedInstanceState);

        // 2. إدارة الواجهة بشكل مدمج وليس كطبقة فوقية (لتخفيف العبء)
        setupRootInterface();
    }

    private void setupRootInterface() {
        getWindow().getDecorView().post(() -> {
            try {
                final View urlBar = getLayoutInflater().inflate(R.layout.url_bar, null);
                if (urlBar != null) {
                    addContentView(urlBar, new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                    ));

                    final EditText urlInput = urlBar.findViewById(R.id.url_input);
                    Button btnGo = urlBar.findViewById(R.id.btn_go);

                    if (btnGo != null && urlInput != null) {
                        btnGo.setOnClickListener(v -> {
                            String url = urlInput.getText().toString().trim();
                            if (!url.isEmpty()) {
                                if (!url.startsWith("http")) url = "https://" + url;
                                
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    applyDeepOptimizations(getBridge().getWebView());
                                    getBridge().getWebView().loadUrl(url);
                                    urlBar.setVisibility(View.GONE);
                                }
                            }
                        });
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void applyDeepOptimizations(WebView webView) {
        WebSettings s = webView.getSettings();
        
        // إعدادات الأنظمة الضخمة (Enterprise Settings)
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        
        // تحسين الريندر للأنظمة الثقيلة
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // تفعيل أهم ميزة للأنظمة الثقيلة: الريندر المسبق خلف الكواليس
        s.setOffscreenPreRaster(true); 

        // إدارة الجلسة (Session) بشكل جذري
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // منع الانهيار بسبب استهلاك الـ RAM
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        
        // تنظيف الذاكرة القديمة قبل التحميل الجديد
        webView.clearCache(false);
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        // إجراء وقائي: تنظيف الذاكرة فور شعور النظام بالثقل بدلاً من الانهيار
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().freeMemory();
        }
    }
}
