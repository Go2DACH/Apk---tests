package com.lostphone.radar.scan

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import androidx.core.content.ContextCompat
import com.lostphone.radar.model.Signal
import com.lostphone.radar.model.SignalType

/**
 * Scans for nearby Wi-Fi access points (including a phone's hotspot) and
 * reports their RSSI. Android throttles how often [triggerScan] actually
 * starts a fresh scan, so results update every few seconds at best.
 */
class WifiScanner(private val context: Context) {

    private val wifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    private var receiver: BroadcastReceiver? = null

    val isReady: Boolean get() = wifiManager?.isWifiEnabled == true

    private fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun start(onResults: (List<Signal>) -> Unit) {
        val wm = wifiManager ?: return
        if (receiver != null) return

        val rec = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) = publish(wm, onResults)
        }
        receiver = rec
        ContextCompat.registerReceiver(
            context,
            rec,
            IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        triggerScan()
        publish(wm, onResults) // surface any cached results immediately
    }

    @Suppress("DEPRECATION")
    fun triggerScan() {
        runCatching { wifiManager?.startScan() }
    }

    @SuppressLint("MissingPermission")
    private fun publish(wm: WifiManager, onResults: (List<Signal>) -> Unit) {
        if (!hasPermission()) return
        val results = runCatching { wm.scanResults }.getOrNull() ?: return
        onResults(
            results.map { r ->
                val ssid = r.SSID
                Signal(
                    id = r.BSSID ?: ssid,
                    type = SignalType.WIFI,
                    name = if (ssid.isNullOrBlank()) "(verstecktes WLAN)" else ssid,
                    rssi = r.level
                )
            }
        )
    }

    fun stop() {
        receiver?.let { rec -> runCatching { context.unregisterReceiver(rec) } }
        receiver = null
    }
}
