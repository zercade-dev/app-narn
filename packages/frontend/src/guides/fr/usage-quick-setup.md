# Configuration rapide

## Aperçu

Le parcours complet pour un nouveau projet : activer des fournisseurs, importer vos entrées, configurer glossaires et routage, traduire, et réviser. Les étapes marquées *(Facultatif)* améliorent la qualité mais ne sont pas nécessaires pour une première traduction — ignorez-les lors d’un premier passage et revenez-y plus tard.

## 1. Activer des fournisseurs et stocker les identifiants

1. Ouvrez **Configuration globale** et **activez un module** pour chaque fournisseur souhaité (Anthropic, OpenAI, DeepL, et ainsi de suite). Un module peut avoir plusieurs **instances nommées** — utile pour deux configurations d’un même fournisseur avec des clés ou des réglages par défaut différents.
2. Les identifiants de fournisseur sont stockés dans le **coffre de credentials** chiffré — configurez-le à la première utilisation et déverrouillez-le une fois par session. Voir le guide *Coffre de credentials* pour son fonctionnement.
3. Choisissez un **modèle** (et un **effort de raisonnement** optionnel) par module ou instance. Les modèles moins chers traduisent moins bien, attendez-vous donc à quelques essais avant de trouver votre équilibre. Surveillez l’**effort de raisonnement** — sur les modèles à raisonnement, il peut multiplier rapidement la facturation.

## 2. Créer le projet et importer les entrées

Créez un projet, définissez sa **langue source**, puis utilisez **Importer CSV** dans l’onglet **Données** pour charger vos entrées source (et les traductions déjà présentes dans le fichier, le cas échéant).

## 3. *(Facultatif)* Réviser d’abord votre texte source

Lancez une **révision IA de la source** sur la langue source avant de traduire — corriger fautes de frappe et formulations peu claires ici profite à chaque traduction faite ensuite. Si une correction modifie une entrée qui avait déjà des traductions, les anciennes traductions atterrissent dans l’onglet **Orphelins** — **réaffectez**-les, avec une retraduction optionnelle.

## 4. *(Facultatif)* Activer des glossaires

Dans l’onglet **Glossaire**, activez les glossaires qui s’appliquent à votre projet. L’application automatique fait correspondre les termes en **mots entiers, sans tenir compte de la casse** — les formes fléchies (pluriels, conjugaisons) ne seront pas détectées. Vous traduisez avec **DeepL** ? Envoyez-lui les glossaires avec **Envoyer à DeepL** (en haut à droite), et renvoyez-les après modification.

## 5. Configurer le routage

Ouvrez l’onglet **Routage** et choisissez votre fournisseur dans le sélecteur qui s’ouvre par défaut — cela envoie chaque entrée du projet à ce fournisseur, ce qui suffit pour une configuration à un seul fournisseur. Vous voulez des fournisseurs différents par langue, catégorie ou longueur d’entrée ? Passez en **Avancé** et ajoutez-y plutôt des **règles de routage**. Votre choix est enregistré dans les deux cas. Cette étape est obligatoire : une entrée sans règle correspondante échoue à la traduction avec une erreur *"no route"*.

## 6. *(Facultatif)* Construire des glossaires à partir de votre propre contenu

Enrichissez vos glossaires avant une traduction en masse : ajoutez des termes manuellement, lancez **Générer des glossaires** sur toute la source, ou — de façon plus ciblée — sélectionnez de bonnes entrées candidates dans **Traductions** et utilisez **Générer un glossaire à partir de la sélection** (en incluant les traductions existantes). Utilisez ici un modèle performant ; la qualité du glossaire se répercute sur tout ce qui est traduit ensuite.

## 7. *(Facultatif)* Affiner la qualité d’abord dans Comparer

Avant une exécution de traduction complète, utilisez l’onglet **Comparer** pour régler une langue que vous pouvez juger vous-même :

- Affinez le **contexte** de chaque entrée (personnage, ton, notes) et ses glossaires jusqu’à ce que la traduction sonne juste. Le contexte est stocké par entrée, pas par langue, donc le travail se répercute automatiquement sur toutes les autres langues.
- Comme vous itérez entrée par entrée, un modèle bon marché ou gratuit convient très bien ici — par exemple une clé Gemini gratuite (voir le guide *Google AI (Gemini)*), ajoutée comme sa propre **instance de module** avec le routage pointé temporairement dessus. Le palier gratuit a un plafond quotidien, préférez donc des requêtes groupées.
- Satisfait des résultats ? Traduisez le lot complet une fois avec les mêmes réglages pour confirmer que ça tient en masse.

## 8. Traduire

Deux façons de lancer la vraie traduction :

- **Traductions** — sélectionnez des entrées et **Traduire la sélection** pour couvrir toutes les langues cibles à la fois.
- **Comparer** — une langue à la fois, éventuellement avec une langue déjà révisée comme contexte de **référence**.

Pour un projet complet, une langue à la fois avec une langue de référence révisée l’emporte généralement : la révision IA qui suit reste concentrée sur une seule langue. Suivez la progression dans l’onglet **Activité**.

Le regroupement en lots est automatique par défaut ; pour un petit projet avec de nombreuses entrées courtes, une taille de lot personnalisée de **0** (toute la langue en une seule requête) peut mieux fonctionner avec un modèle performant.

## 9. Réviser l’exécution

Choisissez une option :

- Déclenchez une **révision par IA** pour l’exécution terminée depuis l’onglet **Activité**.
- Révisez à la main dans **Révision manuelle** ou **Comparer**.
- Approuvez tout tel quel et révisez plus tard.
