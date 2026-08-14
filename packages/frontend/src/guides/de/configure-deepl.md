# DeepL-Modul

## Übersicht

Das **DeepL**-Modul bietet professionelle neuronale maschinelle Übersetzung. Anders als die LLM-Module ist es klassische MT, und es kann Projektglossare an DeepL übertragen, um die Terminologie konsistent zu halten. Sein Schlüssel liegt im Zugangsdaten-Tresor unter `DEEPL_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **DeepL** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `DEEPL_API_KEY` auswählen, den eigenen Authentifizierungsschlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

DeepL unterstützt keine benannten Instanzen — es gibt nur ein einziges DeepL-Modul.

## Glossare verwenden

DeepL kann während der Übersetzung ein Glossar anwenden. Begriffe im Tab **Glossar** aufbauen und dann mit **An DeepL übertragen** hochladen. Ändert sich ein Glossar nach einer Übertragung, zeigt der Tab *Erneute Übertragung nötig* — erneut übertragen, um DeepL zu aktualisieren.

## DeepL-API-Schlüssel besorgen

1. [deepl.com/account](https://www.deepl.com/account) aufrufen.
2. Für ein kostenloses oder Pro-API-Konto registrieren.
3. **Account Settings** öffnen und den Bereich **API Key** suchen.
4. Den Authentifizierungsschlüssel kopieren.
5. In den Wert von `DEEPL_API_KEY` im Tresor-Editor einfügen.
