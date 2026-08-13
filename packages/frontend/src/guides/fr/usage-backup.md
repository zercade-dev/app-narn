# Onglet Sauvegarde

## Aperçu

L’onglet **Sauvegarde** compresse un projet — sa configuration, ses entrées et son glossaire — dans une archive `.zip` vérifiable. Chaque fichier est protégé par une somme de contrôle, et ces sommes sont vérifiées avant que quoi que ce soit ne soit réécrit lors d’une restauration.

## Créer une sauvegarde

1. Sélectionnez un projet.
2. Ouvrez l’onglet **Sauvegarde**.
3. Cliquez sur **Créer une sauvegarde**.
4. La nouvelle archive apparaît dans **Sauvegardes enregistrées**, où vous pouvez la **Télécharger**.

## Sauvegardes automatiques

L’application effectue aussi pour vous des instantanés de sécurité, listés aux côtés des sauvegardes manuelles :

* **Avant un import CSV** — un point de restauration juste avant l’import.
* **Avant une retraduction** — un point de restauration juste avant l’écrasement des entrées.

Configuration globale définit le nombre de **Sauvegardes max par projet** (10 par défaut) ; au-delà, les plus anciennes sont supprimées.

## Restaurer

1. Dans **Restaurer depuis une sauvegarde**, sélectionnez un fichier `.zip` (ou choisissez l’une des sauvegardes enregistrées).
2. L’application vérifie les sommes de contrôle et affiche un aperçu (projet, fichiers, date de création).
3. Confirmez. La restauration écrase la configuration, les entrées et le glossaire actuels du projet — cette action est irréversible, créez donc une sauvegarde fraîche au préalable en cas de doute.

## Supprimer

Utilisez **Supprimer** sur n’importe quelle sauvegarde enregistrée pour retirer définitivement cette archive du serveur.
