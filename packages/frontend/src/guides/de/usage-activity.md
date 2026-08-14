# Tab Aktivität

## Übersicht

Der Tab **Aktivität** ist die Schaltzentrale für Hintergrundaufgaben. Jede lang laufende Aufgabe erscheint hier: **Übersetzungs**-Durchläufe, **KI-Review** (Übersetzung und Quelltext), **Glossargenerierung** und **Kategoriegenerierung**. Durchläufe werden je Projekt in eine Warteschlange gestellt und nacheinander abgearbeitet, sodass sich mehrere davon aufreihen und beim Abarbeiten beobachten lassen.

## Einen Durchlauf lesen

Jeder Durchlauf zeigt seinen **Typ**, **Status** (In Warteschlange, Läuft, Pausiert, Abgeschlossen, Fehlgeschlagen oder Abgebrochen), den Fortschritt und geschätzte **Kosten**. Die Kosten sind vom Modul gemeldete Schätzwerte auf Basis des Preises je 1 Mio. Tokens des jeweiligen Modells, daher können Thinking-Modelle im Verhältnis zu den Zeichen hohe Token-Summen zeigen. Mit **Details anzeigen** lässt sich genau nachvollziehen, was ein Durchlauf übersetzt hat, welche Wiederholungen es gab und wie viele Zeichen bzw. Tokens verbraucht wurden. Die ID eines Durchlaufs lässt sich zur Referenz kopieren.

## Die Warteschlange verwalten

* Einen Durchlauf **pausieren** / **fortsetzen**, oder mit **Jetzt starten** einen wartenden Durchlauf vorziehen.
* Mit **In der Warteschlange nach oben rücken** / **nach unten rücken** die Reihenfolge ändern.
* Einen wartenden oder laufenden Durchlauf **abbrechen**.

## Wiederherstellen und prüfen

* Sind einzelne Einträge fehlgeschlagen, wiederholt **Fehlgeschlagene wiederholen** nur diese.
* Bei einem abgeschlossenen Übersetzungsdurchlauf lässt sich direkt aus dem Durchlauf heraus ein **KI-Review** starten — Modul und Modell auswählen (standardmäßig die der Übersetzung), dann die Urteile im Tab **Übersetzungs-KI-Review** öffnen.
