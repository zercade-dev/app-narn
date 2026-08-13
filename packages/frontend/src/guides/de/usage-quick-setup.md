# Schnelleinstieg

## Übersicht

Der vollständige Weg für ein neues Projekt: Anbieter aktivieren, eigene Einträge importieren, Glossare und Routing konfigurieren, übersetzen und prüfen. Mit *(Optional)* markierte Schritte verbessern die Qualität, sind für eine erste Übersetzung aber nicht erforderlich — beim ersten Durchgang überspringen und später nachholen.

## 1. Anbieter aktivieren und Zugangsdaten speichern

1. **Globale Konfiguration** öffnen und für jeden gewünschten Anbieter (Anthropic, OpenAI, DeepL und so weiter) **ein Modul aktivieren**. Ein Modul kann mehrere **benannte Instanzen** haben — nützlich für zwei Konfigurationen desselben Anbieters mit unterschiedlichen Schlüsseln oder Standardwerten.
2. Zugangsdaten von Anbietern werden im verschlüsselten **Zugangsdaten-Tresor** gespeichert — beim ersten Gebrauch einrichten und einmal pro Sitzung entsperren. Wie das funktioniert, steht im Guide *Zugangsdaten-Tresor*.
3. Ein **Modell** (und optional **Reasoning-Aufwand**) je Modul oder Instanz wählen. Günstigere Modelle übersetzen schlechter — mit etwas Ausprobieren findet sich der eigene Sweet Spot. Beim **Reasoning-Aufwand** aufpassen — bei Thinking-Modellen kann er die Kosten schnell vervielfachen.

## 2. Das Projekt erstellen und Einträge importieren

Ein Projekt erstellen, seine **Quellsprache** festlegen, dann mit **CSV-Import** im Tab **Daten** die eigenen Quelltexteinträge laden (und alle Übersetzungen, die die Datei bereits enthält).

## 3. *(Optional)* Zuerst den eigenen Quelltext prüfen

**Quelltext-KI-Review** über die Quellsprache laufen lassen, bevor übersetzt wird — Tippfehler und unklare Formulierungen hier zu beheben, nützt jeder danach erstellten Übersetzung. Ändert eine Korrektur einen Eintrag, der bereits Übersetzungen hatte, landen die alten Übersetzungen im Tab **Waisen** — sie dort **neu verknüpfen**, optional mit erneuter Übersetzung.

## 4. *(Optional)* Glossare aktivieren

Im Tab **Glossar** die Glossare aktivieren, die für das eigene Projekt gelten. Die automatische Anwendung trifft Begriffe als **ganze Wörter, ohne Groß-/Kleinschreibung zu beachten** — flektierte Formen (Plural, Konjugationen) werden nicht erkannt. Wird mit **DeepL** übersetzt? Glossare mit **An DeepL übertragen** (oben rechts) übertragen und nach dem Bearbeiten erneut übertragen.

## 5. Routing einrichten

Den Tab **Routing** öffnen und den eigenen Anbieter in der Auswahl wählen, mit der er startet — das schickt jeden Eintrag im Projekt an ihn, mehr braucht eine Einzelanbieter-Einrichtung nicht. Werden unterschiedliche Anbieter je Sprache, Kategorie oder Eintragslänge gebraucht? Auf **Erweitert** umschalten und stattdessen dort **Routing-Regeln** hinzufügen. So oder so wird die eigene Wahl automatisch gespeichert. Dieser Schritt ist erforderlich: Ein Eintrag ohne passende Regel schlägt bei der Übersetzung mit einem Fehler „keine passende Route“ fehl.

## 6. *(Optional)* Glossare aus dem eigenen Inhalt aufbauen

Die eigenen Glossare vor einer Massenübersetzung wachsen lassen: Begriffe manuell hinzufügen, **Glossare generieren** über den gesamten Quelltext laufen lassen oder — gezielter — gute Kandidateneinträge im Tab **Übersetzungen** auswählen und **Glossar aus Auswahl generieren** verwenden (vorhandene Übersetzungen einbeziehen). Hier ein leistungsfähiges Modell verwenden; die Glossarqualität wirkt sich auf alles später Übersetzte aus.

## 7. *(Optional)* Qualität zuerst im Vergleich verfeinern

Vor einem vollständigen Übersetzungsdurchlauf den Tab **Vergleich** verwenden, um eine Sprache einzustellen, die sich selbst beurteilen lässt:

- Den **Kontext** jedes Eintrags (Figur, Tonfall, Notizen) und die Glossare verfeinern, bis die Übersetzung stimmig klingt. Kontext wird je Eintrag gespeichert, nicht je Sprache, die Arbeit überträgt sich also automatisch auf jede andere Sprache.
- Da hier Eintrag für Eintrag gearbeitet wird, reicht ein günstiges oder kostenloses Modell — zum Beispiel ein kostenloser Gemini-Schlüssel (siehe den Guide *Google AI (Gemini)*), als eigene **Modulinstanz** hinzugefügt, mit vorübergehend darauf gerichtetem Routing. Die kostenlose Stufe hat ein Tageslimit, gebündelte Anfragen sind also vorzuziehen.
- Zufrieden mit dem Ergebnis? Den vollständigen Stapel einmal mit denselben Einstellungen übersetzen, um zu bestätigen, dass es sich auch in großem Umfang bewährt.

## 8. Übersetzen

Zwei Wege, die eigentliche Übersetzung auszuführen:

- **Übersetzungen** — Einträge auswählen und **Auswahl übersetzen**, um jede Zielsprache auf einmal abzudecken.
- **Vergleich** — eine Sprache nach der anderen, optional mit einer bereits geprüften Sprache als **Referenz**-Kontext.

Für ein ganzes Projekt gewinnt meist eine Sprache nach der anderen mit einer geprüften Referenzsprache: Das anschließende KI-Review bleibt so auf eine einzige Sprache fokussiert. Den Fortschritt im Tab **Aktivität** verfolgen.

Die Bündelung erfolgt standardmäßig automatisch; bei einem kleinen Projekt mit vielen kurzen Einträgen kann eine benutzerdefinierte Batch-Größe von **0** (die gesamte Sprache in einer Anfrage) mit einem leistungsfähigen Modell besser funktionieren.

## 9. Den Durchlauf prüfen

Eine Option wählen:

- Ein **KI-Review** für den abgeschlossenen Durchlauf aus dem Tab **Aktivität** auslösen.
- Von Hand im **Manuellen Review** oder im **Vergleich** prüfen.
- Alles wie vorliegend freigeben und später prüfen.
