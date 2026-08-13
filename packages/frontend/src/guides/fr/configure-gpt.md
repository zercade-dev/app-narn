# Module OpenAI (GPT)

## Aperçu

Le module **GPT** traduit avec les modèles d’OpenAI. Il nécessite une clé API OpenAI, stockée dans le coffre de credentials sous la clé `OPENAI_API_KEY`.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **OpenAI (GPT)**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `OPENAI_API_KEY`, collez votre clé comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

Si une carte affiche ensuite *Coffre verrouillé*, cliquez sur **Déverrouiller le coffre** avant de traduire.

## Choisir un modèle

Dans l’onglet **Configuration** d’un projet, choisissez un modèle GPT (avec, en option, un effort de raisonnement), ou héritez du réglage global par défaut. Les **règles de routage** de l’onglet **Routage** décident quel module gère chaque langue.

## Obtenir une clé API OpenAI

1. Rendez-vous sur [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).
2. Inscrivez-vous ou connectez-vous.
3. Cliquez sur **Create new secret key**.
4. Copiez la clé (elle ne s’affiche qu’une seule fois).
5. Collez-la dans la valeur `OPENAI_API_KEY` de l’éditeur du coffre.
