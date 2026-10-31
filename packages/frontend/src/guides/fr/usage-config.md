# Onglet Configuration

## Aperçu

L’onglet **Configuration** contient la politique de traduction du projet sélectionné : choix de modèle par module, réutilisation de la mémoire de traduction, regroupement des lots, contrôles qualité (LQA) et gestion du projet. Ses **langues** et son **import/export CSV** vivent désormais dans l’onglet **Données**, séparé. Les identifiants de fournisseur ne se règlent pas ici — ils vivent dans le **coffre de credentials** (voir les guides *Configurer un module* et **Configuration globale**).

## Langues (dans l’onglet Données)

Définissez la **langue source** et les **langues cibles** de traduction dans l’onglet **Données**. L’ensemble des langues cibles actives entraîne tous les autres onglets — les colonnes d’entrées, les règles de routage et les contrôles qualité en dépendent tous.

## Importer et exporter le CSV (dans l’onglet Données)

L’import et l’export CSV vivent aussi dans l’onglet **Données** :

* **Importer CSV** charge les entrées source et les traductions existantes éventuelles. Un instantané de sécurité est pris automatiquement juste avant chaque import, ce qui vous permet de revenir en arrière depuis l’onglet **Sauvegarde**.
* Les lignes qui ne peuvent pas être analysées proprement (un guillemet immédiatement suivi d’une virgule) sont ignorées et signalées, plutôt qu’écrites sous forme de données décalées de colonne.
* **Exporter CSV** télécharge le projet ; vous pouvez choisir les langues et si la colonne de contexte du traducteur doit être incluse.
* Les exports écrivent le texte tel qu’il est enregistré, sans apostrophe ajoutée devant les cellules commençant par = + - ou @. Activez **Protéger pour les tableurs** uniquement pour un fichier que vous ouvrirez dans un tableur, car l’éditeur Miliastra conserve cette apostrophe comme du texte. Les exécutions de traduction ignorent les lignes dont la valeur Need translation? est FALSE. Un fichier de script client protégé ne doit être ni réimporté ni envoyé à l'éditeur.

### Fichiers de script client

Un CSV doté d’une colonne **Text Mapping ID** est un fichier de script client. Il est importé dans sa propre collection, **Texte de script client**, à part de votre **Texte principal** — la fenêtre d’import indique laquelle a été détectée.

* Chaque chaîne client est identifiée par son Text Mapping ID, si bien que le même anglais peut figurer dans les deux collections, et sur plusieurs lignes client, sans être fusionné.
* Importer un fichier client ne modifie jamais le texte principal, et importer un fichier principal ne modifie jamais le texte client.
* Lorsque l’anglais d’une clé existante change, quel que soit le mode d’import, l’ancienne ligne passe dans l’onglet **Orphelins** et la nouvelle conserve les traductions du fichier ; seules ses cellules vides restent non traduites. Utilisez **Réaffecter** pour reporter les traductions : la ligne ayant la même clé est suggérée en premier, et le mode de remplacement détermine si les cellules remplies sont conservées ou remplacées.
* Dès qu’un projet contient des chaînes client, **Exporter CSV** permet de choisir la collection à télécharger, et un export client conserve sa colonne Text Mapping ID.

## Modules et modèles

Activez les fournisseurs une fois pour toutes dans **Configuration globale**. Ici, dans Configuration, vous choisissez, par projet, le **modèle** et l’**effort de raisonnement** de chaque module activé — ou vous les laissez réglés sur *Hériter de la configuration globale*. Quel module s’exécute réellement pour une entrée donnée est décidé par les **règles de routage** (voir le guide *Routage*).

## Contrôles LQA

Le panneau **Contrôles LQA** configure la porte de qualité qui s’exécute sur chaque traduction : activez ou désactivez chaque contrôle (égalité des balises, limite de longueur, dépassement, respect du glossaire, termes interdits, assertions regex, et plus) et réglez chacun sur **Bloquant** ou **Avertissement**. Les problèmes bloquants font échouer la porte et peuvent déclencher une nouvelle tentative automatique ; les avertissements sont seulement signalés.

## Regroupement des lots

Le **regroupement des lots** garde les entrées apparentées (par catégorie et/ou glossaire) dans la même requête pour que le modèle les voie en contexte. Vous pouvez définir un réglage par défaut pour le projet et le remplacer par exécution.

## Gestion du projet

La **Zone dangereuse** vous permet de **Dupliquer** le projet (configuration et entrées, jamais les secrets) ou de le **Supprimer** définitivement.
