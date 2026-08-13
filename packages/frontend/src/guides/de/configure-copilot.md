# GitHub-Copilot-Modul

## Übersicht

Das **Copilot**-Modul übersetzt über GitHub Copilot. Es meldet sich mit einem GitHub-Token eines Kontos mit **aktivem Copilot-Abo** an, gespeichert im Zugangsdaten-Tresor unter dem Schlüssel `GITHUB_TOKEN`.

## Token im Zugangsdaten-Tresor speichern

Zugangsdaten von Anbietern liegen in einem verschlüsselten **Zugangsdaten-Tresor**, nicht in einfachen Konfigurationsdateien. Der Tresor wird einmal pro Sitzung mit einem Passwort entsperrt.

1. **Globale Konfiguration** in der Seitenleiste öffnen.
2. Falls der Tresor noch nicht eingerichtet ist: einrichten — ein Tresor-Passwort wählen (das du in jeder Sitzung wiederverwendest) und entsperren.
3. Unter **Modul aktivieren** **GitHub Copilot** auswählen. Fehlt ein erforderlicher Schlüssel, öffnet sich der Tresor-Editor automatisch beim richtigen Schlüssel — andernfalls auf **Zugangsdaten-Tresor verwalten** klicken.
4. Im Tresor-Editor eine Zugangsdaten hinzufügen: den Schlüssel `GITHUB_TOKEN` auswählen, das eigene Token als Wert einfügen, das **Tresor-Passwort** eingeben und auf **Speichern** klicken.

Zeigt die Modellliste *Keine Modelle verfügbar*, fehlt das Token, ist es ungültig, oder der Tresor ist gesperrt — den Tresor entsperren oder das GitHub-Token prüfen und die Karte neu öffnen.

## GitHub-Token besorgen

Ein **fein abgestuftes** (fine-grained) persönliches Zugriffstoken verwenden, damit es nur Copilot-Zugriff gewährt und sonst nichts.

1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) aufrufen.
2. Auf **Generate new token** klicken (fein abgestufte Tokens sind die Voreinstellung).
3. Einen Namen vergeben (z. B. „Translator-Copilot“) und ein **Expiration** setzen.
4. Unter **Permissions → Account permissions** **Copilot Requests** suchen und auf **Read-only** setzen. Weitere Berechtigungen sind nicht nötig.
5. Auf **Generate token** klicken und den Token sofort kopieren — GitHub zeigt ihn nur einmal an.
6. In den Wert von `GITHUB_TOKEN` im Tresor-Editor einfügen.

Das Konto hinter dem Token braucht ein aktives Copilot-Abo, damit Übersetzungen gelingen.
