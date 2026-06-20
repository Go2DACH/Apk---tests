package com.lostphone.radar

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.lostphone.radar.model.Signal
import com.lostphone.radar.scan.BleScanner
import com.lostphone.radar.scan.WifiScanner
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RadarState(
    val scanning: Boolean = false,
    val signals: List<Signal> = emptyList(),
    val targetId: String? = null,
    val target: Signal? = null
)

class RadarViewModel(app: Application) : AndroidViewModel(app) {

    private val ble = BleScanner(app)
    private val wifi = WifiScanner(app)

    /** id -> most recent (smoothed) signal. */
    private val signals = LinkedHashMap<String, Signal>()

    private val _state = MutableStateFlow(RadarState())
    val state: StateFlow<RadarState> = _state.asStateFlow()

    private var scanning = false

    fun startScanning() {
        if (scanning) return
        scanning = true
        ble.start { upsert(it) }
        wifi.start { list -> list.forEach { upsert(it) } }

        viewModelScope.launch {
            while (scanning) {
                wifi.triggerScan()
                prune()
                emit()
                delay(REFRESH_MS)
            }
        }
        _state.value = _state.value.copy(scanning = true)
    }

    fun stopScanning() {
        scanning = false
        ble.stop()
        wifi.stop()
        _state.value = _state.value.copy(scanning = false)
    }

    /** Pick a signal to track on the big proximity gauge (null clears it). */
    fun selectTarget(id: String?) {
        _state.value = _state.value.copy(targetId = id)
        emit()
    }

    private fun upsert(s: Signal) {
        synchronized(signals) {
            val prev = signals[s.id]
            // Exponential smoothing tames the heavy jitter in raw RSSI.
            val rssi = if (prev != null) {
                (prev.rssi * (1 - SMOOTHING) + s.rssi * SMOOTHING).toInt()
            } else {
                s.rssi
            }
            signals[s.id] = s.copy(rssi = rssi)
        }
    }

    private fun prune() {
        val now = System.currentTimeMillis()
        synchronized(signals) {
            signals.entries.removeAll { now - it.value.lastSeen > STALE_MS }
        }
    }

    private fun emit() {
        val list = synchronized(signals) { signals.values.toList() }
            .sortedByDescending { it.rssi }
        val targetId = _state.value.targetId
        _state.value = _state.value.copy(
            signals = list,
            target = list.firstOrNull { it.id == targetId }
        )
    }

    override fun onCleared() {
        stopScanning()
        super.onCleared()
    }

    private companion object {
        const val REFRESH_MS = 1_200L
        const val STALE_MS = 12_000L
        const val SMOOTHING = 0.4f
    }
}
