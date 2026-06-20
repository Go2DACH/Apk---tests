package com.lostphone.radar.model

import kotlin.math.pow

/** The kind of radio a signal was picked up on. */
enum class SignalType { BLE, BT_CLASSIC, WIFI }

/**
 * A single detected radio source: a BLE advertiser, a classic Bluetooth device
 * (e.g. a phone or headset found via discovery), or a Wi-Fi access point.
 *
 * @param id     stable key — MAC address (Bluetooth) or BSSID (Wi-Fi).
 * @param rssi   received signal strength in dBm. Closer to 0 = stronger = nearer.
 */
data class Signal(
    val id: String,
    val type: SignalType,
    val name: String,
    val rssi: Int,
    val lastSeen: Long = System.currentTimeMillis()
) {
    /**
     * Rough 0..1 proximity estimate derived from RSSI.
     * ~-30 dBm (very close) -> ~1.0, ~-100 dBm (far/edge of range) -> ~0.0.
     * RSSI is noisy, so treat this as "warmer / colder", not a real distance.
     */
    val strength: Float
        get() = ((rssi + 100).coerceIn(0, 70)) / 70f

    /**
     * Very rough distance estimate (metres) from a log-distance path-loss model.
     * Outdoors (garden) the exponent is lower than indoors. This easily swings
     * by a factor of 2 — use it only to place blips, not as a real measurement.
     */
    val estimatedDistanceM: Float
        get() {
            val txAt1m = if (type == SignalType.WIFI) -45f else -59f
            val n = 2.2f // free-ish space / garden
            return 10f.pow((txAt1m - rssi) / (10f * n)).coerceIn(0.5f, MAX_RANGE_M)
        }

    companion object {
        const val MAX_RANGE_M = 40f
    }
}
