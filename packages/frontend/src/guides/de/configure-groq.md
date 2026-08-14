# Groq-Modul

## Übersicht

Das **Groq**-Modul übersetzt mit [Groq](https://groq.com) — schnelle Inferenz für offene Modelle wie Llama, Qwen und GPT-OSS, mit einer kostenlosen Stufe, die sich für die tägliche Übersetzungsarbeit eignet. Es braucht einen Groq-API-Schlüssel, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `GROQ_API_KEY`.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **Groq** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `GROQ_API_KEY` auswählen, den eigenen Schlüssel als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

Zeigt eine Karte später *Tresor gesperrt*, vor dem Übersetzen auf **Tresor entsperren** klicken.

## Modell auswählen

Im Tab **Konfiguration** eines Projekts ein Modell aus dem aktuellen Groq-Katalog auswählen, oder die globale Vorgabe übernehmen. `llama-3.3-70b-versatile` ist eine solide Standardwahl für die Übersetzungsqualität; kleinere Modelle wie `llama-3.1-8b-instant` tauschen etwas Qualität gegen Geschwindigkeit. **Routing-Regeln** im Tab Routing entscheiden, welches Modul welche Sprache übernimmt.

## Groq-API-Schlüssel besorgen

1. [console.groq.com](https://console.groq.com) aufrufen.
2. Registrieren oder anmelden.
3. **API Keys** im Konsolenmenü öffnen.
4. Einen neuen API-Schlüssel erstellen und kopieren — er beginnt mit `gsk_`.
5. In den Wert von `GROQ_API_KEY` im Tresor-Editor einfügen.

Groqs kostenlose Stufe wendet Tageslimits pro Modell an (hier keine festen Zahlen — aktuelle Limits in der eigenen Konsole prüfen), und gemäß Groqs Nutzungsbedingungen werden API-Daten nicht zum Trainieren von Modellen verwendet. Sobald der Schlüssel hinzugefügt ist, bezieht **NARN Freeway** Groqs kostenlosen Plan automatisch mit ein, wenn die Übersetzungsarbeit auf die kostenlosen Kontingente der verbundenen Anbieter verteilt wird — ohne zusätzliche Einrichtung.
