# Configuration rapide

## Aperçu

Nouveau sur NARN ? Le parcours court ci-dessous vous mène de zéro à une traduction exportée en cinq étapes. La configuration guidée de l’application vous accompagne à travers les mêmes étapes ; vous pouvez l’ignorer et la reprendre plus tard — **Poursuivre la configuration** dans la barre latérale reprend là où vous en étiez, et vous pouvez la relancer depuis ce guide. Tout ce qui suit le parcours court est pour quand vous voulez plus de contrôle.

## Le parcours court

1. **Créez le mot de passe de votre coffre.** Vos clés de fournisseur sont chiffrées avec lui — voir le guide [Coffre de credentials](guide:usage-vault). Sur la version cloud, les étapes 1 et 2 se font ensemble sur la page du coffre.
2. **Ajoutez une clé gratuite.** Une clé Google AI est le moyen le plus simple de démarrer — obtenez-en une sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey), ou choisissez **Utiliser mon propre fournisseur**. [NARN Freeway](guide:usage-freeway) choisit ensuite des modèles gratuits pour vous.
3. **Créez un projet et importez votre texte.** Créez un projet, puis dans l’onglet **Données** choisissez la langue source et les langues cibles, et utilisez **Importer CSV**.
4. **Traduisez.** Dans **Traductions**, sélectionnez toutes les entrées et cliquez sur **Traduire**. NARN Freeway choisit des modèles gratuits pour vous ; suivez la progression dans **Activité**.
5. **Exportez.** Téléchargez le fichier traduit depuis le projet.

Les nouveaux utilisateurs démarrent en **mode Simple**, qui n’affiche que Configuration, Données, Traductions et Activité (plus Guide, Paramètres et **Clés des fournisseurs**). Basculez entre **Simple** et **Avancé** depuis la barre supérieure ou dans les Paramètres quand vous voulez.

## Pour aller plus loin

Ces étapes se trouvent en **mode Avancé** et améliorent la qualité ou vous donnent un contrôle plus fin. Les étapes marquées *(Optional)* ne sont pas nécessaires pour une première traduction — ignorez-les et revenez-y plus tard. La première fois que vous ouvrez Routage, Glossaire, Qualité, Comparer ou Révision IA de traduction en mode Avancé, une courte visite guidée est proposée ; vous pouvez relancer chaque visite depuis ce guide, ou désactiver ces propositions dans les Paramètres.

## Ajouter d’autres fournisseurs et identifiants

1. Ouvrez **Configuration globale** et **activez un module** pour chaque fournisseur souhaité (Anthropic, OpenAI, DeepL, et ainsi de suite) depuis la liste **Activer un module** — DeepL y figure sous son nom, tandis que les fournisseurs d’IA apparaissent sous la forme **Ajouter une autre instance de …**, qui crée la première instance du fournisseur. Un module peut avoir plusieurs **instances nommées** — utile pour deux configurations d’un même fournisseur avec des clés ou des réglages par défaut différents.
2. Les identifiants de fournisseur sont stockés dans le **coffre de credentials** chiffré — configurez-le à la première utilisation et déverrouillez-le une fois par session. Voir le guide *Coffre de credentials* pour son fonctionnement.
3. Choisissez un **modèle** (et un **effort de raisonnement** optionnel) par module ou instance. Les modèles moins chers traduisent moins bien, attendez-vous donc à quelques essais avant de trouver votre équilibre. Surveillez l’**effort de raisonnement** — sur les modèles à raisonnement, il peut multiplier rapidement la facturation.

## *(Optional)* Réviser d’abord votre texte source

Lancez une **révision IA de la source** sur la langue source avant de traduire — corriger fautes de frappe et formulations peu claires ici profite à chaque traduction faite ensuite. Si une correction modifie une entrée qui avait déjà des traductions, les anciennes traductions atterrissent dans l’onglet **Orphelins** — **réaffectez**-les, avec une retraduction optionnelle.

## *(Optional)* Activer des glossaires

Dans l’onglet **Glossaire**, activez les glossaires qui s’appliquent à votre projet. L’application automatique fait correspondre les termes en **mots entiers, sans tenir compte de la casse** — les formes fléchies (pluriels, conjugaisons) ne seront pas détectées. Vous traduisez avec **DeepL** ? Envoyez-lui les glossaires avec **Envoyer à DeepL** (en haut à droite), et renvoyez-les après modification.

## Configurer le routage

Ouvrez l’onglet **Routage** et choisissez votre fournisseur dans le sélecteur qui s’ouvre par défaut — cela envoie chaque entrée du projet à ce fournisseur, ce qui suffit pour une configuration à un seul fournisseur. Vous voulez des fournisseurs différents par langue, catégorie ou longueur d’entrée ? Passez en **Avancé** et ajoutez-y plutôt des **règles de routage**. Votre choix est enregistré dans les deux cas. Un projet sans aucune règle envoie tout via NARN Freeway : cette étape est donc facultative au départ. Dès qu’un projet a des règles, une entrée qui ne correspond à aucune échoue à la traduction avec une erreur *"no route"*.

## *(Optional)* Construire des glossaires à partir de votre propre contenu

Enrichissez vos glossaires avant une traduction en masse : ajoutez des termes manuellement, lancez **Générer des glossaires** sur toute la source, ou — de façon plus ciblée — sélectionnez de bonnes entrées candidates dans **Traductions** et utilisez **Générer un glossaire à partir de la sélection** (en incluant les traductions existantes). Utilisez ici un modèle performant ; la qualité du glossaire se répercute sur tout ce qui est traduit ensuite.

## *(Optional)* Affiner la qualité d’abord dans Comparer

Avant une exécution de traduction complète, utilisez l’onglet **Comparer** pour régler une langue que vous pouvez juger vous-même :

- Affinez le **contexte** de chaque entrée (personnage, ton, notes) et ses glossaires jusqu’à ce que la traduction sonne juste. Le contexte est stocké par entrée, pas par langue, donc le travail se répercute automatiquement sur toutes les autres langues.
- Comme vous itérez entrée par entrée, un modèle bon marché ou gratuit convient très bien ici — par exemple une clé Gemini gratuite (voir le guide *Google AI (Gemini)*), ajoutée comme sa propre **instance de module** avec le routage pointé temporairement dessus. Le palier gratuit a un plafond quotidien, préférez donc des requêtes groupées.
- Satisfait des résultats ? Traduisez le lot complet une fois avec les mêmes réglages pour confirmer que ça tient en masse.

## Traduire en masse

Deux façons de lancer la vraie traduction :

- **Traductions** — sélectionnez des entrées et **Traduire la sélection** pour couvrir toutes les langues cibles à la fois.
- **Comparer** — une langue à la fois, éventuellement avec une langue déjà révisée comme contexte de **référence**.

Pour un projet complet, une langue à la fois avec une langue de référence révisée l’emporte généralement : la révision IA qui suit reste concentrée sur une seule langue. Suivez la progression dans l’onglet **Activité**.

Le regroupement en lots est automatique par défaut ; pour un petit projet avec de nombreuses entrées courtes, une taille de lot personnalisée de **0** (toute la langue en une seule requête) peut mieux fonctionner avec un modèle performant.

## Réviser l’exécution

Choisissez une option :

- Déclenchez une **révision par IA** pour l’exécution terminée depuis l’onglet **Activité**.
- Révisez à la main dans **Révision manuelle** ou **Comparer**.
- Approuvez tout tel quel et révisez plus tard.
