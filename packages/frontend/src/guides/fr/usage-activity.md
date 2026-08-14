# Onglet Activité

## Aperçu

L’onglet **Activité** est le centre de contrôle des tâches en arrière-plan. Chaque tâche de longue durée y apparaît : exécutions de **traduction**, **révision par IA** (traduction et source), **génération de glossaire** et **génération de catégories**. Les exécutions sont mises en file d’attente et sérialisées par projet, vous pouvez donc en enchaîner plusieurs et suivre leur déroulement.

## Lire une exécution

Chaque exécution affiche son **type**, son **statut** (En file d’attente, En cours, En pause, Terminée, Échouée ou Annulée), sa progression et un **coût** estimé. Les coûts sont des estimations fournies par les modules, dérivées du prix de chaque modèle par million de tokens ; les modèles à raisonnement peuvent donc afficher des totaux de tokens élevés par rapport au nombre de caractères. Utilisez **Voir les détails** pour voir exactement ce qu’une exécution a traduit, les nouvelles tentatives éventuelles, et l’utilisation de caractères et de tokens. Vous pouvez copier l’ID d’une exécution pour référence.

## Gérer la file d’attente

* **Mettre en pause** / **Reprendre** une exécution, ou **Démarrer maintenant** pour faire passer une exécution en file d’attente en tête de liste.
* **Monter dans la file** / **Descendre dans la file** pour réordonner la file d’attente.
* **Annuler** une exécution qui est en file d’attente ou en cours.

## Récupérer et réviser

* Si certaines entrées ont échoué, **Réessayer les échecs** relance uniquement celles-ci.
* Sur une exécution de traduction terminée, lancez une **révision par IA** directement depuis l’exécution — choisissez le module et le modèle (par défaut, ceux utilisés pour la traduction), puis ouvrez les verdicts dans l’onglet **Révision IA de traduction**.
