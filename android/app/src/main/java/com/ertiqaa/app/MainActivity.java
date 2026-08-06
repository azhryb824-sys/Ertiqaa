package com.ertiqaa.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Ultimate hardware acceleration
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        
        super.onCreate(savedInstanceState);

        // UI Setup on top of Capacitor
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
                                    WebView webView = getBridge().getWebView();
                                    applyUltraStabilitySettings(webView);
                                    webView.loadUrl(url);
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

    private void applyUltraStabilitySettings(WebView webView) {
        WebSettings s = webView.getSettings();
        
        // Base Stability
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        
        // Performance for heavy systems
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            s.setOffscreenPreRaster(true);
        }

        // Session & Security
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Hardware optimization at View level
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        
        // Anti-Crash Monitor: Prevent app closure if heavy system crashes renderer
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // If it crashes due to memory, reload instead of closing
                view.reload();
                return true;
            }
        });
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(false);
        }
    }
}
