package com.lostphone.radar.nfc

import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.MifareUltralight
import android.nfc.tech.NfcA

/** A human-readable summary of a scanned NFC tag, plus an honest verdict on
 *  whether a phone could realistically use it as a garage key. */
data class TagInfo(
    val uid: String,
    val techs: List<String>,
    val typeLabel: String,
    val details: List<Pair<String, String>>,
    val verdict: String
) {
    companion object {
        fun from(tag: Tag): TagInfo {
            val uid = tag.id.toHex()
            val techs = tag.techList.map { it.substringAfterLast('.') }
            val details = mutableListOf<Pair<String, String>>()

            NfcA.get(tag)?.let {
                details += "ATQA" to it.atqa.toHex()
                details += "SAK" to "0x%02X".format(it.sak)
            }

            val mifareClassic = MifareClassic.get(tag)
            val mifareUltralight = MifareUltralight.get(tag)
            val isoDep = IsoDep.get(tag)

            val typeLabel: String
            val verdict: String
            when {
                mifareClassic != null -> {
                    details += "Größe" to "${mifareClassic.size} Byte"
                    details += "Sektoren" to "${mifareClassic.sectorCount}"
                    typeLabel = "MIFARE Classic (UID-basiert)"
                    verdict = "Typischer Tür-/Garagen-Tag. Der Leser prüft fast immer die " +
                        "feste UID. Ein normales Handy kann diese UID NICHT per HCE " +
                        "vortäuschen → als Handy-Schlüssel nicht nutzbar. Eine Kopie ginge " +
                        "nur auf einen physischen „Magic-Tag“ mit beschreibbarer UID (und " +
                        "nur, wenn die Sektor-Schlüssel bekannt/Standard sind)."
                }
                mifareUltralight != null -> {
                    typeLabel = "MIFARE Ultralight / NTAG"
                    verdict = "Einfacher, oft beschreibbarer Tag. UID ist meist fest und " +
                        "wird vom Leser geprüft → Handy-Emulation scheidet aus. Inhalt lässt " +
                        "sich evtl. auf einen Leertag kopieren, öffnet aber nur, wenn der " +
                        "Leser nicht die UID prüft (selten)."
                }
                isoDep != null -> {
                    typeLabel = "ISO-DEP / Typ 4 (Smartcard)"
                    verdict = "Theoretisch der einzige Typ, den Android per HCE nachbilden " +
                        "kann — ABER nur das App-/AID-Protokoll, nicht geheime Schlüssel. " +
                        "Solche Karten (z. B. DESFire) sind kryptografisch geschützt; der " +
                        "Schlüssel ist nicht auslesbar und damit nicht kopierbar."
                }
                else -> {
                    typeLabel = "Unbekannter NFC-Typ"
                    verdict = "Konnte den Typ nicht eindeutig bestimmen. Falls dein " +
                        "„Schlüssel“ gar nicht reagiert, ist es evtl. ein 125-kHz-RFID-Tag " +
                        "(kein NFC) — den kann ein Handy grundsätzlich nicht lesen."
                }
            }

            return TagInfo(uid, techs, typeLabel, details, verdict)
        }

        private fun ByteArray.toHex(): String =
            joinToString(":") { "%02X".format(it) }
    }
}
