# Tab Qualität

## Übersicht

Der Tab **Qualität** ist ein Dashboard, das die LQA-Ergebnisse (Language Quality Assurance) zusammenfasst, die beim Übersetzen von Einträgen entstehen. Es zeigt die eigene Bestehensquote insgesamt und wo sich Beanstandungen häufen, damit sich Problemstellen schnell finden lassen. Es füllt sich beim Übersetzen — ist es leer, zuerst eine Übersetzung ausführen.

## Was es zeigt

* **Bestehensquote gesamt** über alle LQA-Ergebnisse und die davon erfassten Einträge.
* **Bestehensquote nach Sprache** — Qualität je Zielsprache.
* **Beanstandungen nach Herkunft** — Beanstandungstyp-Anzahl, gruppiert nach Herkunftslabel.
* **Qualität nach Modul** — Bestehensquote und Beanstandungen, gruppiert nach dem Modul, das die jeweilige Übersetzung erstellt hat.

## Vertiefen

Auf eine Zelle klicken, um zu den passenden Einträgen zu springen — das Dashboard filtert die Tabelle **Übersetzungen** auf die betroffenen Einträge, damit sie sich beheben lassen.

## Woher die Prüfungen kommen

Jede Übersetzung durchläuft das LQA-Gate, das die im Panel *LQA-Prüfungen* des Tabs **Konfiguration** aktivierten Prüfungen ausführt (Gleichheit der Inline-Tags, Längenlimit, Längenüberlauf, Glossartreue, verbotene Begriffe, Regex-Zusicherungen und weitere). **Blockierende** Prüfungen lassen die Übersetzung am Gate scheitern und können eine automatische Wiederholung auslösen; **Warnung**-Prüfungen werden hier gemeldet, ohne zu blockieren. Welche Prüfungen laufen und mit welchem Schweregrad, lässt sich in der Konfiguration anpassen.
