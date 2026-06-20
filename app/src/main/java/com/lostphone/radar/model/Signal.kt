package com.lostphone.radar.model

/** The kind of radio a signal was picked up on. */
enum class SignalType { BLE, WIFI }

/**
 * A single detected radio source (a BLE device or a Wi-Fi access point).
 *
 * @param id     stable key — MAC address (BLE) or BSSID (Wi-Fi).
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
}
