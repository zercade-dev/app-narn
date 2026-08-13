# OpenRouter-Modul

## Übersicht

Das **OpenRouter**-Modul übersetzt mit [OpenRouter](https://openrouter.ai) — einer einzigen API, die zu Modellen vieler Anbieter weiterleitet (Anthropic, OpenAI, Google, Meta und weitere). Es braucht einen OpenRouter-API-Schlüssel, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `OPENROUTER_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **OpenRouter** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `OPENROUTER_API_KEY` auswählen, den eigenen Schlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

Zeigt eine Karte später *Tresor gesperrt*, vor dem Übersetzen auf **Tresor entsperren** klicken.

## Modell auswählen

Im Tab **Konfiguration** eines Projekts ein Modell aus dem aktuellen OpenRouter-Katalog auswählen — jeder Eintrag zeigt seinen Preis je Token und seine Kontextlänge, und es werden nur Textgenerierungsmodelle aufgeführt. Modell-IDs sind anbieterpräfigiert (zum Beispiel `anthropic/claude-sonnet-4.5` oder `openai/gpt-4o-mini`); ein neuer Slug lässt sich auch direkt eingeben. **Routing-Regeln** im Tab Routing entscheiden, welches Modul welche Sprache übernimmt.

## OpenRouter-API-Schlüssel besorgen

1. [openrouter.ai](https://openrouter.ai) aufrufen.
2. Registrieren oder anmelden.
3. **Keys** im Kontomenü öffnen.
4. Einen neuen API-Schlüssel erstellen und kopieren.
5. In den Wert von `OPENROUTER_API_KEY` im Tresor-Editor einfügen.

Hinweis: Der eigene Text wird an OpenRouter gesendet und von dort an den Anbieter des gewählten Modells weitergeleitet, gemäß den Nutzungsbedingungen von OpenRouter und der Datenrichtlinie dieses Anbieters.
