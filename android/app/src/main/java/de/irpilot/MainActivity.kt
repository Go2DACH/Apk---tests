package de.irpilot

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * IR-Pilot Android-Huelle: laedt die PWA (gebuendelt unter assets/www) im WebView
 * und stellt die native Bruecke `AndroidIR` bereit. Offline-first; "Daten
 * aktualisieren" laedt die Online-Version (Pages) nach.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
        }
        web.webViewClient = WebViewClient()
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(IRBridge(this) { web }, "AndroidIR")

        // Offline-first: gebuendelte App. Online-Update via Bridge.reloadData().
        web.loadUrl(BUNDLED_URL)
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    companion object {
        const val BUNDLED_URL = "file:///android_asset/www/index.html"
        // Pages-URL (anpassen): so laedt die APK die neuesten Daten/Playbooks.
        const val REMOTE_URL = "https://go2dach.github.io/Apk---tests/"
    }
}
