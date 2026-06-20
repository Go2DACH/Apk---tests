package com.lostphone.radar

import android.location.Location
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Estimates a rough bearing to a selected device by correlating the user's
 * movement with how the device's RSSI changes ("hot/cold" gradient search):
 * if the signal rises while you move in a direction, the device is that way.
 *
 * Movement direction comes from GPS deltas when available (best, outdoors),
 * otherwise from the compass heading. The result is a probabilistic guess that
 * sharpens as the user walks around — never a precise pointer.
 */
class DirectionEstimator {

    private data class Sample(
        val time: Long,
        val heading: Float,
        val rssi: Int,
        val lat: Double?,
        val lon: Double?
    )

    private val samples = ArrayDeque<Sample>()

    fun reset() = samples.clear()

    fun add(heading: Float, rssi: Int, location: Location?) {
        samples.addLast(Sample(System.currentTimeMillis(), heading, rssi, location?.latitude, location?.longitude))
        val cutoff = System.currentTimeMillis() - WINDOW_MS
        while (samples.isNotEmpty() && samples.first().time < cutoff) samples.removeFirst()
        while (samples.size > MAX_SAMPLES) samples.removeFirst()
    }

    /** @return current best estimate, or null if there is not enough movement yet. */
    fun estimate(): DirectionEstimate? {
        if (samples.size < 4) return null
        var sumSin = 0.0
        var sumCos = 0.0
        var totalWeight = 0.0

        val list = samples.toList()
        for (i in 1 until list.size) {
            val a = list[i - 1]
            val b = list[i]
            val dRssi = b.rssi - a.rssi
            if (dRssi == 0) continue

            // Direction the user actually moved (preferred), else where they faced.
            val moveBearing = gpsBearing(a, b)
            val travelDir = moveBearing ?: a.heading

            // RSSI up while moving travelDir => device toward travelDir; down => opposite.
            val dirToDevice = if (dRssi > 0) travelDir else (travelDir + 180f)
            val weight = kotlin.math.abs(dRssi).toDouble()
            val rad = Math.toRadians(dirToDevice.toDouble())
            sumSin += weight * sin(rad)
            sumCos += weight * cos(rad)
            totalWeight += weight
        }

        if (totalWeight < MIN_WEIGHT) return null
        val bearing = ((Math.toDegrees(atan2(sumSin, sumCos)).toFloat()) + 360f) % 360f
        // Resultant length 0..1 measures how consistent the samples are.
        val resultant = sqrt(sumSin * sumSin + sumCos * sumCos) / totalWeight
        val confidence = (resultant * (totalWeight / CONFIDENT_WEIGHT).coerceAtMost(1.0)).toFloat()
        return DirectionEstimate(bearing = bearing, confidence = confidence.coerceIn(0f, 1f))
    }

    /** Bearing in degrees from sample a to b using GPS, or null if too small/missing. */
    private fun gpsBearing(a: Sample, b: Sample): Float? {
        if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null
        val res = FloatArray(2)
        Location.distanceBetween(a.lat, a.lon, b.lat, b.lon, res)
        if (res[0] < MIN_MOVE_M) return null // didn't really move
        return (res[1] + 360f) % 360f // res[1] is initial bearing
    }

    private companion object {
        const val WINDOW_MS = 25_000L
        const val MAX_SAMPLES = 300
        const val MIN_WEIGHT = 6.0
        const val CONFIDENT_WEIGHT = 40.0
        const val MIN_MOVE_M = 0.8f
    }
}

data class DirectionEstimate(
    val bearing: Float,   // 0 = North, 90 = East
    val confidence: Float // 0..1
)
