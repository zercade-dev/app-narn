# Tab Waisen

## Übersicht

Der Tab **Waisen** listet Einträge auf, die in der zuletzt importierten CSV nicht mehr vorhanden sind. Sie tauchen meist nach einem erneuten Import auf, bei dem eine Zeile entfernt oder umbenannt wurde oder sich ihr Quelltext geändert hat — die alten Übersetzungen bleiben hier erhalten, damit keine Arbeit verloren geht.

## Was sich damit tun lässt

* Eine Waise **löschen**, um den Datensatz und seine Übersetzungen dauerhaft zu entfernen (das lässt sich nicht rückgängig machen).
* Eine Waise **neu verknüpfen**, um ihre Übersetzungen auf einen anderen Eintrag zu übertragen. Nach dem Ziel wird anhand des Quelltexts gesucht; vorhandene Übersetzungen am Ziel bleiben erhalten, nur seine leeren Sprachen werden gefüllt.
* Mehrere Waisen auswählen und in Bulk **löschen**, oder die Liste **aktualisieren**.

## Ablauf

1. Die eigene Quell-CSV im Tab **Konfiguration** erneut importieren.
2. **Waisen** öffnen und durchsehen, was weggefallen ist.
3. Jeden Eintrag, dessen ID oder Quelltext sich geändert hat, dessen Übersetzungen aber noch gültig sind, **neu verknüpfen**.
4. Einträge, die wirklich verschwunden sind, **löschen**.

Ist die Liste leer, stimmt jeder importierte Eintrag mit dem aktuellen Projekt überein — nichts ist verwaist.
