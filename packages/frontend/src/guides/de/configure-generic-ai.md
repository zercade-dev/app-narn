# Generic-AI-Modul

## Übersicht

Das **Generic-AI**-Modul verbindet sich mit jeder OpenAI-kompatiblen API — einem gehosteten Anbieter oder einem lokal laufenden Server (z. B. Ollama, LM Studio, vLLM). Sein Schlüssel liegt im Zugangsdaten-Tresor unter `GENERIC_API_KEY`.

**Der API-Schlüssel ist optional.** Er ist nur für Endpunkte relevant, die eine Authentifizierung verlangen (die meisten kostenpflichtigen Cloud-Anbieter). Ein lokaler Server wie Ollama oder LM Studio braucht keinen echten Schlüssel — der Tresor verlangt aber trotzdem, dass das Feld `GENERIC_API_KEY` nicht leer ist, also einen beliebigen Platzhalter speichern (z. B. `local`), um das zu erfüllen.

## Schlüssel im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **Generic AI** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `GENERIC_API_KEY` auswählen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken. Für einen kostenpflichtigen Endpunkt den echten API-Schlüssel als Wert einfügen. Für einen lokalen Server ohne Authentifizierung ist der Schlüssel optional — es reicht, einen beliebigen nicht leeren Platzhalter zu speichern (z. B. `local`).

## Mehrere Endpunkte mit Instanzen betreiben

Generic AI unterstützt **benannte Instanzen**, sodass sich mehrere Endpunkte (zum Beispiel ein Cloud-Anbieter und ein lokaler Server) nebeneinander registrieren lassen. Dafür **Weitere Generic AI-Instanz hinzufügen…** in der Globalen Konfiguration verwenden. Jede Instanz bekommt ihren eigenen abgeleiteten Tresor-Schlüssel — zum Beispiel `GENERIC_API_KEY__MY-OLLAMA` — der im selben Tresor-Editor eingetragen wird.

## Endpunkt und Modell wählen

Basis-URL und Modell für das Modul (oder jede Instanz) in dessen Einstellungen der Globalen Konfiguration festlegen, dann das Modell je Projekt im Tab **Konfiguration** auswählen. **Routing-Regeln** im Tab Routing entscheiden, welches Modul oder welche Instanz welche Sprache übernimmt.

## Zugangsdaten besorgen

Für einen **lokalen Server** (Ollama, LM Studio, vLLM) ist kein Konto und kein Schlüssel nötig — nur die Basis-URL (z. B. `http://localhost:11434/v1`) und ein Platzhalter im Feld `GENERIC_API_KEY`.

Für einen **kostenpflichtigen Anbieter** hängen die Schritte vom jeweiligen Anbieter ab: ein Konto anlegen, die API-Basis-URL und den Schlüssel beschaffen, und bestätigen, dass der Endpunkt das OpenAI-Chat-Completions-Format spricht, bevor der Schlüssel im Tresor eingetragen wird.
