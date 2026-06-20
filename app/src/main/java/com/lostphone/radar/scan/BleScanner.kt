package com.lostphone.radar.scan

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.lostphone.radar.model.Signal
import com.lostphone.radar.model.SignalType

/**
 * Continuously scans for nearby Bluetooth Low Energy advertisers and reports
 * their signal strength. Only devices that are powered on and broadcasting
 * are visible — and many phones randomise their BLE address.
 */
class BleScanner(private val context: Context) {

    private val adapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private var callback: ScanCallback? = null

    /** True if the device has a usable, enabled Bluetooth adapter. */
    val isReady: Boolean
        @SuppressLint("MissingPermission")
        get() = adapter?.let { runCatching { it.isEnabled }.getOrDefault(false) } ?: false

    private fun hasScanPermission(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        }

    @SuppressLint("MissingPermission")
    fun start(onSignal: (Signal) -> Unit) {
        if (callback != null) return
        val scanner = adapter?.bluetoothLeScanner ?: return
        if (!hasScanPermission() || !isReady) return

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device
                val name = runCatching {
                    result.scanRecord?.deviceName ?: device.name
                }.getOrNull()
                onSignal(
                    Signal(
                        id = device.address,
                        type = SignalType.BLE,
                        name = name ?: "(unbekanntes BLE-Gerät)",
                        rssi = result.rssi
                    )
                )
            }
        }
        callback = cb
        runCatching { scanner.startScan(null, settings, cb) }
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        val cb = callback ?: return
        runCatching { adapter?.bluetoothLeScanner?.stopScan(cb) }
        callback = null
    }
}
