package com.lostphone.radar

import android.app.Application
import android.location.Location
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.lostphone.radar.model.Signal
import com.lostphone.radar.scan.BleScanner
import com.lostphone.radar.scan.ClassicBtScanner
import com.lostphone.radar.scan.WifiScanner
import com.lostphone.radar.sensors.HeadingProvider
import com.lostphone.radar.sensors.LocationProvider
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RadarState(
    val scanning: Boolean = false,
    val signals: List<Signal> = emptyList(),
    val targetId: String? = null,
    val target: Signal? = null,
    val headingDeg: Float = 0f,
    val hasGps: Boolean = false,
    val direction: DirectionEstimate? = null
)

class RadarViewModel(app: Application) : AndroidViewModel(app) {

    private val ble = BleScanner(app)
    private val classic = ClassicBtScanner(app)
    private val wifi = WifiScanner(app)
    private val heading = HeadingProvider(app)
    private val location = LocationProvider(app)
    private val estimator = DirectionEstimator()

    private val signals = LinkedHashMap<String, Signal>()
    private var currentHeading = 0f
    private var lastLocation: Location? = null

    private val _state = MutableStateFlow(RadarState())
    val state: StateFlow<RadarState> = _state.asStateFlow()

    private var scanning = false

    fun startScanning() {
        if (scanning) return
        scanning = true

        ble.start { upsert(it) }
        classic.start { upsert(it) }
        wifi.start { list -> list.forEach { upsert(it) } }
        heading.start { h ->
            currentHeading = h
            _state.value = _state.value.copy(headingDeg = h)
        }
        location.start { loc ->
            lastLocation = loc
            if (!_state.value.hasGps) _state.value = _state.value.copy(hasGps = true)
        }

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
        classic.stop()
        wifi.stop()
        heading.stop()
        location.stop()
        _state.value = _state.value.copy(scanning = false)
    }

    /** Pick a signal to track; resets the direction estimator to learn it fresh. */
    fun selectTarget(id: String?) {
        estimator.reset()
        _state.value = _state.value.copy(targetId = id, direction = null)
        emit()
    }

    private fun upsert(s: Signal) {
        synchronized(signals) {
            val prev = signals[s.id]
            val rssi = if (prev != null) {
                (prev.rssi * (1 - SMOOTHING) + s.rssi * SMOOTHING).toInt()
            } else {
                s.rssi
            }
            signals[s.id] = s.copy(rssi = rssi)
        }
        // Feed the estimator only with samples for the currently tracked device.
        if (s.id == _state.value.targetId) {
            estimator.add(currentHeading, s.rssi, lastLocation)
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
        val target = list.firstOrNull { it.id == targetId }
        _state.value = _state.value.copy(
            signals = list,
            target = target,
            direction = if (target != null) estimator.estimate() else null
        )
    }

    override fun onCleared() {
        stopScanning()
        super.onCleared()
    }

    private companion object {
        const val REFRESH_MS = 500L
        const val STALE_MS = 12_000L
        const val SMOOTHING = 0.4f
    }
}
