# Tab Routing

## Übersicht

Der Tab **Routing** entscheidet, welches Modul und Modell jeden Eintrag übernimmt. Er öffnet auf einer einfachen Anbieterauswahl: einen Anbieter wählen, und jeder Eintrag im Projekt geht an ihn. Mehr brauchen die meisten Projekte nicht.

Werden mehrere Ziele gebraucht? Den Tab auf **Erweitert** umschalten, und der vollständige Regel-Editor erscheint, in dem sich das Routing nach Zielsprache, Kategorie oder Eintragslänge unterscheiden lässt und sich mehrere benannte Regelgruppen führen lassen. Der Tab merkt sich, welcher der beiden zuletzt verwendet wurde. Ein Projekt, dessen Routing über einen einzigen Anbieter hinausgeht, zeigt immer den Editor, unabhängig vom gewählten Modus — eine bestehende Einrichtung wird nie verborgen.

So oder so entscheidet dieser Tab nur *wie* Einträge verteilt werden. Übersetzungen werden im Tab **Übersetzungen** oder **Vergleich** gestartet.

## Routing-Regeln

Regeln liegen in der Ansicht **Erweitert**. Sie werden in Prioritätsreihenfolge ausgewertet; die erste passende Regel gewinnt. Jede Regel kann prüfen auf:

* **Herkunft** — die Herkunftslabels importierter Einträge.
* **Längenlimit für Einträge** — nur auf Einträge bis zu einer bestimmten Zeichenzahl anwenden.
* **Zielsprache** und **Kategorien**.

Für passende Einträge legt die Regel das **Modul** (sowie optional eine **Modell**- und **Reasoning-Aufwand**-Überschreibung) sowie optionale Prompt-Hinweise fest (Figur, Tonfall, Geschlecht, Notizen). Regeln mit **Regel hinzufügen** ergänzen; jede Änderung wird automatisch gespeichert, es gibt also keinen **Speichern**-Button zu beachten. Mehrere benannte **Regelgruppen** lassen sich führen und wechseln (der Wechsel ist gesperrt, während ein Durchlauf läuft).

## Batch-Gruppierung

Der Tab Routing hat außerdem ein Steuerelement **Batch-Gruppierung** — denselben Projektstandard wie im Tab Konfiguration, mit einem passenden Schalter **Batch-Größenlimit ignorieren**. Das hält zusammengehörige Einträge über Übersetzungs-, Bewertungs- und Quelltext-Review-Durchläufe hinweg in derselben Anbieteranfrage.

## Eine Übersetzung starten

1. Einträge im Tab **Übersetzungen** oder **Vergleich** auswählen.
2. Von dort den Dialog **Übersetzen…** öffnen — er bietet Neu-Übersetzen, Translation Memory und Gruppierungsoptionen je Durchlauf an und startet dann den Durchlauf.
3. Fortschritt, Wiederholungen und Fehlschläge im Tab **Aktivität** verfolgen.
