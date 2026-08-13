# Translation Memory

## Übersicht

**Translation Memory** (TM) ist ein workspace-weiter Speicher bekannter Übersetzungen. Stimmt der Quelltext eines Strings mit einem bereits gespeicherten überein, wird die gespeicherte Übersetzung automatisch wiederverwendet, statt ein kostenpflichtiges Modul aufzurufen — das spart Zeit und Kosten und hält identischen Text projektübergreifend konsistent. Die Ansicht **Translation Memory** in der Seitenleiste öffnen, um gespeicherte Segmente zu durchsuchen und zu durchstöbern.

> **Translation Memory ist standardmäßig für jedes Projekt deaktiviert.** Solange es deaktiviert ist, wird nichts, was ein Projekt übersetzt, im Memory gespeichert, und keine gespeicherte Übersetzung wird automatisch angewendet. Zum Aktivieren im Tab **Konfiguration** des Projekts im Abschnitt **Translation Memory** eine Wiederverwendungsrichtlinie wählen (jeder Wert außer *Deaktiviert*).

## Wie Einträge ins Memory gelangen

* **Ins Translation Memory freigeben** — im Tab **Übersetzungen** Übersetzungen auswählen und freigeben; sie werden als vertrauenswürdige Segmente erfasst.
* Abgeschlossene Übersetzungen werden ebenfalls erfasst, damit sich identischer Quelltext später daraus bedienen kann.

## Wiederverwendungsrichtlinie

Die Wiederverwendungsrichtlinie (im Tab **Konfiguration** des Projekts, Abschnitt **Translation Memory**) steuert, *ob* und *wann* eine gespeicherte Übersetzung für identischen Quelltext wiederverwendet wird. Standardmäßig ist sie **Deaktiviert** (TM aus); andere Optionen — zum Beispiel **Streng (vollständige Kontextübereinstimmung)**, die nur wiederverwendet, wenn auch der umgebende Kontext übereinstimmt — schalten es ein. Eine strengere Richtlinie vermeidet, dass eine Übersetzung wiederverwendet wird, die an einer Stelle richtig war, an einer anderen aber nicht.

## Wiederverwendung je Durchlauf steuern

Wird eine Übersetzung über den Dialog *Übersetzen…* im Tab **Vergleich** gestartet, zeigt ein Hinweis, wie viele Einträge aus dem Memory gefüllt würden, und es lässt sich mit **Translation Memory für diesen Durchlauf deaktivieren** erzwingen, dass jeder Eintrag frisch übersetzt wird — nützlich, wenn das Modell zuvor gespeicherten Text neu überdenken soll.
