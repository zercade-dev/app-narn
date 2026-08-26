# Fragen & Antworten

## Überblick

Kurze Antworten auf die Fragen, die am häufigsten aufkommen — jeweils mit einem Verweis auf den Guide, der das Thema ausführlich behandelt. Diese Liste wächst mit den Fragen, die eintreffen; steht Ihre noch nicht dabei, geht die Themenliste links deutlich mehr ins Detail.

## Was übersetzt wird

### Welche Einträge übersetzt ein Lauf, und welche überspringt er?

Nur die, die es noch brauchen. Für jeden Eintrag und jede ausgewählte Zielsprache übersetzt der Lauf dieses Paar, wenn es noch keine Übersetzung hat — oder wenn Sie ausdrücklich **neu übersetzen** wollten. Ein Paar, das bereits Text hat, bleibt unangetastet. Ein erneuter Lauf überschreibt also nie Arbeit, die Sie schon erledigt oder geprüft haben.

Ein Eintrag — oder ein einzelnes Eintrag-Sprache-Paar — bleibt außen vor, sobald eines davon zutrifft:

* **Er ist bereits übersetzt**, und Sie haben kein Neuübersetzen verlangt.
* **Sie haben ihn als Ignoriert markiert.** Das nimmt ihn aus *allen* KI-Vorgängen heraus — Übersetzung, KI-Review, Quelltext-Review sowie Glossar- und Kategorie-Generierung. Ignorierte Einträge bleiben mit einem Abzeichen in der Tabelle sichtbar; die Entscheidung ist damit immer sichtbar und immer umkehrbar.
* **Er ist verwaist** — er fehlte in Ihrem letzten CSV-Import und wartet im Tab [Waisen](guide:usage-orphans).
* **Er wurde mit `Übersetzen? = FALSE` importiert.**
* **Das Ziel ist die Ausgangssprache.** Ein Eintrag wird nie in seine eigene Ausgangssprache übersetzt, auch wenn Sie diese als Ziel auswählen.
* **Es gibt nichts zu übersetzen.** Leerer Text, eine Zahl wie `3.14` oder `100%`, eine Hex-Farbe wie `#ff8800` oder eine Zeichenkette, die nur aus Tags und Platzhaltern besteht wie `<b>{count}</b>`, wird unverändert durchgereicht, ohne einen Anbieter aufzurufen.

Ein Eintrag, der aus dem [Translation Memory](guide:usage-translation-memory) gefüllt wird, erreicht ebenfalls nie einen Anbieter — stattdessen wird die gespeicherte Übersetzung wiederverwendet. Er zählt trotzdem als übersetzt.

### Kann ich etwas neu übersetzen, das bereits übersetzt ist?

Ja, aber Sie müssen es verlangen, denn Läufe überspringen fertige Paare standardmäßig. Setzen Sie im Dialog *Übersetzen…* das Häkchen bei **neu übersetzen** für einen Stapel, oder nutzen Sie **Neu übersetzen** in einer einzelnen Zeile im Tab [Vergleich](guide:usage-compare) oder in der manuellen Review-Warteschlange.

### Warum kam ein Eintrag mit unverändertem Ausgangstext zurück?

Fast immer, weil es nichts zu übersetzen gab — der letzte Punkt der Liste oben. Zahlen, Farben und reines Markup werden erkannt und unverändert durchgereicht, weil ein Modell sie nur wiederholen oder beschädigen kann. Für diese Einträge wurde nichts an einen Anbieter geschickt und nichts berechnet.

## Anbieter, Modelle und Routing

### Wie ändere ich das Modell, das für Übersetzungen genutzt wird?

Es gibt drei Ebenen; welche Sie brauchen, hängt davon ab, wie weit die Änderung reichen soll:

1. **Für einen Anbieter überall** — öffnen Sie die **Globale Konfiguration**, suchen Sie das Modul und wählen Sie dort sein **Modell**. Jedes Projekt auf *Aus globaler Konfiguration übernehmen* folgt dem.
2. **Für ein Projekt** — öffnen Sie den Tab [Konfiguration](guide:usage-config) dieses Projekts und setzen Sie **Modell** (und **Denkaufwand**) für das Modul, statt zu erben.
3. **Nur für bestimmte Einträge** — öffnen Sie den Tab [Routing](guide:usage-routing), wechseln Sie auf **Erweitert** und setzen Sie ein **abweichendes Modell** an einer Routing-Regel. Nur Einträge, auf die diese Regel passt, nutzen es.

Die einfache Ansicht des Routing-Tabs wählt einen **Anbieter**, kein Modell: Sie führt bewusst das Modell aus, mit dem dieses Modul ohnehin konfiguriert ist.

### Können verschiedene Sprachen verschiedene Anbieter nutzen?

Ja. Stellen Sie den Tab [Routing](guide:usage-routing) auf **Erweitert** und legen Sie eine Regel pro Sprache an — oder pro Kategorie oder Eintragslänge. Regeln werden in Prioritätsreihenfolge geprüft, und die erste passende gewinnt. Wenn Sie lieber gar nicht wählen: Richten Sie eine einzige Regel auf [NARN Freeway](guide:usage-freeway) und lassen Sie es für jeden Stapel ein kostenloses Modell aussuchen.

### Die Übersetzung startet nicht und meldet, es gebe keine passende Routing-Regel. Was nun?

Ein Lauf startet erst, wenn jede beteiligte Sprache ein Ziel hat. Passt auf eine Zielsprache keine Regel, wird der Lauf abgelehnt, bevor irgendetwas gesendet wird, und die Meldung nennt die Sprache. Öffnen Sie den Tab [Routing](guide:usage-routing) und legen Sie eine Regel an, die sie abdeckt — die einfache Anbieterauswahl deckt alle Sprachen auf einmal ab — und starten Sie erneut.

## Läufe, Fehler und Wiederherstellung

### Einige Strings sind fehlgeschlagen. Muss ich alles neu laufen lassen?

Nein. Nutzen Sie **Fehlgeschlagene wiederholen** am Lauf im Tab [Aktivität](guide:usage-activity): Damit laufen nur die Eintrag-Sprache-Paare erneut, die einen Fehler hatten — alles Erfolgreiche bleibt unangetastet.

### Warum muss ich den Tresor erneut entsperren?

Der [Tresor](guide:usage-vault) wird pro Sitzung entsperrt, nicht dauerhaft, und er sperrt sich zudem nach einer Weile ohne Aktivität von selbst wieder. Entsperren Sie ihn und machen Sie weiter. Lief beim Sperren gerade ein Lauf, nutzen Sie danach **Fehlgeschlagene wiederholen** an diesem Lauf.

### Ich habe meine CSV neu importiert und einige Übersetzungen sind verschwunden. Sind sie weg?

Nein. Enthält ein erneuter Import einen Eintrag nicht mehr, bleiben seine Übersetzungen im Tab [Waisen](guide:usage-orphans) erhalten, statt gelöscht zu werden. **Neu verknüpfen** verschiebt sie auf den Eintrag, der ihn ersetzt hat; dabei werden nur leere Sprachen des Ziels gefüllt, es wird also nichts überschrieben. Zusätzlich wird direkt vor jedem Import automatisch ein Snapshot angelegt, sodass Sie das ganze Projekt über den Tab [Backup](guide:usage-backup) zurückrollen können.
