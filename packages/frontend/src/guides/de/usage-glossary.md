# Tab Glossar

## Übersicht

Der Tab **Glossar** hält die Terminologie konsistent. Ein Projekt kann mehrere Glossare enthalten; jedes ist eine Liste von Quellbegriffen mit einer Übersetzung je Zielsprache. Glossare werden automatisch mit Einträgen abgeglichen, und die getroffenen Begriffe gehen bei der Übersetzung an das Modell.

## Glossare und Begriffe

* Mit **Neues Glossar** ein Glossar anlegen; später umbenennen oder löschen.
* Ein Glossar **aktivieren** oder **deaktivieren** — ein deaktiviertes Glossar wird beim Import und bei der Übersetzung ignoriert.
* Begriffe mit einer **Quelle**, einer **Übersetzung je Sprache** und optionalen **Notizen** hinzufügen.
* Einen Begriff als **konstant** markieren, wenn er genau so herauskommen muss, wie er im Glossar steht, etwa ein Figuren- oder Markenname — siehe *Konstante Begriffe* unten.
* Ein Glossar hat zwei Tabs: **Begriffe** listet seine Begriffe, und **Treffer** listet die Einträge, die sie enthalten; dort kannst du das Glossar Einträgen zuweisen oder es entfernen.

Manche Glossare sind **schreibgeschützt** (global verwaltet) und liefern Begriffe, ohne hier bearbeitbar zu sein.

## Konstante Begriffe

* Ein konstanter Begriff wird **nie an die Übersetzungs-Engine geschickt**. NARN ersetzt ihn vor dem Übersetzen durch einen Platzhalter und setzt danach die Glossar-Übersetzung an seine Stelle, sodass ein Figurenname wie *Diluc* immer genau so herauskommt, wie er im Glossar steht.
* **Groß- und Kleinschreibung zählt.** Geschützt wird nur Text, der genau wie der Begriff geschrieben ist: *Razor* (die Figur) ja, *a razor* nicht. Jede andere Schreibweise geht als normaler Glossar-Hinweis an die Engine, als Name markiert, damit sie den Namen vom Alltagswort unterscheiden kann.
* **Die Engine kann das Wort nicht anpassen.** Da sie den Begriff nie sieht, kann sie ihn nicht beugen und keine anderen Wörter an ihn angleichen: In Sprachen wie Russisch, Koreanisch oder Türkisch steht ein konstanter Name immer in seiner Grundform. Nutze konstant für Namen und Codes, die unverändert bleiben müssen.
* Namen, die auch Alltagswörter sind, besser als normale Begriffe lassen, weil Titel und Beschriftungen sie oft großschreiben (*Gaming Settings*). Im mitgelieferten Glossar **Genshin Characters** sind alle Namen konstant außer Gaming, Amber, Razor, Sucrose und Prune.

## Import und Export

Begriffe aus **CSV** oder **TBX** importieren — eine Vorschau zeigt vor dem Anwenden, wie viele Begriffe hinzukommen, aktualisiert werden oder in Konflikt stehen. Das Glossar auch wieder nach **CSV** oder **TBX** exportieren.

## Mit KI generieren

* **Glossare generieren** durchsucht den Quelltext und schlägt Glossare aus wiederkehrenden Namen und eigenen Begriffen vor. Läuft im Hintergrund — im Tab **Aktivität** verfolgen und die Vorschläge prüfen, bevor sie erstellt werden. Vorhandene Glossare lassen sich als „bereits bekannt“ übergeben, damit das Modell sie nicht wiederholt.
* **Übersetzungen generieren** füllt Zielübersetzungen für Begriffe, denen sie noch fehlen.

## DeepL

Wird mit DeepL übersetzt, **An DeepL übertragen** verwenden, um Glossarbegriffe hochzuladen. Nach dem Bearbeiten eines übertragenen Glossars zeigt der Tab *Erneute Übertragung nötig* — erneut übertragen, um DeepL zu aktualisieren.

## Steuerung je Eintrag

Im Tab Übersetzungen lässt sich für einen einzelnen Eintrag wählen, welche Glossare **aktiviert** sind.
