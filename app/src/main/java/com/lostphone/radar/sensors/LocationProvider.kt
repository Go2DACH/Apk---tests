package com.lostphone.radar.sensors

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import androidx.core.content.ContextCompat

/**
 * Streams GPS/network location fixes. Used to measure the user's real movement
 * vector while they walk, which makes the direction estimate far more reliable
 * outdoors (e.g. in a garden).
 */
class LocationProvider(private val context: Context) {

    private val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    private var listener: LocationListener? = null

    private fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun start(onLocation: (Location) -> Unit) {
        val lm = lm ?: return
        if (listener != null || !hasPermission()) return
        val l = LocationListener { onLocation(it) }
        listener = l
        runCatching {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 500L, 0f, l)
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1000L, 0f, l)
            }
        }
    }

    fun stop() {
        val l = listener ?: return
        runCatching { lm?.removeUpdates(l) }
        listener = null
    }
}
