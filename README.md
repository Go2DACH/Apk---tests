# Geräte-Radar 📡

Eine native Android-App (Kotlin + Jetpack Compose), die per **Bluetooth-LE-**
und **WLAN-Scan** ein „heiß/kalt"-Nahbereichsradar anzeigt — um ein Gerät zu
finden, das **in der Nähe versteckt** liegt (Sofa, Auto, Zimmer).

## ⚠️ Was die App kann — und was nicht

| Technik | Status | Warum |
|---|---|---|
| **Bluetooth (BLE)** | ✅ | Misst Signalstärke (RSSI) ~bis 10 m als „wärmer/kälter". |
| **WLAN** | ✅ | Erkennt Geräte/Hotspots ~bis 30 m über die Signalstärke. |
| **Mobilfunk** | ❌ | Eine App kann fremde Handys nicht über Funkzellen orten (kein API-Zugriff, rechtlich nicht erlaubt). |
| **NFC** | ❌ | Reichweite ~4 cm — zum Suchen unbrauchbar. |

**Wichtig:**
- Findet nur Geräte, die **eingeschaltet** sind und **aktiv senden**.
- Moderne Handys **randomisieren ihre Bluetooth-/WLAN-Adresse** — du erkennst dein
  eigenes Gerät am zuverlässigsten über einen bekannten **Hotspot-Namen (SSID)**
  oder ein gekoppeltes BLE-Zubehör (z. B. Kopfhörer/Tracker).
- Ein **entferntes** verlorenes Handy findest du **nicht** hiermit, sondern über
  [Find My Device](https://www.google.com/android/find) (Android) bzw.
  [Wo ist?](https://www.icloud.com/find) (iPhone).

## Nutzung

1. „Scan starten" → Berechtigungen (Standort, Bluetooth, WLAN) erteilen.
2. In der Liste **dein Gerät antippen** → es wird auf dem großen Radar als Ziel verfolgt.
3. Langsam durch den Raum gehen: wird die Anzeige **grün / „SEHR NAH 🔥"**, bist du dicht dran.

## Bauen

Voraussetzung: JDK 17+ und Android SDK.

```bash
./gradlew assembleDebug
# Ergebnis: app/build/outputs/apk/debug/app-debug.apk
```

Alternativ baut der GitHub-Actions-Workflow (`.github/workflows/build.yml`) die
APK bei jedem Push automatisch und stellt sie als Artefakt bereit.

## Berechtigungen

- `ACCESS_FINE_LOCATION` — von Android für WLAN-/BLE-Scanergebnisse vorgeschrieben.
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (Android 12+) — BLE-Scan & Gerätenamen.
- `NEARBY_WIFI_DEVICES` (Android 13+), `ACCESS_WIFI_STATE`, `CHANGE_WIFI_STATE` — WLAN-Scan.

Die App sendet **keine Daten** nach außen — alles läuft lokal auf dem Gerät.

## Technik

- Kotlin, Jetpack Compose (Material 3), Coroutines/`StateFlow`.
- `BleScanner` (`BluetoothLeScanner`) und `WifiScanner` (`WifiManager`) liefern
  RSSI-Werte; das `RadarViewModel` glättet sie (exponentielle Glättung) und
  entfernt veraltete Einträge.
- minSdk 24, targetSdk 34.
