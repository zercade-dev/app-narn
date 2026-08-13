# Anthropic-Modul (Claude)

## Übersicht

Das **Claude**-Modul übersetzt mit den Claude-Modellen von Anthropic. Es braucht einen Anthropic-API-Schlüssel, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `ANTHROPIC_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **Anthropic (Claude)** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `ANTHROPIC_API_KEY` auswählen, den eigenen Schlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken. Beim Speichern wird der Tresor neu verschlüsselt.

Zeigt eine Karte später *Tresor gesperrt*, vor dem Übersetzen auf **Tresor entsperren** klicken.

## Modell auswählen

Im Tab **Konfiguration** eines Projekts ein Claude-Modell (und optional einen Reasoning-Aufwand) auswählen, oder den globalen Standardwert übernehmen lassen. **Routing-Regeln** im Tab Routing entscheiden, welches Modul welche Sprache übernimmt.

## Anthropic-API-Schlüssel besorgen

1. [console.anthropic.com](https://console.anthropic.com) aufrufen.
2. Registrieren oder anmelden.
3. Den Bereich **API keys** öffnen.
4. Auf **Create Key** klicken und den Schlüssel kopieren.
5. In den Wert von `ANTHROPIC_API_KEY` im Tresor-Editor einfügen.
