# Module Groq

## Aperçu

Le module **Groq** traduit avec [Groq](https://groq.com) — une inférence rapide pour des modèles ouverts comme Llama, Qwen et GPT-OSS, avec un niveau gratuit adapté au travail de traduction quotidien. Il nécessite une clé API Groq, stockée dans le coffre de credentials sous la clé `GROQ_API_KEY`.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **Groq**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `GROQ_API_KEY`, collez votre clé comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

Si une carte affiche ensuite *Coffre verrouillé*, cliquez sur **Déverrouiller le coffre** avant de traduire.

## Choisir un modèle

Dans l’onglet **Configuration** d’un projet, choisissez un modèle dans le catalogue Groq en direct, ou héritez de la valeur par défaut globale. `llama-3.3-70b-versatile` est un bon choix par défaut pour la qualité de traduction ; des modèles plus petits comme `llama-3.1-8b-instant` sacrifient un peu de qualité pour la vitesse. Les **règles de routage** de l’onglet **Routage** décident quel module gère chaque langue.

## Obtenir une clé API Groq

1. Rendez-vous sur [console.groq.com](https://console.groq.com).
2. Inscrivez-vous ou connectez-vous.
3. Ouvrez **API Keys** depuis le menu de la console.
4. Créez une nouvelle clé API et copiez-la — elle commence par `gsk_`.
5. Collez-la dans la valeur `GROQ_API_KEY` de l’éditeur du coffre.

Le niveau gratuit de Groq applique des limites quotidiennes par modèle (pas de chiffres fixes ici — consultez votre console pour connaître les limites actuelles), et selon les conditions de Groq, les données API ne sont pas utilisées pour entraîner des modèles. Une fois votre clé ajoutée, **NARN Freeway** inclut automatiquement le plan gratuit de Groq lors de la répartition du travail de traduction entre les quotas gratuits de vos fournisseurs connectés — sans configuration supplémentaire.
