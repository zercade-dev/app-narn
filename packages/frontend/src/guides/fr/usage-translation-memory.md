# Mémoire de traduction

## Aperçu

La **Mémoire de traduction** (TM) est un stockage à l’échelle de l’espace de travail des traductions connues. Quand le texte source d’une entrée correspond à une traduction déjà en mémoire, la traduction stockée est réutilisée automatiquement au lieu d’appeler un module payant — ce qui fait gagner du temps et de l’argent, et garde le texte identique cohérent entre les projets. Ouvrez la vue **Mémoire de traduction** depuis la barre latérale pour parcourir et rechercher les segments stockés.

> **La mémoire de traduction est désactivée par défaut** pour chaque projet. Tant qu’elle est désactivée, rien de ce qu’un projet traduit n’est écrit en mémoire, et aucune traduction stockée n’est appliquée automatiquement. Pour l’activer, ouvrez l’onglet **Configuration** du projet et choisissez une politique de réutilisation dans la section **Mémoire de traduction** (n’importe quelle valeur autre que *Désactivée*).

## Comment les entrées entrent en mémoire

* **Approuver vers la mémoire** — dans l’onglet **Traductions**, sélectionnez des traductions et approuvez-les ; elles sont enregistrées comme segments fiables.
* Les traductions terminées sont aussi enregistrées, pour qu’un texte source identique puisse les réutiliser plus tard.

## Politique de réutilisation

La politique de réutilisation (dans l’onglet **Configuration** du projet, section **Mémoire de traduction**) contrôle *si* et *quand* une traduction stockée est réutilisée pour un texte source identique. Elle est réglée par défaut sur **Désactivée** (TM désactivée) ; d’autres choix — par exemple **Stricte (correspondance complète du contexte)**, qui ne réutilise que lorsque le contexte environnant correspond aussi — l’activent. Resserrer la politique évite de réutiliser une traduction correcte à un endroit mais pas à un autre.

## Contrôler la réutilisation par exécution

Quand vous démarrez une traduction depuis la boîte de dialogue *Traduire…* de l’onglet **Comparer**, un avis vous indique combien d’entrées seraient complétées depuis la mémoire, et vous pouvez **désactiver la mémoire pour cette exécution** pour forcer chaque entrée à être retraduite à neuf — utile quand vous voulez que le modèle reconsidère un texte déjà mémorisé.
