# Tab Konfiguration

## Übersicht

Der Tab **Konfiguration** enthält die Übersetzungsrichtlinie für das gewählte Projekt: Modellauswahl je Modul, Wiederverwendung über Translation Memory, Batch-Gruppierung, Qualitätsprüfungen (LQA) und Projektverwaltung. Seine **Sprachen** und der **CSV-Import/-Export** liegen jetzt im eigenen Tab **Daten**. Zugangsdaten von Anbietern werden hier nicht eingerichtet — sie liegen im **Zugangsdaten-Tresor** (siehe die *Modul konfigurieren*-Guides und die **Globale Konfiguration**).

## Sprachen (im Tab Daten)

Die **Quellsprache** und die **Zielsprachen** für die Übersetzung im Tab **Daten** festlegen. Die aktive Zielsprachen-Auswahl steuert jeden anderen Tab — die Eintragsspalten, die Routing-Regeln und die Qualitätsprüfungen richten sich alle danach.

## CSV importieren und exportieren (im Tab Daten)

CSV-Import und -Export liegen ebenfalls im Tab **Daten**:

* **CSV-Import** lädt Quelltexteinträge und vorhandene Übersetzungen. Vor jedem Import wird automatisch ein Sicherheits-Snapshot erstellt, sodass sich der Import über den Tab **Backup** rückgängig machen lässt.
* Zeilen, die sich nicht sauber parsen lassen (ein Anführungszeichen direkt gefolgt von einem Komma), werden verworfen und gemeldet, statt als spaltenverschobene Daten geschrieben zu werden.
* **CSV-Export** lädt das Projekt herunter; dabei lassen sich Sprachen wählen und festlegen, ob die Übersetzerkontext-Spalte einbezogen wird.

## Module und Modelle

Anbieter werden einmal in der **Globalen Konfiguration** aktiviert. Hier im Tab Konfiguration wird je Projekt das **Modell** und der **Reasoning-Aufwand** für jedes aktivierte Modul gewählt — oder auf *Von der globalen Konfiguration erben* belassen. Welches Modul für einen bestimmten Eintrag tatsächlich läuft, entscheiden die **Routing-Regeln** (siehe den *Routing*-Guide).

## LQA-Prüfungen

Das Panel **LQA-Prüfungen** konfiguriert das Qualitäts-Gate, das bei jeder Übersetzung läuft: einzelne Prüfungen (Gleichheit der Inline-Tags, Längenlimit, Längenüberlauf, Glossartreue, verbotene Begriffe, Regex-Zusicherungen und weitere) sich ein- und ausschalten lassen und sich jeweils auf **Blockierend** oder **Warnung** setzen lassen. Blockierende Beanstandungen lassen die Übersetzung am Gate scheitern und können eine automatische Wiederholung auslösen; Warnungen werden nur gemeldet.

## Batch-Gruppierung

**Batch-Gruppierung** hält zusammengehörige Einträge (nach Kategorie und/oder Glossar) in derselben Anfrage zusammen, damit das Modell sie im Kontext sieht. Ein Projektstandard lässt sich festlegen und je Durchlauf überschreiben.

## Projektverwaltung

Im **Gefahrenbereich** lässt sich das Projekt **duplizieren** (Konfiguration und Einträge, nie Geheimnisse) oder dauerhaft **löschen**.
