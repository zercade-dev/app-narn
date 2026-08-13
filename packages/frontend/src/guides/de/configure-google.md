# Google-AI-Modul (Gemini)

## Übersicht

Das **Google-AI**-Modul übersetzt mit den Gemini-Modellen von Google. Es braucht einen Google-AI-Studio-API-Schlüssel, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `GOOGLE_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **Google AI (Gemini)** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `GOOGLE_API_KEY` auswählen, den eigenen Schlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

Zeigt eine Karte später *Tresor gesperrt*, vor dem Übersetzen auf **Tresor entsperren** klicken.

## Modell auswählen

Im Tab **Konfiguration** eines Projekts ein Gemini-Modell (und optional einen Reasoning-Aufwand) auswählen, oder den globalen Standardwert übernehmen lassen. **Routing-Regeln** im Tab Routing entscheiden, welches Modul welche Sprache übernimmt. Thinking-Modelle melden im Verhältnis zu den Zeichen hohe Token-Zahlen, wodurch Kostenschätzungen hoch wirken können.

## Google-API-Schlüssel besorgen

1. [ai.google.dev](https://ai.google.dev) aufrufen und auf **Get API key** klicken, oder direkt zu [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) gehen.
2. Auf **Create API key** klicken und das eigene Projekt auswählen.
3. Den erzeugten Schlüssel kopieren.
4. In den Wert von `GOOGLE_API_KEY` im Tresor-Editor einfügen.
