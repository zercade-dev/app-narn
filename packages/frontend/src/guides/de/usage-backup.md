# Tab Backup

## Übersicht

Der Tab **Backup** packt ein Projekt — Konfiguration, Einträge und Glossar — in ein verifizierbares `.zip`-Archiv. Jede Datei wird geprüfsummt, und beim Wiederherstellen werden die Prüfsummen verifiziert, bevor etwas zurückgeschrieben wird.

## Ein Backup erstellen

1. Ein Projekt auswählen.
2. Den Tab **Backup** öffnen.
3. Auf **Backup erstellen** klicken.
4. Das neue Archiv erscheint unter **Gespeicherte Backups**, wo es sich **herunterladen** lässt.

## Automatische Backups

Die App legt außerdem eigenständig Sicherheits-Snapshots an, die neben den manuellen Backups aufgeführt werden:

* **Vor einem CSV-Import** — ein Wiederherstellungspunkt von kurz vor dem Import.
* **Vor einer Neuübersetzung** — ein Wiederherstellungspunkt von kurz bevor Einträge überschrieben wurden.

Die Globale Konfiguration legt **Max. Backups pro Projekt** fest (Standard: 10); ältere Backups werden darüber hinaus entfernt.

## Wiederherstellen

1. Unter **Wiederherstellung aus einem Backup** eine `.zip`-Datei auswählen (oder eines der gespeicherten Backups wählen).
2. Die App verifiziert die Prüfsummen und zeigt eine Vorschau (Projekt, Dateien, Erstellungszeit).
3. Bestätigen. Beim Wiederherstellen werden Konfiguration, Einträge und Glossar des Projekts überschrieben — das lässt sich nicht rückgängig machen, im Zweifel also zuerst ein frisches Backup erstellen.

## Löschen

Mit **Löschen** bei einem gespeicherten Backup dieses Archiv dauerhaft vom Server entfernen.
