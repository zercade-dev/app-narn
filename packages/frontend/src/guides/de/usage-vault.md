# Zugangsdaten-Tresor

## Übersicht

API-Schlüssel von Anbietern werden nie in einfachen Konfigurationsdateien oder Umgebungsvariablen aufbewahrt. Sie liegen im **Zugangsdaten-Tresor** — einem verschlüsselten Speicher, der entsperrt werden muss, bevor eine Übersetzung oder ein KI-Review eine Zugangsdaten verwenden kann. Der Tresor wird einmal pro Browsersitzung entsperrt; Zugangsdaten werden nur im Arbeitsspeicher entschlüsselt.

<!-- local-only -->
## Passwort-Tresor (selbst gehostet)

Bei einer selbst gehosteten Installation ist der Tresor eine verschlüsselte lokale Datei. Das erste Entsperren legt sie an: Das gewählte Passwort wird zum Tresor-Passwort, und jede gespeicherte Zugangsdaten verschlüsselt die Datei neu. Das Passwort selbst wird nirgends gespeichert — ohne es lässt sich die Datei nicht entschlüsseln. Entsperren über **Globale Konfiguration** oder über jede Karte mit *Tresor gesperrt*.
<!-- /local-only -->

## Gerätegebundener Tresor (Cloud)

In der Cloud-Version ist der Tresor **verschlüsselt auf dem Server** gespeichert, und das Entschlüsseln braucht zwei Faktoren:

- Das eigene **Passwort** — nirgends gespeichert, weder auf dem Server noch auf dem Gerät.
- Einen **gerätegebundenen Schlüssel** — im Browser erzeugt, wenn ein Gerät registriert wird, und nur auf diesem Gerät aufbewahrt.

Beim Entsperren reisen beide Faktoren über die verschlüsselte Verbindung und werden serverseitig kombiniert, um den Entschlüsselungsschlüssel **nur im Arbeitsspeicher, nur für diese Sitzung** abzuleiten. Weder die Faktoren noch der abgeleitete Schlüssel werden je in den Serverspeicher geschrieben — gespeichert wird nur der verschlüsselte Tresor selbst. Serverseitig gespeicherte Daten allein können die eigenen Zugangsdaten also nicht preisgeben, und ein durchgesickertes Passwort allein reicht ebenfalls nicht: Zum Entsperren wird außerdem eines der registrierten Geräte gebraucht.

Zeigt die Globale Konfiguration einen Button **Zur Tresor-Seite wechseln** statt einer Passwortabfrage, läuft der gerätegebundene Tresor — die Tresor-Seite übernimmt Einrichtung, Geräteregistrierung, Entsperren, das Bearbeiten von Zugangsdaten und Passwortänderungen.

## Gut zu wissen

- Ein noch nie verwendetes Gerät muss zuerst auf der Tresor-Seite **registriert** werden, bevor es entsperren kann.
- Geht das Passwort verloren (oder, in der Cloud, jedes registrierte Gerät), lässt sich der Tresorinhalt nicht wiederherstellen — der Tresor muss neu eingerichtet und die Anbieter-Schlüssel müssen erneut eingegeben werden.
- Alles, was die App protokolliert, durchläuft eine Schwärzung, sodass Zugangsdaten-Werte nie in Logs erscheinen.
