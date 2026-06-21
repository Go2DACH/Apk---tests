# Tastatur & Maus simulieren – wenn am Zielrechner keine Tastatur da ist

Szenario: Du stehst am Vorfall, der Zielrechner (oder das gebootete Forensik-Linux
auf deinem USB-Stick) braucht eine Eingabe, aber du hast nur dein Smartphone
(Galaxy Fold 5) und ein USB-Kabel. Diese Notiz sagt ehrlich, **was ohne Root am
Telefon geht und was nicht** – und nennt den Weg, den IR-Pilot empfiehlt.

## Kurzfassung (Entscheidung)

| Weg | Root am Handy nötig? | Empfehlung |
|-----|----------------------|------------|
| **Web-Steuerung über `control-server.py`** | **Nein** | **Primär – so machen wir es** |
| USB-HID-Gadget (Handy = USB-Tastatur) | **Ja** (Kernel-Gadget, `/dev/hidg0`) | Nur mit gerootetem Handy |
| Bluetooth-HID (Handy emuliert BT-Tastatur) | meist Ja / App-abhängig | Optional, wackelig |
| Echte USB-Tastatur am OTG-Hub | – | Wenn vorhanden: am einfachsten |

## Warum nicht „Handy als USB-Tastatur" (HID-Gadget)?

Damit ein Android-Telefon sich als USB-Tastatur/Maus ausgibt, muss der Kernel im
**USB-Gadget-Modus** ein HID-Device (`/dev/hidg0`) bereitstellen und eine App
muss da hineinschreiben. Beides braucht **Root** (ConfigFS-Gadget umschalten,
Rohzugriff aufs Gerät). Auf einem Seriengerät ohne Root ist das **nicht möglich** –
egal was manche Apps versprechen. Da unsere Vorgabe „App läuft ohne Root" ist,
ist HID-Gadget **kein** Standardweg. (Wenn dein Einsatz-Handy gerootet ist:
`echo -ne "\0\0\x04..." > /dev/hidg0` nach ConfigFS-Setup – dann ja.)

## Der no-root-Weg, den IR-Pilot nutzt: Web-Fernsteuerung

Du brauchst gar keine simulierte Tastatur, wenn das Ziel ohnehin **dein eigener
Boot-Stick** ist (der häufigste Fall: du bootest den Verdachtsrechner von deinem
Forensik-USB, weil sein eigenes OS unangetastet bleiben soll).

1. Forensik-Stick im Zielrechner booten (kein Auto-Mount, read-only).
2. Verbindung Handy ⇄ Stick herstellen – eine der drei Optionen:
   - **USB-Ethernet-Adapter** am Handy + Kabel zum Stick-Rechner (oder umgekehrt),
   - **WLAN**: beide im selben Netz / Stick als Hotspot,
   - **USB-Tethering**: Handy hängt am Stick-Rechner, der bekommt darüber ein Netz.
3. Auf dem Stick startet `ir-control.service` automatisch (oder im autorun-Menü
   Punkt **7**). Die Konsole/der Dienst zeigt **URL + Token**.
4. Im **Handy-Browser** die URL öffnen (`http://<stick-ip>:8080/?t=<token>`).
   Ab hier steuerst du **per Touch** statt Tastatur:
   - Datenträger anzeigen, read-only mounten,
   - Image sichern (ewf/dd), Windows/Linux offline-Triage,
   - Beweis-Manifest (SHA256) erzeugen, Netzwerk-Capture starten,
   - die volle IR-Pilot-App über `/app/index.html` laden.

Damit ist **keine** physische Tastatur am Zielrechner nötig und **kein** Root am
Telefon. Das Token in der URL schützt vor fremdem Zugriff im selben Netz – nur in
einem vertrauenswürdigen Analyse-Netz betreiben.

## Wenn du wirklich am fremden OS tippen musst

Soll der **laufende Original-Rechner** (nicht dein Stick) bedient werden und es
fehlt jede Tastatur:

- **Einfachster Weg:** billige USB-Tastatur/-Maus über einen OTG-Hub – immer dabei haben.
- **Handy-HID:** nur mit gerootetem Einsatz-Handy (siehe oben). Dann z. B.
  „DroidPad/USB-Keyboard"-artige Lösungen über `/dev/hidg0`.
- **Bluetooth-HID:** App, die das Handy als BT-Tastatur koppelt; Zuverlässigkeit
  je nach Android-Version/App unterschiedlich, vor dem Einsatz testen.

> Merke: Für **Beweissicherung** ist der Boot-Stick + Web-Fernsteuerung der saubere
> Weg – du fasst das Originalsystem gar nicht an. Tastatur-Simulation am Original
> ist nur für Sonderfälle (z. B. BIOS/Boot-Reihenfolge ändern).
