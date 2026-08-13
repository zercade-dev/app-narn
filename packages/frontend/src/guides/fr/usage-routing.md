# Onglet Routage

## Aperçu

L’onglet **Routage** décide quel module et quel modèle traitent chaque entrée. Il s’ouvre sur un sélecteur de fournisseur unique : choisissez un fournisseur, et chaque entrée du projet lui est envoyée. C’est tout ce dont la plupart des projets ont besoin.

Besoin de plus d’une destination ? Passez l’onglet en **Avancé** et le constructeur de règles complet apparaît, où le routage peut varier selon la langue cible, la catégorie ou la longueur de l’entrée, et où vous pouvez conserver plusieurs **groupes de règles** nommés. L’onglet se souvient du mode que vous avez utilisé en dernier. Un projet dont le routage est plus riche qu’un simple fournisseur affiche toujours le constructeur, quel que soit le mode choisi — une configuration existante ne vous est jamais cachée.

Dans les deux cas, cet onglet décide uniquement *comment* les entrées sont dispatchées. Les traductions démarrent depuis l’onglet **Traductions** ou **Comparer**.

## Règles de routage

Les règles vivent dans la vue **Avancé**. Elles sont évaluées par ordre de priorité ; la première qui correspond à une entrée l’emporte. Chaque règle peut porter sur :

* **Sources** — les libellés source/origine des entrées importées.
* **Limite de longueur d’entrée** — s’applique uniquement aux entrées à ou sous un nombre de caractères donné.
* **Langue cible** et **catégories**.

Pour les entrées qui correspondent, la règle définit le **module** (avec, en option, un **modèle** et un **effort de raisonnement** personnalisés) plus des indications de prompt optionnelles (personnage, ton, genre, notes). Ajoutez des règles avec **Ajouter une règle** ; chaque modification est enregistrée automatiquement au fur et à mesure, il n’y a donc pas de bouton **Enregistrer** à retenir. Vous pouvez conserver plusieurs **groupes de règles** nommés et basculer entre eux (le changement est verrouillé pendant qu’une exécution est en cours).

## Regroupement des lots

L’onglet Routage dispose aussi d’un contrôle **Regroupement des lots** — le même réglage par défaut du projet que celui de l’onglet Configuration, avec un bouton **Ignorer la limite de taille de lot** correspondant. Il garde les entrées apparentées dans la même requête de fournisseur, à travers les exécutions de traduction, d’évaluation et de révision de la source.

## Démarrer une traduction

1. Sélectionnez des entrées dans l’onglet **Traductions** ou **Comparer**.
2. Ouvrez la boîte de dialogue **Traduire…** depuis cet endroit — elle propose des options de retraduction, de mémoire et de regroupement par exécution, puis démarre l’exécution.
3. Suivez la progression, les nouvelles tentatives et les échecs dans l’onglet **Activité**.
