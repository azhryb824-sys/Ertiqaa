package com.ertiqaa.app;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Safely add the URL bar
        getWindow().getDecorView().post(new Runnable() {
            @Override
            public void run() {
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
                            btnGo.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    String url = urlInput.getText().toString().trim();
                                    if (!url.isEmpty()) {
                                        if (!url.startsWith("http://") && !url.startsWith("https://")) {
                                            url = "https://" + url;
                                        }

                                        if (getBridge() != null && getBridge().getWebView() != null) {
                                            configureWebView(getBridge().getWebView());
                                            getBridge().getWebView().loadUrl(url);
                                            urlBar.setVisibility(View.GONE);
                                        }
                                    }
                                }
                            });
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    private void configureWebView(WebView webView) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // Improve stability for login redirects
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
}
