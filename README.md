# Session Mesh — unabhängiges VS-Code-Experiment

**Experimental preview · Windows x64 · VS Code Desktop.** Noch keine stabile Marketplace-Version. Claude → Codex wurde live bestätigt; der Rückweg ist noch nicht abgenommen. Nicht mit OpenAI, Anthropic oder Microsoft verbunden oder von ihnen unterstützt.

## Installation aus einer VSIX

In VS Code: Extensions → Menü (…) → Install from VSIX → `session-mesh-win32-x64-0.1.0.vsix` auswählen. Alternativ `code --install-extension <Pfad-zur-VSIX>`. Einen vertrauenswürdigen lokalen Ordner öffnen. Remote/WSL, virtuelle Workspaces und andere Betriebssysteme werden in dieser Version nicht unterstützt. Node.js 22+ muss installiert und im PATH sein; alternativ `sessionMesh.nodePath` setzen. Mindestens der gewünschte Harness muss separat installiert und angemeldet sein. Ohne Herstellererweiterung den absoluten CLI-Pfad in `sessionMesh.claudePath` bzw. `sessionMesh.codexPath` setzen. Für beide Harnesse werden eigene Konten und verfügbare Nutzungskontingente benötigt.

## Projekt und Veröffentlichung

[Datenschutz](PRIVACY.md), [Lizenz](LICENSE), [Änderungen](CHANGELOG.md), [Beiträge](CONTRIBUTING.md), [Sicherheit](SECURITY.md) und [Release-Ablauf](RELEASING.md). Der Runtime-Code hat keine npm-Abhängigkeiten. Anbieter-Binaries und Zugangsdaten sind nicht im Paket enthalten. Der lokale Publisher `local-lab` muss vor einer öffentlichen Marketplace-Veröffentlichung durch die tatsächliche Publisher-ID ersetzt werden.

Eigenständige Erweiterung ohne Abhängigkeit von harnes-sync. Benötigt Windows, VS Code, Node.js 22+ und die angemeldeten Claude-/Codex-CLIs. Die installierten Herstellererweiterungen dienen nur zur Binary-Erkennung. Keine Herstellerdateien oder globalen Einstellungen werden verändert.

## Ausprobieren

Nach Installation der VSIX das Session-Mesh-Symbol in der Activity Bar öffnen. Über + eine Claude- und eine Codex-Session im gewünschten Workspace anlegen. Namen beispielsweise `orchestrator` und `worker`. Rechtsklick → Nachricht senden. Anklicken öffnet den Verlauf mit Mesh-ID, nativer ID, Verbindungs- und Arbeitszustand. IDs stehen zusätzlich im Tooltip.

Dem Orchestrator sagen: „Warte auf Ergebnisse. Antworte nur, wenn eine Entscheidung oder neue Aufgabe nötig ist.“ Dem Worker sagen: „Benutze list_sessions, löse [Aufgabe] und sende dein Ergebnis mit send_message an orchestrator.“ Kein Abschluss-Hook erforderlich. Ein Peer-Aufruf ist keine menschliche Freigabe. Angeforderte Datei-/Shellfreigaben erscheinen in VS Code und werden nicht automatisch erteilt.

Online heißt: Der verwaltete Prozess ist verbunden. Verfügbar heißt: online und kein aktiver Turn. Das ist keine Garantie für ausreichendes Nutzungskontingent oder erfolgreiche Authentifizierung beim nächsten Modellaufruf. Fremde, bereits offene Hersteller-Chats werden in Version 0.1 nicht übernommen. Diese Erweiterung startet echte eigene Harness-Sitzungen und zeigt deren Verlauf selbst an.

## Architektur und Grenzen

- `core.cjs`: Adapter für Codex JSON-RPC app-server und Claude stream-json. Gemeinsamer Vertrag: start, send, snapshot, stop; change-Ereignis.
- `mcp.cjs`: identische Werkzeuge list_sessions und send_message in beiden Harnessen.
- `extension.cjs`: Sitzungsregister, authentifizierter Loopback-Router, Freigaben und VS-Code-Ansichten. Tokens gelten nur für die jeweilige Absendersitzung und werden nicht angezeigt.
- Nachrichten, Warteschlange und Verläufe sind in dieser Experimentversion im Arbeitsspeicher. VS-Code-Neuladen beendet verwaltete Prozesse und verliert diese Daten. Keine garantierte Zustellung über Neustarts und keine automatische Wiederholung nach unklarem Versand.
- Codex erhält Nachrichten während eines Turns zunächst in eine lokale Queue. Claude erhält sie über seinen persistenten Inputstream. Transportannahme wird ausdrücklich von Bearbeitung unterschieden.
- Kein Polling-Modell, keine versteckten Abschlussmeldungen. Agenten senden selbst. Endlosschleifen sind durch klare Aufträge zu vermeiden; Self-Messaging wird abgewiesen. Ein globales Budget und Ratenbegrenzung sind noch nicht implementiert.
- Lokaler IPC-Endpunkt erlaubt nur angemeldete Session-Tokens, andere lokale Prozesse mit Zugriff auf denselben Benutzer sind keine eigene Sicherheitsgrenze.
- Nicht unterstützte Harness-Requests werden explizit abgelehnt. Freigabe-UI deckt einfache Shell-/Dateianfragen ab; weitere interaktive Protokolltypen brauchen eigene Adapterunterstützung.

## Entwicklung

`npm test` prüft Adressierung, Warteschlange, Status und MCP-Vertrag. `npm run package` baut die VSIX. Ohne Installation: `code --new-window --extensionDevelopmentPath=D:\Development\session-mesh <Arbeitsordner>`.

Referenzen: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [Claude CLI](https://code.claude.com/docs/en/cli-reference). Native Endläufe mit beiden angemeldeten Harnessen sind zusätzlich zu den Protokolltests erforderlich.
