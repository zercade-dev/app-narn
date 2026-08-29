# NARN Freeway

## Überblick

**NARN Freeway** ist ein gemeinsamer Pool von KI-Modellen aus kostenlosen Kontingenten, an den die App Arbeit automatisch verteilt — ohne Kreditkarte. Die Anbieterschlüssel bringen weiterhin Sie mit; was Freeway hinzufügt, ist die Buchhaltung. Es verfolgt, wie viel kostenloses Kontingent jeder Anbieter noch hat, wählt für jeden Stapel ein Modell und wechselt weiter, sobald eines rate-limitiert oder für den Tag aufgebraucht ist.

Richten Sie das Routing auf Freeway, und Sie wählen nie wieder ein Modell: Für Freeway-Arbeit gibt es weder Modell- noch Denkaufwand-Einstellung, weil die Wahl pro Stapel und pro Sprache aus dem getroffen wird, was der Pool gerade liefern kann.

## Einschalten

Ein frisches Projekt ohne Routing-Regeln bietet im Tab [Routing](guide:usage-routing) die Schaltfläche **NARN Freeway alles überlassen** — ein Klick legt eine Auffangregel an, die auf den Pool zeigt.

Ansonsten wählen Sie **NARN Freeway** wie jeden anderen Anbieter: in der einfachen Auswahl des Routing-Tabs, um das ganze Projekt dorthin zu schicken, oder als Modul einer einzelnen Regel unter **Erweitert**, um es für manche Sprachen zu nutzen und einen bezahlten Anbieter für andere.

Zwei Dinge müssen vorher stimmen: Mindestens ein kostenloser Anbieter braucht einen Schlüssel im [Tresor](guide:usage-vault), und der Tresor muss entsperrt sein — solange er gesperrt ist, erscheint jeder Freeway-Anbieter, als hätte er keinen Schlüssel.

## Welche Anbieter genutzt werden

Freeway greift auf die kostenlosen Kontingente der Anbieter zu, die Sie bereits als Module eingerichtet haben. Heute kann es nutzen:

* **Google AI (Gemini)** — das größte kostenlose Kontingent und die Quelle der meisten starken Modelle im Pool.
* **Groq** — schnell, mit einer großzügigen Tages-Anfragezahl.
* **OpenRouter** — die dort gehosteten kostenlosen Modelle.
* **DeepL** — das monatliche Zeichenkontingent des kostenlosen Tarifs, für klassische maschinelle Übersetzung.

<!-- local-only -->

* **GitHub Copilot** — falls Sie ein Copilot-Abo haben.

<!-- /local-only -->

Ein Anbieter ohne hinterlegten Schlüssel wird schlicht übersprungen. Jeder zusätzliche Schlüssel verbreitert den Pool und macht es unwahrscheinlicher, dass ein Lauf warten muss.

## Den Pool im Blick behalten

Das Panel **NARN Freeway** auf dem Konfigurationsbildschirm zeigt den ganzen Pool auf einen Blick: den Schlüsselstatus jedes Anbieters und pro Modell dessen **Zustand**, das **Verbleibend**e Kontingent, den **Nächsten Reset** und die jüngste **Bestehensquote** je Sprache.

Jeder Anbieter hat daneben außerdem eine Auswahlliste, die steuert, wie Freeway ihn nutzt: **Automatisch** lässt den Pool wie gewohnt wählen, eine benannte Instanz bindet Freeway an genau dieses Konto, und **Deaktiviert** nimmt den Anbieter ganz aus dem Pool — ohne das Modul selbst anderswo abzuschalten. Schalten Sie einen deaktivierten Anbieter wieder auf Automatisch (oder eine benannte Instanz), macht er genau dort weiter, wo er aufgehört hat.

Der Zustand eines Modells ist einer von:

* **Bereit** — jetzt nutzbar.
* **Cooldown** — kurz rate-limitiert; kommt von selbst zurück.
* **Für heute aufgebraucht** — das Tageskontingent ist verbraucht, und das Panel zeigt, wann es zurückgesetzt wird.
* **Modul deaktiviert** — der Schlüssel liegt vor, aber das Modul ist ausgeschaltet. Das Panel bietet an, es einzuschalten.
* **Für Freeway deaktiviert** — Sie haben diesen Anbieter über seine Auswahlliste für den Pool abgeschaltet; alles andere am Modul bleibt unberührt.
* **Kein Schlüssel** — für diesen Anbieter liegt noch nichts im Tresor.
* **Zugangsdaten ungültig** — der Schlüssel wurde abgelehnt. Legen Sie einen funktionierenden Schlüssel im Tresor ab, um die Markierung zu löschen.

## Wenn das kostenlose Kontingent ausgeht

Ein Lauf, der den Pool erschöpft, schlägt nicht fehl. Er geht auf **Wartet auf kostenloses Kontingent**, behält die noch offenen Paare und setzt sich von selbst fort, sobald das Kontingent eines Anbieters zurückgesetzt wird — Sie können ihn liegen lassen und später wiederkommen.

Wenn Sie nicht warten möchten, öffnen Sie den Lauf im Tab [Aktivität](guide:usage-activity) und nutzen Sie **Jetzt fortsetzen mit…**, um die restlichen Paare mit einem bezahlten Anbieter abzuschließen, oder **Kostenlosen Pool erneut versuchen**, um es sofort noch einmal mit dem Pool zu probieren.

## Qualitätsstufen — und nur nachbessern, was es braucht

Kostenlose Modelle sind nicht gleich gut, deshalb trägt jedes eine **Qualitätsstufe** von 1 bis 4, wobei 4 das stärkste ist. Jede Übersetzung merkt sich die Stufe des Modells, das sie erzeugt hat. Damit wird aus „erst mal alles kostenlos übersetzen“ ein brauchbarer erster Durchgang:

1. Übersetzen Sie das ganze Projekt kostenfrei über Freeway.
2. Filtern Sie im Tab **Übersetzungen** nach **Unter Stufe**, um zu sehen, was ein schwächeres Modell erledigt hat.
3. Wählen Sie diese Einträge aus und nutzen Sie **Unter Stufe neu übersetzen**, um genau sie mit einem besseren Anbieter zu wiederholen.

So zahlen Sie am Ende nur für die Einträge, bei denen es wirklich nötig war.

## Wo Freeway sonst noch wirkt

Freeway ist nicht nur fürs Übersetzen da. Es steht ebenso als Modul für **KI-Review**, **Quelltext-Review** sowie **Glossar-** und **Kategorie-Generierung** bereit — jeweils wählt es das beste kostenlose Modell für die Aufgabe und blendet Modell- und Denkaufwand-Einstellungen aus, weil es nichts zu wählen gibt. Siehe [KI-Review](guide:usage-ai-review), [Glossar](guide:usage-glossary) und [Kategorie](guide:usage-category).
