package com.lostphone.radar.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.roundToInt

/**
 * Provides the compass heading (azimuth, 0° = North, 90° = East) for a phone
 * held upright, using the fused rotation-vector sensor (gyroscope +
 * accelerometer + magnetometer). Accuracy depends on magnetometer calibration.
 */
class HeadingProvider(context: Context) : SensorEventListener {

    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotationSensor: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private val rotationMatrix = FloatArray(9)
    private val remapped = FloatArray(9)
    private val orientation = FloatArray(3)

    private var listener: ((Float) -> Unit)? = null

    val isAvailable: Boolean get() = rotationSensor != null

    fun start(onHeading: (Float) -> Unit) {
        listener = onHeading
        rotationSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        listener = null
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
        // Remap so the heading reflects where the back of an upright phone points.
        SensorManager.remapCoordinateSystem(
            rotationMatrix,
            SensorManager.AXIS_X,
            SensorManager.AXIS_Z,
            remapped
        )
        SensorManager.getOrientation(remapped, orientation)
        var azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
        if (azimuth < 0f) azimuth += 360f
        listener?.invoke(azimuth)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}

/** Smallest signed difference a-b mapped to (-180, 180]. */
fun angleDelta(a: Float, b: Float): Float {
    var d = (a - b) % 360f
    if (d < -180f) d += 360f
    if (d > 180f) d -= 360f
    return d
}

/** Compass label like "NO" for a bearing in degrees. */
fun compassLabel(bearing: Float): String {
    val dirs = listOf("N", "NO", "O", "SO", "S", "SW", "W", "NW")
    val idx = ((bearing % 360f + 360f) % 360f / 45f).roundToInt() % 8
    return dirs[idx]
}
