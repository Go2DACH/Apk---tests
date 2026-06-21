# IDS / Asset-Inventar / Schwachstellen als Datenquelle anbinden

IR-Pilot kann ein externes Tool (z.B. dein **IDS mit Asset-Inventar und
Schwachstellen-Management**) als **Daten-Lieferant** anbinden – ohne den
Boot-Stick-Control-Server zu sprechen. Es genügt **ein HTTP-Endpunkt, der JSON im
unten beschriebenen Format liefert**.

In der App: **Start → „🗄️ Datenquellen" → URL (+ optional Token) hinzufügen →
„⤵ Abrufen → in Fall"**. Die Daten landen im aktiven Vorfall (Assets,
Schwachstellen, IOCs, Hosts, IDS-Alerts) und im Bericht/PDF.

## Erwartetes JSON

Alle Felder sind optional – liefere, was du hast. Aliasnamen werden toleriert
(`vulnerabilities`→`vulns`, `inventory`→`assets`, `events`→`alerts`). Ein reines
Array wird als **Asset-Liste** interpretiert.

```json
{
  "source": "mein-ids",
  "assets": [
    { "name": "KASSE-01", "ip": "10.20.0.21", "mac": "00:11:22:33:44:55",
      "type": "POS", "os": "Windows 10", "location": "Filiale Süd",
      "owner": "IT-Retail", "criticality": "hoch" }
  ],
  "vulns": [
    { "asset": "KASSE-01", "cve": "CVE-2024-12345", "cvss": 9.8,
      "severity": "kritisch", "title": "RCE in Dienst X", "status": "offen" }
  ],
  "alerts": [
    { "ts": "2026-06-21T10:00:00Z", "signature": "ET TROJAN C2 Beacon",
      "severity": "high", "src_ip": "10.20.0.21", "dest_ip": "203.0.113.66" }
  ],
  "iocs":  [ { "type": "ip", "value": "203.0.113.66", "note": "C2" } ],
  "hosts": [ { "ip": "10.20.0.21", "name": "KASSE-01", "ports": "445,3389" } ]
}
```

### Mapping in IR-Pilot
| IDS-Daten | Feld | landet in |
|-----------|------|-----------|
| Asset-Inventar | `assets[]` | Fall-Assets + Bericht (4a) |
| Schwachstellen | `vulns[]` | Fall-Schwachstellen + Bericht; kritische → Zeitachse |
| IDS-Alerts | `alerts[]` | IOCs (src/dest IP) + Zeitachse (`kind: ids`) |
| Indikatoren | `iocs[]` | IOC-Liste |
| Hosts | `hosts[]` | IOC `host` |

## Auth & Netz
- Optionaler **Token** wird als `Authorization: Bearer <token>` gesendet.
- Antworte mit `Content-Type: application/json` und – wenn die App von einem
  anderen Origin lädt – mit **CORS** (`Access-Control-Allow-Origin: *`, token-
  geschützt). In der **APK** ist Cleartext zu lokalen `http`-Endpunkten erlaubt;
  die reine **https-Pages-PWA** kann lokale `http`-Quellen wegen Mixed-Content
  nicht direkt abrufen (dann APK nutzen oder die Quelle per https/Tunnel anbieten).

## Alternativen (ohne Live-Abruf)
- **Push:** Dein IDS schickt dasselbe JSON per `POST` an einen Boot-Stick
  (`/api/intake?t=<token>&name=ids.json`) – erscheint dann beim Host.
- **Datei/Quick-Paste:** Export als `ingest.json` und in der App unter
  **Bericht → Daten importieren** einlesen.

> Wenn du mir die Ausgabe/das API-Schema deines IDS schickst, schreibe ich dir
> einen passgenauen Adapter (Mapping deiner Feldnamen auf obiges Format).
