# Pseudo Test

## Aperçu

**Pseudo Test** n’est pas une vraie langue. C’est une langue de test qualité gratuite et hors ligne, qui réécrit votre texte source dans une version délibérément dénaturée, pour que vous puissiez la charger dans votre jeu et voir quelles entrées cassent l’interface — avant même qu’une seule vraie traduction n’existe.

Cela ne coûte rien, ne nécessite aucune clé API, et n’envoie jamais rien à un fournisseur.

## Ce que ça produit

`Save changes` devient quelque chose comme `⟦Şàvé çhàñgéş~~~~⟧`. Trois choses se produisent à la fois, et chacune révèle une catégorie de bug différente :

* **Lettres accentuées.** Chaque lettre est remplacée par un sosie accentué. Tout texte qui continue d’apparaître en anglais brut dans votre jeu n’a jamais été intégré à la table des entrées — il est codé en dur, et aucun traducteur ne pourra jamais l’atteindre.
* **Remplissage.** Le texte est étiré avec des caractères `~` jusqu’à environ 1,4 fois sa longueur d’origine, simulant des langues comme l’allemand qui s’avèrent longues. Les libellés qui débordent de leurs boutons, qui passent mal à la ligne, ou qui bousculent la mise en page apparaissent immédiatement.
* **Crochets.** Le résultat est encadré par `⟦…⟧`. Si l’un des deux crochets manque à l’écran, cette entrée est tronquée.

Les espaces réservés et les balises de mise en forme de votre texte passent inchangés, donc si l’un d’eux ressort dénaturé, c’est un bug à signaler plutôt qu’un problème de mise en page.

## L’utiliser

1. Dans l’onglet **Données**, cochez **Pseudo Test** sous *Langues cibles* et enregistrez.
2. Lancez une traduction comme d’habitude. Les entrées Pseudo Test sont toujours traitées par le générateur pseudo intégré — il n’y a rien à activer, aucune règle de routage à écrire, et aucun coût. Vos fournisseurs payants ne voient jamais ces entrées.
3. Vos vraies traductions sont en sécurité : le texte Pseudo Test est stocké dans sa propre colonne et ne peut jamais écraser une autre langue.

## L’intégrer à votre jeu

Dans la carte d’export, réglez **Exporter le texte pseudo comme** sur une langue que vous ne diffusez pas actuellement — l’allemand, par exemple — puis téléchargez le fichier et chargez-le dans le jeu avec cette langue sélectionnée. La colonne de la langue choisie est remplie avec le texte Pseudo Test pour ce seul téléchargement ; rien de stocké ne change, et les vraies traductions sont toujours là au prochain export.

Une fois vos tests terminés, exportez de nouveau avec la substitution remise sur **Aucune substitution**. Un export normal ne contient jamais de colonne Pseudo Test — le texte pseudo n’atteint votre jeu que par la substitution décrite ci-dessus — donc laisser Pseudo Test activé n’affecte pas les fichiers que vous diffusez.

## Quand l’utiliser

Lancez une passe pseudo tôt, avant de commander la moindre traduction. Chaque bug de mise en page qu’elle trouve est un bug que vous corrigez une fois, plutôt que quinze fois après l’arrivée de quinze langues.
