# DeepSeek-Modul

## Übersicht

Das **DeepSeek**-Modul übersetzt mit der DeepSeek-API. Es braucht einen DeepSeek-API-Schlüssel, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `DEEPSEEK_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **DeepSeek** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `DEEPSEEK_API_KEY` auswählen, den eigenen Schlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

Zeigt eine Karte später *Tresor gesperrt*, vor dem Übersetzen auf **Tresor entsperren** klicken.

## Modell auswählen

Im Tab **Konfiguration** eines Projekts ein DeepSeek-Modell (und optional einen Reasoning-Aufwand) auswählen, oder den globalen Standardwert übernehmen lassen. **Routing-Regeln** im Tab Routing entscheiden, welches Modul welche Sprache übernimmt.

## DeepSeek-API-Schlüssel besorgen

1. [platform.deepseek.com](https://platform.deepseek.com) aufrufen.
2. Registrieren oder anmelden.
3. Den Bereich **API keys** öffnen.
4. Einen neuen API-Schlüssel erstellen und kopieren.
5. In den Wert von `DEEPSEEK_API_KEY` im Tresor-Editor einfügen.
