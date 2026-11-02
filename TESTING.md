# Tests und Reproduzierbarkeit — Knips

## Voraussetzungen
Node >=24.14 <25; keine Server-Laufzeitpakete nötig. Browserprüfungen mit Playwright/Chrome.

## Befehle
```text
npm test
node test/browser-smoke.mjs
```

Start/Build: npm start oder npm run demo. Jeder Start nutzt einen neuen Unterordner unter data/demo-runs. Der konfigurierbare Backendstart heißt npm run start:server.

## Tatsächlicher Befund vom 02.11.2026
31 Tests: 29 bestanden, 2 Signiertests ausgelassen. Neue Direktnachrichten mit vier HTTP-Testgruppen und fünf Zwei-Profil-Browsergruppen geprüft; bestehende Foto-/Like-/Kommentar-/Konto-Browserregression bestanden.

Bei fehlenden Paketen/Hardware/Betriebssystemen ist das Ergebnis „nicht ausgeführt“, kein Pass. Plattformnachweise aus älteren Detailberichten gelten nur für die dort genannten Versionen. Android-Automatisierung ausschließlich mit expliziter emulator-Seriennummer und bestätigtem ro.kernel.qemu=1. Physische Geräte, persönliche Medien und Produktionskonten sind keine Testfixtures.

## Vor Merge
`git diff --check` ausführen; relevante Funktionstests wiederholen, wenn Codeänderungen ihren Befund entwerten. Speicherdaten/alte Versionen erhalten. Fehlende externe Abnahmen in HANDOFF.md benennen.

## Direktnachrichten am 02.11.2026

`node --test test/*.test.mjs`: 29 Pass, 2 Signatur-Skips, 0 Fehler. Vier neue HTTP-Gruppen prüfen echte Sitzungen, Empfängerzustimmung, keinen Zugriff für Fremde/Moderatoren, doppelte Nachrichtenkennungen, chronologische Pagination, Eingabelimits/200-Nachrichtenbudget, Blockieren und erneute Zustimmung, Kontolöschung/Wiederanlage sowie langsame Requests nach Logout/neuer Blockierung. Testdaten liegen unter data/test-runs.

`node test/direct-messages-browser.mjs`: fünf Gruppen mit zwei unabhängigen Chrome-Kontexten bestanden: Kontakt→Annahme→beidseitige Nachrichten, Textescaping, Reload, 390px, Blockieren und privates DOM/Drafts nach mobilem Logout geleert. Anfangs wartete die Probe nicht auf das nachgeladene Archiv und verwendete den auf Mobilgeräten ausgeblendeten Sidebar-Abmeldeknopf; die Probe wartet jetzt ausdrücklich und nutzt den sichtbaren Profil-Abmeldeweg. Endgültiger Lauf bestanden. `node test/browser-smoke.mjs` für Registrierung/Fotoupload/Like/Kommentar/Kontolöschung ebenfalls bestanden. Kein Android-/Live-Hosting-Nachweis dieser neuen Funktion.
