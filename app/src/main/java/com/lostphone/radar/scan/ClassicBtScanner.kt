package com.lostphone.radar.scan

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.lostphone.radar.model.Signal
import com.lostphone.radar.model.SignalType

/**
 * Classic Bluetooth (BR/EDR) discovery. Unlike BLE scanning this can surface
 * phones and headsets that are *discoverable*, and reports an RSSI per find.
 * Discovery runs in ~12 s cycles; we restart it when each cycle finishes.
 */
class ClassicBtScanner(private val context: Context) {

    private val adapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private var receiver: BroadcastReceiver? = null
    private var onSignal: ((Signal) -> Unit)? = null

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
        val adapter = adapter ?: return
        if (receiver != null || !hasScanPermission()) return
        this.onSignal = onSignal

        val rec = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                when (intent?.action) {
                    BluetoothDevice.ACTION_FOUND -> handleFound(intent)
                    BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> restart()
                }
            }
        }
        receiver = rec
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        ContextCompat.registerReceiver(context, rec, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        restart()
    }

    @SuppressLint("MissingPermission")
    private fun handleFound(intent: Intent) {
        val device: BluetoothDevice? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            }
        device ?: return
        val rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE).toInt()
        if (rssi == Short.MIN_VALUE.toInt()) return // no signal strength reported
        val name = runCatching { device.name }.getOrNull()
        onSignal?.invoke(
            Signal(
                id = device.address,
                type = SignalType.BT_CLASSIC,
                name = name ?: "(klassisches BT-Gerät)",
                rssi = rssi
            )
        )
    }

    @SuppressLint("MissingPermission")
    private fun restart() {
        val adapter = adapter ?: return
        if (!hasScanPermission()) return
        runCatching {
            if (adapter.isDiscovering) adapter.cancelDiscovery()
            adapter.startDiscovery()
        }
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        runCatching { adapter?.cancelDiscovery() }
        receiver?.let { rec -> runCatching { context.unregisterReceiver(rec) } }
        receiver = null
        onSignal = null
    }
}
