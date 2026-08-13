# Tab Glossar

## Übersicht

Der Tab **Glossar** hält die Terminologie konsistent. Ein Projekt kann mehrere Glossare enthalten; jedes ist eine Liste von Quellbegriffen mit einer Übersetzung je Zielsprache. Glossare werden automatisch mit Einträgen abgeglichen, und die getroffenen Begriffe gehen bei der Übersetzung an das Modell.

## Glossare und Begriffe

* Mit **Neues Glossar** ein Glossar anlegen; später umbenennen oder löschen.
* Ein Glossar **aktivieren** oder **deaktivieren** — ein deaktiviertes Glossar wird beim Import und bei der Übersetzung ignoriert.
* Begriffe mit einer **Quelle**, einer **Übersetzung je Sprache** und optionalen **Notizen** hinzufügen.
* Einen Begriff als **konstant** markieren, wenn er nie übersetzt werden darf (Markennamen, Codes). Konstante Begriffe werden bei der Übersetzung maskiert, damit sie unverändert durchgereicht werden.

Manche Glossare sind **schreibgeschützt** (global verwaltet) und liefern Begriffe, ohne hier bearbeitbar zu sein.

## Import und Export

Begriffe aus **CSV** oder **TBX** importieren — eine Vorschau zeigt vor dem Anwenden, wie viele Begriffe hinzukommen, aktualisiert werden oder in Konflikt stehen. Das Glossar auch wieder nach **CSV** oder **TBX** exportieren.

## Mit KI generieren

* **Glossare generieren** durchsucht den Quelltext und schlägt Glossare aus wiederkehrenden Namen und eigenen Begriffen vor. Läuft im Hintergrund — im Tab **Aktivität** verfolgen und die Vorschläge prüfen, bevor sie erstellt werden. Vorhandene Glossare lassen sich als „bereits bekannt“ übergeben, damit das Modell sie nicht wiederholt.
* **Übersetzungen generieren** füllt Zielübersetzungen für Begriffe, denen sie noch fehlen.

## DeepL

Wird mit DeepL übersetzt, **An DeepL übertragen** verwenden, um Glossarbegriffe hochzuladen. Nach dem Bearbeiten eines übertragenen Glossars zeigt der Tab *Erneute Übertragung nötig* — erneut übertragen, um DeepL zu aktualisieren.

## Steuerung je Eintrag

Im Tab Übersetzungen lässt sich für einen einzelnen Eintrag wählen, welche Glossare **aktiviert** sind.
