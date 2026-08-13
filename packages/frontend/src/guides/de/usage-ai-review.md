# KI-Review

## Übersicht

Über die automatischen LQA-Prüfungen hinaus kann die App ein KI-Modell zum Prüfen der Inhalte einsetzen. Es gibt zwei KI-Review-Tabs und eine manuelle Prüfwarteschlange. Jedes KI-Review braucht ein in der **Globalen Konfiguration** aktiviertes LLM-Modul und einen entsperrten Zugangsdaten-Tresor.

## Übersetzungs-KI-Review

Im Tab **Übersetzungs-KI-Review** bewertet ein KI-Richter abgeschlossene Übersetzungen nach **Genauigkeit, Sprachfluss, Terminologie und Tonfall**.

* Auf **Letzten Durchlauf bewerten** klicken, um den zuletzt abgeschlossenen Übersetzungsdurchlauf zu bewerten (oder ein Review aus einem bestimmten Durchlauf im Tab **Aktivität** starten).
* Die markierten Ergebnisse durchgehen; jedes Urteil zeigt den Quelltext, die Übersetzung, eine **Punktzahl** und oft einen **Vorschlag**.
* Einen Vorschlag **anwenden**, um die Übersetzung zu ersetzen, oder mit **Alle Vorschläge anwenden** alle auf einmal übernehmen. Eine Warnung erscheint, wenn ein Vorschlag Tags, Platzhalter oder Zeilenumbrüche verlieren würde.

## Quelltext-KI-Review

Der Tab **Quelltext-KI-Review** prüft den **Quelltext selbst** — er ist rein berichtend und ändert nie Übersetzungen.

1. Die auszuführenden Prüfungen wählen: **Tippfehler**, **Grammatik**, **Terminologie**, **Klarheit** und **bedenkliche** Inhalte.
2. **Modul** und **Modell** wählen, optional die **Antwortsprache** für die Befunde.
3. Auf **Review starten** klicken. Es läuft im Hintergrund — den Fortschritt im Tab **Aktivität** verfolgen.
4. Jeden Befund prüfen und **bestätigen** oder **ignorieren**; ein vorgeschlagener Quelltext lässt sich kopieren.

## Manuelles Review

Der Tab **Manuelles Review** ist eine menschliche Prüfwarteschlange. Übersetzungen, die als **zu prüfen** (oder **zurückgestellt**) markiert sind, erscheinen hier; dort lassen sie sich **freigeben**, **bearbeiten**, **zurückstellen**, **neu übersetzen** oder als Referenz eine **Rückübersetzung** in den Quelltext anfordern. Tastenkürzel beschleunigen die Arbeit: `↑`/`↓` zum Navigieren, `a` zum Freigeben, `e` zum Bearbeiten.
