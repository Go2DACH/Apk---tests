# Cloud-Speicher (Git als Backend)

Dieser Ordner ist der **Cloud-Speicher** von IR-Pilot. GitHub Pages ist statisch
und kann keine Uploads annehmen – deshalb ist das **Git-Repo selbst der Speicher**:
die App schreibt schlanke Vorfall-Snapshots über die **GitHub Contents-API**
hierher, und das **Dashboard auf Pages** (`dashboard.html`) liest sie wieder.

```
Endpoints (Boot-Stick / Windows-App)  ──►  App (zentral)  ──►  cloud/incidents/  ──►  dashboard.html (Pages)
        Forensik-Rohdaten                    veröffentlicht        Git-Speicher           liest & zeigt
```

## Layout
- `incidents/index.json` — Liste aller veröffentlichten Vorfälle (Titel, Status,
  Fortschritt, Datei-Anzahl, Zeitstempel). Das Dashboard liest **diese** Datei.
- `incidents/<id>.json` — voller Snapshot eines Vorfalls (Kennzahlen, Datei-Verweise,
  Incident-Report als Markdown).

## Wer schreibt, wer liest
- **Schreiben (App):** braucht einen **fein granularen PAT** mit `Contents: write`
  **nur für das Daten-Repo**. Der Token bleibt lokal im Browser (localStorage),
  wird nie committet. Konfiguration in der App unter „☁️ Cloud".
- **Lesen (Dashboard/Pages):** kein Token nötig, wenn das Repo öffentlich ist –
  `dashboard.html` lädt `index.json` statisch (gleiches Repo) oder via
  `?repo=owner/name` aus einem anderen öffentlichen Daten-Repo (raw.githubusercontent).

## Wichtig
- **Große Beweis-Rohdaten** (pcap, Disk-Images) gehören **nicht** ins Git. Sie
  bleiben auf den Forensik-Hosts (Boot-Stick/Windows) und sind dort per Download
  abrufbar. In der Cloud liegen nur **Metadaten + Report + Verweise**.
- Für vertrauliche Fälle ein **privates** Daten-Repo nutzen; dann brauchen auch
  Dashboard-Leser einen Token (oder ein internes Hosting).
