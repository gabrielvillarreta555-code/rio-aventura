package com.example.rioaventura;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private WebView game;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
        createGame();
    }

    // La página debe seguir cargándose desde file:///android_asset/: cambiar de origen
    // (por ejemplo a https://appassets...) dejaría sin acceso al progreso ya guardado.
    private void createGame() {
        game = new WebView(this);
        game.setBackgroundColor(0xff102e35);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        game.setWebChromeClient(new WebChromeClient());
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith(ASSET_PREFIX);
            }

            // Android puede terminar el proceso de la WebView por falta de memoria. Sin este
            // método la app entera se cierra; así se crea una WebView nueva y el juego ofrece
            // retomar el viaje guardado.
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view != game) return false;
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                createGame();
                return true;
            }
        });
        game.loadUrl(ASSET_PREFIX + "index.html");
        setContentView(game);
    }

    // El juego guarda el viaje en curso antes de que Android pueda cerrar la app.
    @Override protected void onPause() {
        if (game != null) game.evaluateJavascript("window.rioAventuraSave && window.rioAventuraSave()", null);
        super.onPause();
    }

    @Override protected void onStop() {
        if (game != null) game.onPause();
        super.onStop();
    }

    @Override protected void onStart() {
        super.onStart();
        if (game != null) game.onResume();
    }

    @Override protected void onDestroy() {
        if (game != null) { game.destroy(); game = null; }
        super.onDestroy();
    }
}
