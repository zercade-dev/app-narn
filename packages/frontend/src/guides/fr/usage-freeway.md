# NARN Freeway

## Vue d'ensemble

**NARN Freeway** est un pool partagé de modèles d'IA en offre gratuite vers lesquels l'application achemine le travail automatiquement — sans carte bancaire. Les clés des fournisseurs restent les vôtres ; ce que Freeway apporte, c'est la comptabilité. Il suit le quota gratuit restant de chaque fournisseur, choisit un modèle pour chaque lot, et passe au suivant dès qu'un modèle est limité en fréquence ou épuisé pour la journée.

Pointez le routage vers Freeway et vous ne choisissez plus jamais de modèle : le travail Freeway n'a ni réglage de modèle ni effort de raisonnement, car le choix se fait lot par lot, langue par langue, parmi ce que le pool peut servir à cet instant.

## L'activer

Un projet tout neuf, sans règle de routage, propose un bouton **Laissez NARN Freeway s'occuper de tout** dans l'onglet [Routage](guide:usage-routing) — un clic crée une règle fourre-tout pointant vers le pool gratuit.

Sinon, choisissez **NARN Freeway** comme n'importe quel autre fournisseur : dans le sélecteur simple de l'onglet Routage pour lui envoyer tout le projet, ou comme module d'une règle précise en **Avancé** pour l'utiliser sur certaines langues et un fournisseur payant sur d'autres.

Deux conditions d'abord : au moins un fournisseur gratuit doit avoir sa clé enregistrée dans le [coffre de credentials](guide:usage-vault), et le coffre doit être déverrouillé — tant qu'il est verrouillé, tous les fournisseurs Freeway apparaissent comme dépourvus de clé.

## Les fournisseurs qu'il utilise

Freeway puise dans les offres gratuites des fournisseurs que vous avez déjà configurés en modules. Aujourd'hui, il sait utiliser :

* **Google AI (Gemini)** — la plus grosse allocation gratuite, et la source de la plupart des modèles les plus solides du pool.
* **Groq** — rapide, avec un nombre de requêtes quotidien généreux.
* **OpenRouter** — les modèles gratuits qu'il héberge.
* **DeepL** — l'allocation mensuelle de caractères de son offre gratuite, pour la traduction automatique classique.

<!-- local-only -->

* **GitHub Copilot** — si vous avez un abonnement Copilot.

<!-- /local-only -->

Un fournisseur auquel vous n'avez pas donné de clé est simplement ignoré. Ajouter une clé de plus élargit le pool et réduit le risque qu'une exécution doive attendre.

## Surveiller le pool

Le panneau **NARN Freeway** de l'écran de configuration montre tout le pool d'un coup d'œil : l'état de la clé de chaque fournisseur et, par modèle, son **État**, le quota **Restant**, la **Prochaine réinitialisation** et le **Taux de réussite** récent par langue.

L'état d'un modèle est l'un des suivants :

* **Prêt** — utilisable tout de suite.
* **En refroidissement** — brièvement limité en fréquence ; il revient tout seul.
* **Épuisé pour aujourd'hui** — l'allocation quotidienne est consommée, et le panneau indique quand elle se réinitialise.
* **Module désactivé** — la clé est enregistrée mais le module est éteint. Le panneau propose de l'activer.
* **Pas de clé** — rien n'est encore enregistré dans le coffre pour ce fournisseur.
* **Identifiants invalides** — la clé a été rejetée. Enregistrez une clé valide dans le coffre pour lever la marque.

## Quand le quota gratuit est épuisé

Une exécution qui épuise le pool n'échoue pas. Elle passe en **En attente de quota gratuit**, garde les paires qu'il lui reste, et repart d'elle-même dès qu'un fournisseur voit son allocation réinitialisée — vous pouvez la laisser et revenir plus tard.

Si vous préférez ne pas attendre, ouvrez l'exécution dans l'onglet [Activité](guide:usage-activity) et utilisez **Reprendre maintenant avec…** pour terminer les paires restantes avec un fournisseur payant, ou **Réessayer avec le quota gratuit** pour retenter le pool immédiatement.

## Niveaux de qualité, et n'améliorer que le nécessaire

Les modèles gratuits ne se valent pas, aussi chacun porte-t-il un **niveau de qualité** de 1 à 4, le 4 étant le plus solide. Chaque traduction enregistre le niveau du modèle qui l'a produite, ce qui fait du « tout traduire gratuitement » une première passe exploitable :

1. Traduisez tout le projet via Freeway, sans frais.
2. Dans l'onglet **Traductions**, filtrez sur **Sous le niveau** pour voir ce qu'un modèle plus faible a traité.
3. Sélectionnez ces entrées et utilisez **Retraduire sous le niveau** pour refaire uniquement celles-là avec un meilleur fournisseur.

Vous ne payez finalement que pour les entrées qui en avaient réellement besoin.

## Où Freeway fonctionne aussi

Freeway ne sert pas qu'à traduire. Il est également disponible comme module pour la **révision par IA**, la **révision de la source** et la **génération de glossaires** et de **catégories** — dans chaque cas il choisit le meilleur modèle gratuit pour la tâche et masque les réglages de modèle et d'effort de raisonnement, puisqu'il n'y a rien à choisir. Voir [Révision par IA](guide:usage-ai-review), [Glossaire](guide:usage-glossary) et [Catégorie](guide:usage-category).
