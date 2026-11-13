# Schnelleinstieg

## Übersicht

Neu bei NARN? Der kurze Weg unten führt in fünf Schritten von null zu einer exportierten Übersetzung. Die geführte Einrichtung in der App begleitet dich durch dieselben Schritte; du kannst sie überspringen und später fortsetzen — **Einrichtung fortsetzen** in der Seitenleiste macht dort weiter, wo du aufgehört hast, und über diesen Guide lässt sie sich neu starten. Alles nach dem kurzen Weg ist für den Fall, dass du mehr Kontrolle willst.

## Der kurze Weg

1. **Tresor-Passwort erstellen.** Deine Anbieter-Schlüssel werden damit verschlüsselt — siehe den Guide [Zugangsdaten-Tresor](guide:usage-vault). In der Cloud-Version erfolgen die Schritte 1 und 2 gemeinsam auf der Tresor-Seite.
2. **Einen kostenlosen Schlüssel hinzufügen.** Ein Google-AI-Schlüssel ist der einfachste Einstieg — unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey) erhältlich, oder **Eigenen Anbieter verwenden** wählen. [NARN Freeway](guide:usage-freeway) wählt dann kostenlose Modelle für dich aus.
3. **Projekt erstellen und Text importieren.** Ein Projekt erstellen, dann im Tab **Daten** die Quellsprache und die Zielsprachen wählen und **CSV-Import** verwenden.
4. **Übersetzen.** Unter **Übersetzungen** alle Einträge auswählen und **Übersetzen** klicken. NARN Freeway wählt kostenlose Modelle für dich aus; den Fortschritt im Tab **Aktivität** verfolgen.
5. **Exportieren.** Die übersetzte Datei aus dem Projekt herunterladen.

Neue Nutzer starten im **einfachen Modus**, der nur Konfiguration, Daten, Übersetzungen und Aktivität zeigt (dazu Guide, Einstellungen und **Anbieter-Schlüssel**). Über die obere Leiste oder die Einstellungen lässt sich jederzeit zwischen **Einfach** und **Erweitert** wechseln.

## Wenn du mehr willst

Diese Schritte gehören zum **erweiterten Modus** und verbessern die Qualität oder geben dir feinere Kontrolle. Mit *(Optional)* markierte Schritte sind für eine erste Übersetzung nicht nötig — überspringen und später nachholen. Beim ersten Öffnen von Routing, Glossar, Qualität, Vergleich oder Übersetzungs-KI-Review im erweiterten Modus wird eine kurze Tour angeboten; jede Tour lässt sich aus diesem Guide erneut starten, die Angebote lassen sich in den Einstellungen abschalten.

## Weitere Anbieter und Zugangsdaten

1. **Globale Konfiguration** öffnen und für jeden gewünschten Anbieter (Anthropic, OpenAI, DeepL und so weiter) **ein Modul aktivieren**, und zwar über die Liste **Modul aktivieren** — DeepL steht dort namentlich, die KI-Anbieter erscheinen als **Weitere …-Instanz hinzufügen…**, was die erste Instanz des Anbieters anlegt. Ein Modul kann mehrere **benannte Instanzen** haben — nützlich für zwei Konfigurationen desselben Anbieters mit unterschiedlichen Schlüsseln oder Standardwerten.
2. Zugangsdaten von Anbietern werden im verschlüsselten **Zugangsdaten-Tresor** gespeichert — beim ersten Gebrauch einrichten und einmal pro Sitzung entsperren. Wie das funktioniert, steht im Guide *Zugangsdaten-Tresor*.
3. Ein **Modell** (und optional **Reasoning-Aufwand**) je Modul oder Instanz wählen. Günstigere Modelle übersetzen schlechter — mit etwas Ausprobieren findet sich der eigene Sweet Spot. Beim **Reasoning-Aufwand** aufpassen — bei Thinking-Modellen kann er die Kosten schnell vervielfachen.

## *(Optional)* Zuerst den eigenen Quelltext prüfen

**Quelltext-KI-Review** über die Quellsprache laufen lassen, bevor übersetzt wird — Tippfehler und unklare Formulierungen hier zu beheben, nützt jeder danach erstellten Übersetzung. Ändert eine Korrektur einen Eintrag, der bereits Übersetzungen hatte, landen die alten Übersetzungen im Tab **Waisen** — sie dort **neu verknüpfen**, optional mit erneuter Übersetzung.

