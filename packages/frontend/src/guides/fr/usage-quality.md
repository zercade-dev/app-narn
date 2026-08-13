# Onglet Qualité

## Aperçu

L’onglet **Qualité** est un tableau de bord qui agrège les résultats LQA (Language Quality Assurance) produits chaque fois que des entrées sont traduites. Il affiche votre taux de réussite global et l’endroit où les problèmes se concentrent, pour que vous puissiez repérer rapidement les zones à problème. Il se remplit au fur et à mesure de vos traductions — s’il est vide, lancez d’abord une traduction.

## Ce qu’il affiche

* **Taux de réussite global** sur tous les résultats LQA et les entrées qu’ils couvrent.
* **Taux de réussite par langue** — la qualité par langue cible.
* **Problèmes par source** — le nombre de problèmes par type, regroupés par libellé d’origine.
* **Qualité par module** — le taux de réussite et les problèmes regroupés par module ayant produit chaque traduction.

## Explorer les détails

Cliquez sur n’importe quelle cellule pour aller directement aux entrées correspondantes — le tableau de bord filtre la table **Traductions** sur les entrées concernées, pour que vous puissiez les corriger.

## D’où viennent les contrôles

Chaque traduction passe par la porte LQA, qui exécute les contrôles activés dans le panneau *Contrôles LQA* de l’onglet **Configuration** (égalité des balises, limite de longueur, dépassement, respect du glossaire, termes interdits, assertions regex, et plus). Les contrôles **Bloquant** font échouer la porte et peuvent déclencher une nouvelle tentative automatique ; les contrôles **Avertissement** sont signalés ici sans bloquer. Ajustez les contrôles à exécuter, et leur sévérité, dans Configuration.
