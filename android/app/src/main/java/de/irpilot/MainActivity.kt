package de.irpilot

import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

/**
 * IR-Pilot Android-Huelle: laedt die PWA (gebuendelt unter assets/www) im WebView
 * und stellt die native Bruecke `AndroidIR` bereit. Offline-first; "Daten
 * aktualisieren" laedt die Online-Version (Pages) nach.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    // Datei-/Kamera-Auswahl fuer <input type=file> (Foto-Beweise)
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private val fileChooser = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res: ActivityResult ->
        val cb = fileCb; fileCb = null
        if (cb == null) return@registerForActivityResult
        var results: Array<Uri>? = null
        if (res.resultCode == RESULT_OK) {
            val data = res.data
            if (data?.dataString != null || data?.clipData != null) {
                results = WebChromeClient.FileChooserParams.parseResult(res.resultCode, data)
            } else if (cameraUri != null) {
                results = arrayOf(cameraUri!!)   // Kamera-Aufnahme
            }
        }
        cb.onReceiveValue(results ?: arrayOf())
        cameraUri = null
    }

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
            // Forensik-Hosts (Boot-Sticks) laufen lokal per HTTP im isolierten
            // Analyse-Netz. Die token-geschuetzte App muss diese Cleartext-Hosts
            // erreichen, auch wenn sie selbst von file:///https geladen ist.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        web.webViewClient = object : WebViewClient() {
            // Forensik-Datenquellen (z.B. IDS-Appliance) liefern im LAN oft per
            // HTTPS mit selbst-signiertem Zertifikat. Im isolierten Analyse-Netz
            // akzeptieren wir SSL-Fehler NUR fuer private IP-Bereiche; oeffentliche
            // Hosts bleiben strikt validiert.
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                val host = try { android.net.Uri.parse(error?.url ?: "").host ?: "" } catch (e: Exception) { "" }
                if (isPrivateHost(host)) handler?.proceed() else handler?.cancel()
            }
        }
        // JS-Dialoge (confirm beim Loeschen, prompt fuer Chain-of-Custody/Import)
        // zuverlaessig als native Dialoge anzeigen – die Basis-Implementierung tut
        // das nicht garantiert.
        web.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(v: WebView?, url: String?, msg: String?, r: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity).setMessage(msg).setCancelable(false)
                    .setPositiveButton("OK") { _, _ -> r.confirm() }.show()
                return true
            }
            override fun onJsConfirm(v: WebView?, url: String?, msg: String?, r: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity).setMessage(msg)
                    .setPositiveButton("OK") { _, _ -> r.confirm() }
                    .setNegativeButton("Abbrechen") { _, _ -> r.cancel() }
                    .setOnCancelListener { r.cancel() }.show()
                return true
            }
            override fun onJsPrompt(v: WebView?, url: String?, msg: String?, def: String?, r: JsPromptResult): Boolean {
                val input = EditText(this@MainActivity); input.setText(def ?: "")
                AlertDialog.Builder(this@MainActivity).setMessage(msg).setView(input)
                    .setPositiveButton("OK") { _, _ -> r.confirm(input.text.toString()) }
                    .setNegativeButton("Abbrechen") { _, _ -> r.cancel() }
                    .setOnCancelListener { r.cancel() }.show()
                return true
            }
            // <input type=file> (Foto aufnehmen / aus Galerie/Datei) – ohne dies tut
            // der Button in der WebView nichts. Bietet Kamera + Dateiauswahl an.
            override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = callback; cameraUri = null
                val content = try { params.createIntent() } catch (e: Exception) { Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*") }
                val accept = params.acceptTypes?.joinToString(",") ?: ""
                var camera: Intent? = null
                if (accept.isEmpty() || accept.contains("image") || accept.contains("*/*")) {
                    try {
                        val photo = File.createTempFile("ir_photo_", ".jpg", cacheDir)
                        cameraUri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", photo)
                        camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                            .putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    } catch (e: Exception) { cameraUri = null; camera = null }
                }
                val chooser = Intent(Intent.ACTION_CHOOSER)
                    .putExtra(Intent.EXTRA_INTENT, content)
                    .putExtra(Intent.EXTRA_TITLE, "Foto aufnehmen oder Datei wählen")
                if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))
                return try { fileChooser.launch(chooser); true } catch (e: Exception) {
                    fileCb = null
                    android.widget.Toast.makeText(this@MainActivity, "Auswahl nicht möglich: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }
        web.addJavascriptInterface(IRBridge(this) { web }, "AndroidIR")

        // Offline-first: gebuendelte App. Online-Update via Bridge.reloadData().
        web.loadUrl(BUNDLED_URL)
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    /** Private/lokale Hosts (RFC1918 + link-local + loopback) – nur diese duerfen self-signed. */
    private fun isPrivateHost(host: String): Boolean {
        if (host.isEmpty()) return false
        if (host == "localhost" || host.endsWith(".local")) return true
        val p = host.split(".")
        if (p.size != 4) return false
        val o = p.map { it.toIntOrNull() ?: return false }
        if (o.any { it < 0 || it > 255 }) return false
        return when {
            o[0] == 10 -> true
            o[0] == 127 -> true
            o[0] == 192 && o[1] == 168 -> true
            o[0] == 172 && o[1] in 16..31 -> true
            o[0] == 169 && o[1] == 254 -> true
            else -> false
        }
    }

    companion object {
        const val BUNDLED_URL = "file:///android_asset/www/index.html"
        // Pages-URL (anpassen): so laedt die APK die neuesten Daten/Playbooks.
        const val REMOTE_URL = "https://go2dach.github.io/Apk---tests/"
    }
}
