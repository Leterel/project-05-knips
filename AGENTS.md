# Agentenleitfaden — Knips

## Einstieg
Lokaler Foto-App-Test mit synthetischen Konten, Feed, Fotos, Likes, Kommentaren und Moderation. Reels/DM sind noch keine fertiggestellten Funktionen.

Lies README.md, TESTING.md und HANDOFF.md. Anforderungen und vorhandene Funktionen unterscheiden. Technische Grundlagen: README.md. Die bestehenden Detaildokumente bleiben maßgeblich; keine leeren SPEC-/ARCHITECTURE-/TODO-Kopien erzeugen. Offene Arbeit und Verlauf: PROGRESS.md; konkrete Einnahmegrenzen: MONETIZATION.md, soweit vorhanden.

## Umgebung und Start
Node >=24.14 <25; keine Server-Laufzeitpakete nötig. Browserprüfungen mit Playwright/Chrome.

npm start oder npm run demo. Jeder Start nutzt einen neuen Unterordner unter data/demo-runs. Der konfigurierbare Backendstart heißt npm run start:server.

Tests: `npm test; node test/browser-smoke.mjs`. Bei mehreren Befehlen einzeln ausführen und jeden Exitcode prüfen. Vorhandene Installationen verwenden; fehlende Voraussetzungen melden statt automatisch globale Pakete oder Modelle zu installieren.

## Grenzen
- Größere Änderungen auf einem eigenen Branch; zuerst git status und fremde Änderungen prüfen. Keine parallelen widersprüchlichen Arbeiten am selben Branch.
- Keine Dateien/Repos löschen oder verschieben, keine Historien umschreiben, kein Force-Push. Keine Lizenzänderungen ohne konkrete Freigabe.
- Keine Secrets, privaten Daten, echten Nutzerinhalte oder großen generierten Dateien committen. Keine Sichtbarkeitsänderungen oder zusätzlichen Veröffentlichungen ohne Freigabe.
- Keine bezahlten Dienste, Werbenetzwerke, Zahlungsanbieter oder externe Nachrichten aktivieren.
- Alle Demo-/Testdaten im Projektordner data halten. Keine echten Nutzerdaten, produktiven Verzeichnisse, zahlenden Provider oder Tracking-SDKs voraussetzen.
- Projektwerkzeuge ändern keine anderen Projektquellen. Build-/Testartefakte in isolierten, ignorierten Arbeitsordnern halten. Vorhandene Ausgaben nicht unbesehen überschreiben.

## Nächste sichere Etappe
Lokalen Ersttest mit synthetischen Daten reproduzieren; danach sichere kleine DM-/Video-Etappe auswählen, ohne produktive Infrastruktur vorauszusetzen.

## Übergabe
HANDOFF.md aktualisieren: Ausgangscommit/Branch, konkrete Änderungsliste, ausgeführte Befehle, Ergebnis, ausgelassene Tests samt Grund, Risiken und nächste Etappe. Nur tatsächlich ausgeführte Tests als bestanden ausweisen. Vor Merge Diff und Tests prüfen; externe Freigaben bleiben offen.
