package com.skypher.tinroof;

import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;

public final class MainActivity extends Activity {
    private static final String TAG = "Tinroof";
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/assets/index.html";
    private WebView webView;
    private boolean rendererRecoveryAttempted;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(16, 30, 29));
        window.setNavigationBarColor(Color.rgb(16, 30, 29));

        initializeWebView();

        if (savedInstanceState == null) {
            loadBundledPage();
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void initializeWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 30, 29));
        if (isSoftwareEmulator()) {
            // The API 35 software image has no hardware compositor. Keeping
            // this view on a software layer avoids asking that image to
            // promote the WebView into a failing GPU-backed surface.
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            Log.i(TAG, "using software WebView layer for emulator");
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Prevent the system from reclaiming the renderer while the
            // player is visible or audio is active.
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }

        webView.addJavascriptInterface(new AudioAssetBridge(getApplicationContext()), "TinroofAudioAssets");
        webView.setWebViewClient(new OfflineAssetWebViewClient(getAssets()));
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
    }

    private void loadBundledPage() {
        String indexHtml = readAsset("index.html");
        if (indexHtml == null) {
            webView.loadUrl(START_URL);
        } else {
            if (isSoftwareEmulator()) {
                indexHtml = indexHtml.replace("<html", "<html class=\"software-renderer\"");
            }
            webView.loadDataWithBaseURL(START_URL, indexHtml, "text/html", "UTF-8", null);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        // Keep WebView media alive when the activity is backgrounded. The page
        // owns playback and exposes the system media-session metadata.
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private String readAsset(String path) {
        try (InputStream stream = getAssets().open(path, AssetManager.ACCESS_STREAMING)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            return output.toString("UTF-8");
        } catch (IOException error) {
            Log.e(TAG, "unable to read bundled asset: " + path, error);
            return null;
        }
    }

    private static boolean isSoftwareEmulator() {
        String fingerprint = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        String model = Build.MODEL == null ? "" : Build.MODEL;
        String hardware = Build.HARDWARE == null ? "" : Build.HARDWARE;
        return fingerprint.startsWith("generic") || fingerprint.startsWith("unknown")
                || model.contains("Emulator") || model.contains("Android SDK built for")
                || hardware.contains("ranchu") || hardware.contains("goldfish");
    }

    private static final class AudioAssetBridge {
        private final Context context;

        AudioAssetBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String uriFor(String assetPath) {
            Uri uri = AudioAssetProvider.uriFor(context, assetPath);
            return uri == null ? "" : uri.toString();
        }
    }

    private void showRendererFailure() {
        TextView message = new TextView(this);
        message.setText("The offline player stopped unexpectedly. Reopen Tinroof to reload it.");
        message.setTextColor(Color.WHITE);
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        message.setPadding(32, 32, 32, 32);
        message.setBackgroundColor(Color.rgb(16, 30, 29));
        setContentView(message);
    }

    private final class OfflineAssetWebViewClient extends WebViewClient {
        private final AssetManager assets;

        OfflineAssetWebViewClient(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return openAsset(request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!ASSET_HOST.equals(uri.getHost())) {
                Log.i(TAG, "blocked non-bundled navigation: " + uri);
                return true;
            }
            return false;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            Log.i(TAG, "offline page started: " + url);
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.i(TAG, "offline page finished: " + url);
            super.onPageFinished(view, url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                android.webkit.WebResourceError error) {
            Log.e(TAG, "offline asset error: " + request.getUrl() + " / " + error.getDescription());
            super.onReceivedError(view, request, error);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            Log.e(TAG, "WebView renderer gone; crashed=" + detail.didCrash());
            if (view == webView) {
                webView = null;
                view.setWebChromeClient(null);
                view.setWebViewClient(null);
                view.destroy();
                if (!rendererRecoveryAttempted && !isFinishing()) {
                    rendererRecoveryAttempted = true;
                    initializeWebView();
                    loadBundledPage();
                } else {
                    showRendererFailure();
                }
            }
            return true;
        }

        private WebResourceResponse openAsset(WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!ASSET_HOST.equals(uri.getHost())) {
                return null;
            }

            String path = uri.getPath();
            if (path == null || !path.startsWith("/assets/")) {
                return null;
            }

            String assetPath = path.substring("/assets/".length());
            if (assetPath.isEmpty() || assetPath.endsWith("/")) {
                assetPath += "index.html";
            }

            try {
                InputStream stream = assets.open(assetPath, AssetManager.ACCESS_STREAMING);
                String mimeType = URLConnection.guessContentTypeFromName(assetPath);
                if (mimeType == null) {
                    mimeType = mimeTypeFor(assetPath);
                }
                if (assetPath.equals("index.html") || assetPath.equals("app.js")
                        || assetPath.equals("style.css")) {
                    Log.i(TAG, "serving bundled asset: " + assetPath);
                }
                String encoding = isText(assetPath) ? "UTF-8" : null;
                return new WebResourceResponse(mimeType, encoding, stream);
            } catch (IOException ignored) {
                return null;
            }
        }

        private static boolean isText(String path) {
            return path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js")
                    || path.endsWith(".json") || path.endsWith(".txt");
        }

        private static String mimeTypeFor(String path) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".js")) return "text/javascript";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".mp3")) return "audio/mpeg";
            if (path.endsWith(".wav")) return "audio/wav";
            return "text/plain";
        }
    }
}