## *(Optional)* Glossare aktivieren

Im Tab **Glossar** die Glossare aktivieren, die für das eigene Projekt gelten. Die automatische Anwendung trifft Begriffe als **ganze Wörter, ohne Groß-/Kleinschreibung zu beachten** — flektierte Formen (Plural, Konjugationen) werden nicht erkannt. Wird mit **DeepL** übersetzt? Glossare mit **An DeepL übertragen** (oben rechts) übertragen und nach dem Bearbeiten erneut übertragen.

## Routing einrichten

Den Tab **Routing** öffnen und den eigenen Anbieter in der Auswahl wählen, mit der er startet — das schickt jeden Eintrag im Projekt an ihn, mehr braucht eine Einzelanbieter-Einrichtung nicht. Werden unterschiedliche Anbieter je Sprache, Kategorie oder Eintragslänge gebraucht? Auf **Erweitert** umschalten und stattdessen dort **Routing-Regeln** hinzufügen. So oder so wird die eigene Wahl automatisch gespeichert. Ein Projekt ganz ohne Regeln schickt alles über NARN Freeway, dieser Schritt ist also zunächst optional. Sobald ein Projekt Regeln hat, schlägt ein Eintrag, auf den keine davon passt, bei der Übersetzung mit einem Fehler „keine passende Route“ fehl.

## *(Optional)* Glossare aus dem eigenen Inhalt aufbauen

Die eigenen Glossare vor einer Massenübersetzung wachsen lassen: Begriffe manuell hinzufügen, **Glossare generieren** über den gesamten Quelltext laufen lassen oder — gezielter — gute Kandidateneinträge im Tab **Übersetzungen** auswählen und **Glossar aus Auswahl generieren** verwenden (vorhandene Übersetzungen einbeziehen). Hier ein leistungsfähiges Modell verwenden; die Glossarqualität wirkt sich auf alles später Übersetzte aus.

## *(Optional)* Qualität zuerst im Vergleich verfeinern

Vor einem vollständigen Übersetzungsdurchlauf den Tab **Vergleich** verwenden, um eine Sprache einzustellen, die sich selbst beurteilen lässt:

- Den **Kontext** jedes Eintrags (Figur, Tonfall, Notizen) und die Glossare verfeinern, bis die Übersetzung stimmig klingt. Kontext wird je Eintrag gespeichert, nicht je Sprache, die Arbeit überträgt sich also automatisch auf jede andere Sprache.
- Da hier Eintrag für Eintrag gearbeitet wird, reicht ein günstiges oder kostenloses Modell — zum Beispiel ein kostenloser Gemini-Schlüssel (siehe den Guide *Google AI (Gemini)*), als eigene **Modulinstanz** hinzugefügt, mit vorübergehend darauf gerichtetem Routing. Die kostenlose Stufe hat ein Tageslimit, gebündelte Anfragen sind also vorzuziehen.
- Zufrieden mit dem Ergebnis? Den vollständigen Stapel einmal mit denselben Einstellungen übersetzen, um zu bestätigen, dass es sich auch in großem Umfang bewährt.

## Im großen Stil übersetzen

Zwei Wege, die eigentliche Übersetzung auszuführen:

- **Übersetzungen** — Einträge auswählen und **Auswahl übersetzen**, um jede Zielsprache auf einmal abzudecken.
- **Vergleich** — eine Sprache nach der anderen, optional mit einer bereits geprüften Sprache als **Referenz**-Kontext.

Für ein ganzes Projekt gewinnt meist eine Sprache nach der anderen mit einer geprüften Referenzsprache: Das anschließende KI-Review bleibt so auf eine einzige Sprache fokussiert. Den Fortschritt im Tab **Aktivität** verfolgen.

Die Bündelung erfolgt standardmäßig automatisch; bei einem kleinen Projekt mit vielen kurzen Einträgen kann eine benutzerdefinierte Batch-Größe von **0** (die gesamte Sprache in einer Anfrage) mit einem leistungsfähigen Modell besser funktionieren.

## Den Durchlauf prüfen

Eine Option wählen:

- Ein **KI-Review** für den abgeschlossenen Durchlauf aus dem Tab **Aktivität** auslösen.
- Von Hand im **Manuellen Review** oder im **Vergleich** prüfen.
- Alles wie vorliegend freigeben und später prüfen.
