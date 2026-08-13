# Onglet Orphelins

## Aperçu

L’onglet **Orphelins** liste les entrées qui ne figurent plus dans le CSV importé le plus récemment. Elles apparaissent généralement après un réimport où une ligne a été supprimée, renommée, ou a vu son texte source changer — les anciennes traductions sont conservées ici pour que vous ne perdiez pas votre travail.

## Ce que vous pouvez faire

* **Supprimer** un orphelin pour retirer définitivement l’enregistrement et ses traductions (cette action est irréversible).
* **Réaffecter** un orphelin pour déplacer ses traductions vers une autre entrée. Recherchez la cible par texte source ; les traductions existantes de la cible sont conservées, et seules ses langues vides sont complétées.
* Sélectionnez plusieurs orphelins et **Supprimer la sélection** en bloc, ou **Actualiser** la liste.

## Flux de travail

1. Réimportez votre CSV source depuis l’onglet **Données**.
2. Ouvrez **Orphelins** et vérifiez ce qui a disparu.
3. **Réaffectez** toute entrée dont l’id ou le texte source a changé mais dont les traductions restent valables.
4. **Supprimez** les entrées réellement disparues.

Quand la liste est vide, chaque entrée importée correspond au projet actuel — rien n’est orphelin.
