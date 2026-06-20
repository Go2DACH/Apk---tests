package com.lostphone.radar

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.SettingsRemote
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.lostphone.radar.model.Signal
import com.lostphone.radar.model.SignalType
import com.lostphone.radar.sensors.angleDelta
import com.lostphone.radar.sensors.compassLabel
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = RadarColors) { RadarScreen() }
        }
    }
}

private val RadarColors = darkColorScheme(
    primary = Color(0xFF00E5A0),
    background = Color(0xFF04070A),
    surface = Color(0xFF0D141B),
    onBackground = Color(0xFFE6F0EA),
    onSurface = Color(0xFFE6F0EA),
)

private fun requiredPermissions(): Array<String> = buildList {
    add(Manifest.permission.ACCESS_FINE_LOCATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        add(Manifest.permission.BLUETOOTH_SCAN)
        add(Manifest.permission.BLUETOOTH_CONNECT)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        add(Manifest.permission.NEARBY_WIFI_DEVICES)
    }
}.toTypedArray()

@Composable
private fun RadarScreen(vm: RadarViewModel = viewModel()) {
    val context = LocalContext.current
    val state by vm.state.collectAsStateWithLifecycle()

    var hasPermissions by remember {
        mutableStateOf(
            requiredPermissions().all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
        )
    }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        hasPermissions = result.values.all { it }
        if (hasPermissions) vm.startScanning()
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Header(
                    scanning = state.scanning,
                    onToggle = {
                        if (state.scanning) vm.stopScanning()
                        else if (hasPermissions) vm.startScanning()
                        else launcher.launch(requiredPermissions())
                    }
                )
            }
            item { RadarView(state) }
            item {
                if (state.target != null) DirectionPanel(state) else DisclaimerCard()
            }
            if (state.signals.isEmpty()) {
                item { EmptyHint(state.scanning) }
            } else {
                item {
                    Text(
                        "Signale (${state.signals.size}) — tippe dein Gerät/Headset an",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
                items(state.signals, key = { it.id }) { signal ->
                    SignalRow(
                        signal = signal,
                        selected = signal.id == state.targetId,
                        onClick = {
                            vm.selectTarget(if (signal.id == state.targetId) null else signal.id)
                        }
                    )
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun Header(scanning: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                "Geräte-Radar",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                "BLE · klassisches BT · WLAN",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )
        }
        Button(onClick = onToggle) { Text(if (scanning) "Stopp" else "Scan starten") }
    }
}

@Composable
private fun RadarView(state: RadarState) {
    val transition = rememberInfiniteTransition(label = "sweep")
    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(2500, easing = LinearEasing), RepeatMode.Restart),
        label = "sweepAngle"
    )

    val grid = Color(0xFF13313A)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f),
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val maxR = minOf(cx, cy) * 0.94f
            val center = Offset(cx, cy)

            // Range rings (~10 / 20 / 30 / 40 m).
            for (i in 1..4) {
                drawCircle(grid, maxR * i / 4f, center, style = Stroke(width = 2f))
            }
            // Cross hairs.
            drawLine(grid, Offset(cx - maxR, cy), Offset(cx + maxR, cy), 2f)
            drawLine(grid, Offset(cx, cy - maxR), Offset(cx, cy + maxR), 2f)

            // Sweep line + fading trail.
            rotate(sweep, center) {
                drawLine(
                    Color(0xFF00E5A0).copy(alpha = 0.9f),
                    center, Offset(cx, cy - maxR), strokeWidth = 3f
                )
            }
            for (t in 1..6) {
                rotate(sweep - t * 6f, center) {
                    drawLine(
                        Color(0xFF00E5A0).copy(alpha = 0.10f - t * 0.015f),
                        center, Offset(cx, cy - maxR), strokeWidth = 3f
                    )
                }
            }

            // Blips.
            val target = state.target
            for (s in state.signals) {
                val frac = (s.estimatedDistanceM / Signal.MAX_RANGE_M).coerceIn(0.06f, 1f)
                val isTarget = s.id == state.targetId
                val screenAngle = when {
                    isTarget && state.direction != null ->
                        angleDelta(state.direction.bearing, state.headingDeg)
                    else -> stableAngle(s.id)
                }
                val rad = Math.toRadians(screenAngle.toDouble())
                val px = cx + maxR * frac * sin(rad).toFloat()
                val py = cy - maxR * frac * cos(rad).toFloat()
                val col = strengthColor(s.strength)
                if (isTarget) {
                    drawCircle(col.copy(alpha = 0.25f), 22f, Offset(px, py))
                    drawCircle(col, 9f, Offset(px, py))
                    drawCircle(Color.White, 3f, Offset(px, py))
                } else {
                    drawCircle(col.copy(alpha = if (target == null) 0.9f else 0.35f), 6f, Offset(px, py))
                }
            }

            // "N" marker rotates opposite to current heading (up = where phone points).
            val nAngle = Math.toRadians(angleDelta(0f, state.headingDeg).toDouble())
            drawCircle(
                Color(0xFFFF5252),
                5f,
                Offset(cx + maxR * sin(nAngle).toFloat(), cy - maxR * cos(nAngle).toFloat())
            )

            drawCircle(Color.White, 5f, center) // you
        }

        if (state.signals.isEmpty()) {
            Text(
                if (state.scanning) "suche…" else "Scan starten",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun DirectionPanel(state: RadarState) {
    val target = state.target ?: return
    val dir = state.direction
    val arrowColor = strengthColor(target.strength)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Arrow pointing to the estimated bearing relative to where you face.
            Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) {
                    val c = Offset(size.width / 2f, size.height / 2f)
                    drawCircle(Color(0xFF13313A), size.minDimension / 2f, c, style = Stroke(2f))
                    if (dir != null) {
                        val screen = angleDelta(dir.bearing, state.headingDeg)
                        rotate(screen, c) {
                            val p = Path().apply {
                                moveTo(c.x, c.y - size.minDimension * 0.4f)
                                lineTo(c.x - size.minDimension * 0.18f, c.y + size.minDimension * 0.18f)
                                lineTo(c.x + size.minDimension * 0.18f, c.y + size.minDimension * 0.18f)
                                close()
                            }
                            drawPath(p, arrowColor)
                        }
                    } else {
                        drawCircle(Color(0xFF13313A), 6f, c)
                    }
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.fillMaxWidth()) {
                Text(
                    target.name,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1
                )
                Text(
                    "≈ ${target.estimatedDistanceM.roundToInt()} m  ·  ${target.rssi} dBm",
                    fontFamily = FontFamily.Monospace,
                    color = arrowColor,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                if (dir == null) {
                    Text(
                        "Geh ein paar Schritte – dann schätze ich die Richtung.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                } else {
                    Text(
                        "Richtung ${compassLabel(dir.bearing)} · Sicherheit ${(dir.confidence * 100).roundToInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                    )
                    Spacer(Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { dir.confidence },
                        modifier = Modifier.fillMaxWidth(),
                        color = arrowColor,
                    )
                    if (dir.confidence < 0.4f) {
                        Text(
                            "noch unsicher – weiter gehen",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                }
                if (!state.hasGps) {
                    Text(
                        "kein GPS-Fix – nutze Kompass (geh nach draußen für mehr Genauigkeit)",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFFFC400).copy(alpha = 0.8f)
                    )
                }
            }
        }
    }
}

@Composable
private fun SignalRow(signal: Signal, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
            else MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when (signal.type) {
                    SignalType.WIFI -> Icons.Filled.Wifi
                    SignalType.BT_CLASSIC -> Icons.Filled.SettingsRemote
                    SignalType.BLE -> Icons.Filled.Bluetooth
                },
                contentDescription = signal.type.name,
                tint = strengthColor(signal.strength),
                modifier = Modifier.size(28.dp)
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    signal.name,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
                Text(
                    "${signal.id}  ·  ≈${signal.estimatedDistanceM.roundToInt()} m",
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    maxLines = 1
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                "${signal.rssi}",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = strengthColor(signal.strength)
            )
        }
    }
}

@Composable
private fun DisclaimerCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            "Tippe dein Gerät an (z. B. dein Headset). Dann zeigt die App eine grobe " +
                "Richtung + Distanz, sobald du ein paar Schritte gehst. WLAN-Scan sieht nur " +
                "Router, nicht dein Handy – such über Bluetooth/BLE.",
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun EmptyHint(scanning: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (scanning) "Suche nach Signalen…" else "Tippe „Scan starten“",
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}

/** Stable pseudo-angle (0..360) per device so overview blips don't jump around. */
private fun stableAngle(id: String): Float = ((id.hashCode() and 0xffff) / 65535f) * 360f

private fun strengthColor(strength: Float): Color = when {
    strength >= 0.66f -> Color(0xFF00E5A0)
    strength >= 0.33f -> Color(0xFFFFC400)
    else -> Color(0xFFFF5252)
}
