# Questions & réponses

## Vue d'ensemble

Des réponses courtes aux questions qui reviennent le plus souvent, chacune renvoyant au guide qui traite le sujet en détail. Cette liste s'étoffe au fil des questions reçues ; si la vôtre n'y figure pas encore, la liste des thèmes à gauche entre bien davantage dans le détail.

## Ce qui est traduit

### Quelles entrées une exécution traduit-elle, et lesquelles ignore-t-elle ?

Uniquement celles qui en ont encore besoin. Pour chaque entrée et chaque langue cible sélectionnée, l'exécution traduit la paire lorsqu'elle n'a pas encore de traduction — ou lorsque vous avez explicitement demandé une **retraduction**. Une paire qui a déjà du texte est laissée telle quelle : relancer une traduction n'écrase donc jamais le travail que vous avez déjà fait ou relu.

Une entrée, ou une paire entrée-langue précise, est écartée dès que l'une de ces conditions est vraie :

* **Elle est déjà traduite**, et vous n'avez pas demandé de retraduction.
* **Vous l'avez marquée Ignorée.** Cela la retire de *toutes* les opérations d'IA — traduction, révision par IA, révision de la source et génération de glossaires ou de catégories. Les entrées ignorées restent visibles dans le tableau avec un badge : la décision est donc toujours visible et toujours réversible.
* **Elle est orpheline** — elle a disparu de votre dernier import CSV et attend dans l'onglet [Orphelins](guide:usage-orphans).
* **Elle a été importée avec `Besoin de traduction ? = FALSE`.**
* **La cible est la langue source.** Une entrée n'est jamais traduite vers sa propre langue source, même si vous sélectionnez cette langue comme cible.
* **Il n'y a rien à traduire.** Un texte vide, un nombre comme `3.14` ou `100%`, une couleur hexadécimale comme `#ff8800`, ou une chaîne qui n'est que balises et espaces réservés comme `<b>{count}</b>` sont recopiés tels quels, sans appeler de fournisseur.

Une entrée remplie depuis la [Mémoire de traduction](guide:usage-translation-memory) n'atteint elle non plus jamais un fournisseur — c'est la traduction stockée qui est réutilisée. Elle compte tout de même comme traduite.

### Puis-je retraduire quelque chose qui est déjà traduit ?

Oui, mais il faut le demander, car les exécutions ignorent par défaut les paires terminées. Cochez **retraduire** dans la boîte de dialogue *Traduire…* pour un lot, ou utilisez **Retraduire** sur une ligne précise dans l'onglet [Comparaison](guide:usage-compare) ou dans la file de révision manuelle.

### Pourquoi une entrée est-elle revenue avec son texte source inchangé ?

Presque toujours parce qu'il n'y avait rien à traduire — le dernier point de la liste ci-dessus. Les nombres, les couleurs et le balisage pur sont reconnus et recopiés tels quels, car un modèle ne peut que les répéter ou les abîmer. Rien n'a été envoyé à un fournisseur et rien n'a été facturé pour ces entrées.

## Fournisseurs, modèles et routage

### Comment changer le modèle utilisé pour les traductions ?

Il y a trois niveaux, et celui qui vous intéresse dépend de l'ampleur souhaitée du changement :

1. **Pour un fournisseur partout** — ouvrez **Configuration globale**, trouvez le module et choisissez-y son **modèle**. Tous les projets réglés sur *Hériter de la configuration globale* le suivent.
2. **Pour un seul projet** — ouvrez l'onglet [Configuration](guide:usage-config) de ce projet et fixez le **modèle** (et l'**effort de raisonnement**) du module au lieu d'en hériter.
3. **Pour certaines entrées seulement** — ouvrez l'onglet [Routage](guide:usage-routing), passez en **Avancé** et définissez un **modèle personnalisé** sur une règle de routage. Seules les entrées correspondant à cette règle l'utilisent.

La vue simple de l'onglet Routage choisit un **fournisseur**, pas un modèle : elle exécute délibérément le modèle déjà configuré pour ce module.

### Des langues différentes peuvent-elles utiliser des fournisseurs différents ?

Oui. Passez l'onglet [Routage](guide:usage-routing) en **Avancé** et ajoutez une règle par langue — ou par catégorie, ou par longueur d'entrée. Les règles sont évaluées par ordre de priorité et la première qui correspond à une entrée l'emporte. Si vous préférez ne rien choisir du tout, pointez une seule règle vers [NARN Freeway](guide:usage-freeway) et laissez-le retenir un modèle gratuit pour chaque lot.

### La traduction ne démarre pas et indique qu'aucune règle de routage ne correspond. Que faire ?

Une exécution ne démarre que lorsque toutes les langues qu'elle contient ont une destination. Si une langue cible ne correspond à aucune règle, l'exécution est refusée avant tout envoi et le message nomme la langue. Ouvrez l'onglet [Routage](guide:usage-routing) et ajoutez une règle qui la couvre — le sélecteur simple de fournisseur couvre toutes les langues d'un coup — puis relancez.

## Exécutions, échecs et récupération

### Des chaînes ont échoué. Dois-je tout relancer ?

Non. Utilisez **Réessayer les échecs** sur l'exécution, dans l'onglet [Activité](guide:usage-activity) : seules les paires entrée-langue en erreur sont relancées, tout ce qui a réussi reste intact.

### Pourquoi dois-je déverrouiller le coffre à nouveau ?

Le [coffre de credentials](guide:usage-vault) se déverrouille par session, pas définitivement, et il se reverrouille aussi de lui-même après un moment d'inactivité. Déverrouillez-le et continuez. Si une exécution était en cours au moment du verrouillage, utilisez ensuite **Réessayer les échecs** sur celle-ci.

### J'ai réimporté mon CSV et des traductions ont disparu. Sont-elles perdues ?

Non. Lorsqu'une réimportation ne contient plus une entrée, ses traductions sont conservées dans l'onglet [Orphelins](guide:usage-orphans) au lieu d'être supprimées. **Reliez** un orphelin à l'entrée qui l'a remplacé pour y déplacer les traductions ; seules les langues vides de la cible sont remplies, donc rien n'est écrasé. Un instantané est par ailleurs pris automatiquement juste avant chaque import : vous pouvez donc revenir en arrière sur tout le projet depuis l'onglet [Sauvegarde](guide:usage-backup).
