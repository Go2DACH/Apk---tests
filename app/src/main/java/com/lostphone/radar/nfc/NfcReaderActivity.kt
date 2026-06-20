package com.lostphone.radar.nfc

import android.nfc.NfcAdapter
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Reads and identifies an NFC tag (no emulation, no writing). It tells the user
 * exactly what their tag is and whether a phone could realistically act as it.
 */
class NfcReaderActivity : ComponentActivity() {

    private var nfcAdapter: NfcAdapter? = null
    private var onTag: ((TagInfo) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        setContent {
            MaterialTheme(colorScheme = Colors) {
                var tag by remember { mutableStateOf<TagInfo?>(null) }
                onTag = { tag = it }
                NfcScreen(tag = tag, nfcSupported = nfcAdapter != null, nfcEnabled = nfcAdapter?.isEnabled == true)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Reader mode keeps Android's own "tag scanned" UI from stealing the tag.
        val flags = NfcAdapter.FLAG_READER_NFC_A or
            NfcAdapter.FLAG_READER_NFC_B or
            NfcAdapter.FLAG_READER_NFC_F or
            NfcAdapter.FLAG_READER_NFC_V or
            NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
        nfcAdapter?.enableReaderMode(this, { tag ->
            val info = TagInfo.from(tag)
            runOnUiThread { onTag?.invoke(info) }
        }, flags, null)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableReaderMode(this)
    }

    private companion object {
        val Colors = darkColorScheme(
            primary = Color(0xFF00E5A0),
            background = Color(0xFF04070A),
            surface = Color(0xFF0D141B),
            onBackground = Color(0xFFE6F0EA),
            onSurface = Color(0xFFE6F0EA),
        )
    }
}

@Composable
private fun NfcScreen(tag: TagInfo?, nfcSupported: Boolean, nfcEnabled: Boolean) {
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "NFC-Tag lesen",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )

            when {
                !nfcSupported -> Notice("Dieses Gerät hat kein NFC.")
                !nfcEnabled -> Notice("NFC ist aus. Bitte in den Systemeinstellungen aktivieren.")
                tag == null -> Notice("Halte deinen Garagen-Tag an die Rückseite des Handys…")
            }

            tag?.let { TagCard(it) }
        }
    }
}

@Composable
private fun Notice(text: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Text(
            text,
            modifier = Modifier.padding(16.dp),
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
        )
    }
}

@Composable
private fun TagCard(info: TagInfo) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                info.typeLabel,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                fontSize = 18.sp
            )
            Spacer(Modifier.width(8.dp))
            InfoRow("UID", info.uid)
            InfoRow("Techs", info.techs.joinToString(", "))
            info.details.forEach { (k, v) -> InfoRow(k, v) }

            Spacer(Modifier.padding(top = 8.dp))
            Text(
                "Einschätzung",
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                info.verdict,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f)
            )
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.padding(vertical = 2.dp)) {
        Text(
            "$label: ",
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            fontSize = 13.sp
        )
        Text(
            value,
            color = MaterialTheme.colorScheme.onSurface,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp
        )
    }
}
