# Pseudo Test

## Übersicht

**Pseudo Test** ist keine echte Sprache. Es ist eine kostenlose Offline-QA-Sprache, die den eigenen Quelltext in eine absichtlich verunstaltete Version umschreibt, damit sich im Spiel erkennen lässt, welche Strings die Oberfläche sprengen — noch bevor eine einzige echte Übersetzung existiert.

Es kostet nichts, braucht keinen API-Schlüssel und sendet nie etwas an einen Anbieter.

## Was dabei entsteht

Aus `Save changes` wird etwas wie `⟦Şàvé çhàñgéş~~~~⟧`. Drei Dinge passieren gleichzeitig, und jedes davon deckt eine andere Fehlerklasse auf:

* **Akzentbuchstaben.** Jeder Buchstabe wird gegen ein optisch ähnliches Zeichen mit Akzent getauscht. Jeder Text, der im Spiel noch als reines Englisch erscheint, wurde nie in die String-Tabelle übernommen — er ist hartcodiert, und keine übersetzende Person wird ihn je erreichen können.
* **Polsterung.** Der Text wird mit `~`-Zeichen auf etwa das 1,4-Fache seiner ursprünglichen Länge gestreckt und simuliert damit Sprachen wie Deutsch, die lang ausfallen. Beschriftungen, die über ihre Schaltflächen hinauswachsen, schlecht umbrechen oder das Layout verschieben, fallen sofort auf.
* **Klammern.** Das Ergebnis wird in `⟦…⟧` eingeschlossen. Fehlt auf dem Bildschirm eine der beiden Klammern, wird dieser String abgeschnitten.

Platzhalter und Markup-Tags im eigenen Text bleiben unangetastet — kommt einer davon verunstaltet heraus, ist das ein Bug, der es wert ist, gemeldet zu werden, kein Layout-Problem.

## Verwendung

1. Im Tab **Daten** unter *Zielsprachen* **Pseudo Test** ankreuzen und speichern.
2. Eine Übersetzung wie gewohnt ausführen. Pseudo-Test-Einträge übernimmt immer der eingebaute Pseudo-Generator — es gibt nichts zu aktivieren, keine Routing-Regel zu schreiben und keine Kosten. Die kostenpflichtigen Anbieter bekommen diese Strings nie zu sehen.
3. Die echten Übersetzungen sind sicher: Der Pseudo-Test-Text liegt in seiner eigenen Spalte und kann nie eine andere Sprache überschreiben.

## In das eigene Spiel bringen

Im Export-Bereich **Pseudo-Text exportieren als** auf eine Sprache setzen, die aktuell nicht ausgeliefert wird — Deutsch, zum Beispiel —, dann die Datei herunterladen und im Spiel mit dieser gewählten Sprache laden. Die Spalte der gewählten Sprache wird nur für diesen einen Download mit dem Pseudo-Test-Text gefüllt; gespeichert ändert sich nichts, und die echten Übersetzungen sind beim nächsten Export noch da.

Ist das Testen abgeschlossen, erneut exportieren, mit der Ersetzung wieder auf **Keine Ersetzung** gesetzt. Ein normaler Export enthält nie eine Pseudo-Test-Spalte — der Pseudo-Text erreicht das eigene Spiel nur über die obige Ersetzung —, daher hat eingeschaltetes Pseudo Test keine Auswirkung auf die ausgelieferten Dateien.

## Wann es sich lohnt

Am besten früh einen Pseudo-Durchlauf ausführen, bevor irgendeine Übersetzung in Auftrag gegeben wird. Jeder Layout-Bug, den er findet, ist einer, der einmal behoben wird — statt fünfzehnmal, nachdem fünfzehn Sprachen eingetroffen sind.
