package com.lostphone.radar

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.lostphone.radar.model.Signal
import com.lostphone.radar.model.SignalType
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = RadarColors) {
                RadarScreen()
            }
        }
    }
}

private val RadarColors = darkColorScheme(
    primary = Color(0xFF00E5A0),
    background = Color(0xFF05080C),
    surface = Color(0xFF0D141B),
    onBackground = Color(0xFFE6F0EA),
    onSurface = Color(0xFFE6F0EA),
)

/** Permissions we must hold at runtime, depending on the OS version. */
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
    val context = androidx.compose.ui.platform.LocalContext.current
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            Header(
                scanning = state.scanning,
                onToggle = {
                    if (state.scanning) {
                        vm.stopScanning()
                    } else if (hasPermissions) {
                        vm.startScanning()
                    } else {
                        launcher.launch(requiredPermissions())
                    }
                }
            )

            RadarGauge(target = state.target)

            DisclaimerCard()

            Spacer(Modifier.height(12.dp))

            if (state.signals.isEmpty()) {
                EmptyHint(scanning = state.scanning)
            } else {
                Text(
                    text = "Gefundene Signale (${state.signals.size}) — tippe dein Gerät an",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                    modifier = Modifier.padding(vertical = 8.dp)
                )
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
            }
        }
    }
}

@Composable
private fun Header(scanning: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
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
                "Bluetooth + WLAN Nahbereichssuche",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )
        }
        Button(onClick = onToggle) {
            Text(if (scanning) "Stopp" else "Scan starten")
        }
    }
}

@Composable
private fun RadarGauge(target: Signal?) {
    val strength = target?.strength ?: 0f
    val animated by animateFloatAsState(targetValue = strength, label = "strength")
    val color = strengthColor(strength)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1.3f),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val maxR = minOf(cx, cy) * 0.92f

            // Concentric range rings.
            for (i in 1..4) {
                drawCircle(
                    color = Color(0xFF1C2A33),
                    radius = maxR * i / 4f,
                    center = androidx.compose.ui.geometry.Offset(cx, cy),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f)
                )
            }
            // Filled "proximity" blob: grows and brightens as the signal gets stronger.
            if (target != null) {
                drawCircle(
                    color = color.copy(alpha = 0.18f),
                    radius = maxR * (0.15f + animated * 0.85f),
                    center = androidx.compose.ui.geometry.Offset(cx, cy)
                )
                drawCircle(
                    color = color,
                    radius = 10f + animated * 22f,
                    center = androidx.compose.ui.geometry.Offset(cx, cy)
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (target == null) {
                Text(
                    "Kein Ziel gewählt",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
            } else {
                Text(
                    "${target.rssi} dBm",
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = color
                )
                Text(
                    proximityLabel(strength),
                    color = color,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    target.name,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                )
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
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (signal.type == SignalType.BLE) Icons.Filled.Bluetooth else Icons.Filled.Wifi,
                contentDescription = signal.type.name,
                tint = strengthColor(signal.strength),
                modifier = Modifier.size(28.dp)
            )
            Spacer(Modifier.size(12.dp))
            Column(modifier = Modifier.fillMaxWidth(0.7f)) {
                Text(
                    signal.name,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
                Text(
                    signal.id,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    maxLines = 1
                )
            }
            Spacer(Modifier.fillMaxWidth().weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${signal.rssi}",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = strengthColor(signal.strength)
                )
                Text(
                    "${(signal.strength * 100).roundToInt()}%",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
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
            "Findet nur Geräte in Reichweite (~10 m), die eingeschaltet sind und senden. " +
                "Du kannst nur dein eigenes Gerät suchen. Für ein entferntes Handy: nutze " +
                "Find My Device / Wo ist?.",
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
            .height(120.dp)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (scanning) "Suche nach Signalen…" else "Tippe „Scan starten“",
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}

private fun strengthColor(strength: Float): Color = when {
    strength >= 0.66f -> Color(0xFF00E5A0) // warm / close
    strength >= 0.33f -> Color(0xFFFFC400) // medium
    else -> Color(0xFFFF5252)              // cold / far
}

private fun proximityLabel(strength: Float): String = when {
    strength >= 0.8f -> "SEHR NAH 🔥"
    strength >= 0.6f -> "Nah"
    strength >= 0.4f -> "In der Nähe"
    strength >= 0.2f -> "Weiter weg"
    else -> "Kalt ❄️"
}
