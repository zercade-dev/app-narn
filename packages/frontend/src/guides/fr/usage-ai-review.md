# Révision par IA

## Aperçu

Au-delà des contrôles LQA automatiques, l’application peut faire appel à un modèle d’IA pour réviser votre contenu. Il existe deux onglets de révision par IA plus une file de révision manuelle. Toute révision par IA nécessite un module LLM activé dans **Configuration globale** et le coffre de credentials déverrouillé.

## Révision IA de traduction

L’onglet **Révision IA de traduction** fait noter les traductions terminées par une IA évaluatrice, sur l’**exactitude, la fluidité, la terminologie et le ton**.

* Cliquez sur **Réviser la dernière exécution** pour évaluer la dernière exécution de traduction terminée (ou lancez une révision depuis une exécution précise dans l’onglet **Activité**).
* Parcourez les résultats signalés ; chaque verdict affiche la source, la traduction, un **score**, et souvent une **suggestion**.
* **Appliquer** une suggestion pour remplacer la traduction, ou **Appliquer toutes les suggestions** pour toutes les appliquer en une seule fois. Un avertissement apparaît si une suggestion risque de supprimer des balises, des espaces réservés ou des sauts de ligne.

## Révision IA de la source

L’onglet **Révision IA de la source** vérifie le **texte source lui-même** — elle est indicative uniquement et ne modifie jamais les traductions.

1. Choisissez les vérifications à lancer : **faute de frappe**, **grammaire**, **terminologie**, **clarté** et contenu **non sûr**.
2. Choisissez le **module** et le **modèle**, ainsi que, en option, la **langue de réponse** pour les constats.
3. Cliquez sur **Lancer la révision**. Elle s’exécute en arrière-plan — suivez sa progression dans l’onglet **Activité**.
4. Passez en revue chaque constat et cliquez sur **Approuver** ou **Ignorer** ; une réécriture suggérée de la source peut être copiée.

## Révision manuelle

L’onglet **Révision manuelle** est une file de révision humaine. Les traductions marquées **À réviser** (ou **Signalées**) y apparaissent ; vous pouvez les **Approuver**, les **Modifier**, les **Signaler**, les **Retraduire**, ou demander une **rétrotraduction** vers la source à titre de référence. Des raccourcis clavier accélèrent le travail : `↑`/`↓` pour se déplacer, `a` pour approuver, `e` pour modifier.
