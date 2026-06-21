package de.irpilot

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Native Bruecke fuer die WebApp (window.AndroidIR). Bewusst defensiv:
 * - platform/toast/share/saveFile/reloadData: nativ implementiert
 * - startCapture/flashImage: delegieren an bewaehrte Companion-Apps
 *   (PCAPdroid fuer pcap, EtchDroid fuer USB-Flash) – sonst Installationshinweis.
 *
 * Roadmap (eigene native Module): VpnService-Capture, USB-Host-Flash, gebuendeltes nmap.
 */
class IRBridge(private val act: AppCompatActivity, private val web: () -> WebView) {

    @JavascriptInterface
    fun platform(): String = "android-" + Build.VERSION.SDK_INT

    @JavascriptInterface
    fun toast(msg: String) = act.runOnUiThread {
        Toast.makeText(act, msg, Toast.LENGTH_SHORT).show()
    }

    /** Datei in Downloads ablegen (sichtbar fuer Datei-Apps / USB-Kopie). */
    @JavascriptInterface
    fun saveFile(name: String, text: String) = act.runOnUiThread {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                val cv = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, "text/plain")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = act.contentResolver.insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv
                )
                uri?.let {
                    act.contentResolver.openOutputStream(it)?.use { os ->
                        os.write(text.toByteArray())
                    }
                    cv.clear(); cv.put(MediaStore.Downloads.IS_PENDING, 0)
                    act.contentResolver.update(it, cv, null, null)
                }
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                )
                java.io.File(dir, name).writeText(text)
            }
            toast("Gespeichert: $name")
        } catch (e: Exception) {
            toast("Speichern fehlgeschlagen: ${e.message}")
        }
    }

    @JavascriptInterface
    fun share(name: String, text: String) = act.runOnUiThread {
        val i = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, name)
            putExtra(Intent.EXTRA_TEXT, text)
        }
        act.startActivity(Intent.createChooser(i, name))
    }

    @JavascriptInterface
    fun reloadData() = act.runOnUiThread { web().loadUrl(MainActivity.REMOTE_URL) }

    /** Aktuelle WebView als PDF drucken (Android-Druckdialog -> "Als PDF speichern"). */
    @JavascriptInterface
    fun printPage() = act.runOnUiThread {
        try {
            val pm = act.getSystemService(android.content.Context.PRINT_SERVICE) as android.print.PrintManager
            val adapter = web().createPrintDocumentAdapter("IR-Pilot-Report")
            pm.print("IR-Pilot-Report", adapter, android.print.PrintAttributes.Builder().build())
        } catch (e: Exception) {
            toast("Drucken fehlgeschlagen: ${e.message}")
        }
    }

    /**
     * Eingebettetes Asset (z.B. das Werkzeug-Kit ir-pilot-kit.zip) nach Downloads
     * kopieren – damit der Boot-Stick/Windows-Teil direkt vom Handy auf USB landet.
     * Gibt true zurueck (JS-seitig als Erfolg gewertet); Ergebnis via Toast.
     */
    @JavascriptInterface
    fun exportAsset(name: String): Boolean {
        act.runOnUiThread {
            try {
                val mime = if (name.endsWith(".zip")) "application/zip" else "application/octet-stream"
                val data = act.assets.open("www/$name").use { it.readBytes() }
                val outName = name.substringAfterLast('/')
                if (Build.VERSION.SDK_INT >= 29) {
                    val cv = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, outName)
                        put(MediaStore.Downloads.MIME_TYPE, mime)
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = act.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv)
                    uri?.let {
                        act.contentResolver.openOutputStream(it)?.use { os -> os.write(data) }
                        cv.clear(); cv.put(MediaStore.Downloads.IS_PENDING, 0)
                        act.contentResolver.update(it, cv, null, null)
                    }
                } else {
                    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    java.io.File(dir, outName).writeBytes(data)
                }
                toast("Kit gespeichert: $outName (Downloads)")
            } catch (e: Exception) {
                toast("Kit-Export fehlgeschlagen: ${e.message}")
            }
        }
        return true
    }

    /** Netz-Mitschnitt: PCAPdroid oeffnen (pcap ohne Root via VpnService). */
    @JavascriptInterface
    fun startCapture() = openOrHint("com.emanuelef.remote_capture",
        "PCAPdroid (pcap-Mitschnitt) installieren")

    /** Boot-Stick flashen: EtchDroid oeffnen (USB-Host, ohne Root). */
    @JavascriptInterface
    fun flashImage() = openOrHint("eu.depau.etchdroid",
        "EtchDroid (USB-Flash) installieren")

    private fun openOrHint(pkg: String, hint: String) = act.runOnUiThread {
        val launch = act.packageManager.getLaunchIntentForPackage(pkg)
        if (launch != null) {
            act.startActivity(launch)
        } else {
            toast(hint)
            try {
                act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")))
            } catch (_: Exception) {
            }
        }
    }
}
