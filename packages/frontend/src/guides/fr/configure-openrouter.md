# Module OpenRouter

## Aperçu

Le module **OpenRouter** traduit avec [OpenRouter](https://openrouter.ai) — une API unique qui achemine vers des modèles de nombreux éditeurs (Anthropic, OpenAI, Google, Meta, et d’autres). Il nécessite une clé API OpenRouter, stockée dans le coffre de credentials sous la clé `OPENROUTER_API_KEY`.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **OpenRouter**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `OPENROUTER_API_KEY`, collez votre clé comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

Si une carte affiche ensuite *Coffre verrouillé*, cliquez sur **Déverrouiller le coffre** avant de traduire.

## Choisir un modèle

Dans l’onglet **Configuration** d’un projet, choisissez un modèle dans le catalogue OpenRouter en direct — chaque entrée affiche son tarif par token et sa longueur de contexte, et seuls les modèles de génération de texte sont listés. Les identifiants de modèle sont préfixés par l’éditeur (par exemple `anthropic/claude-sonnet-4.5` ou `openai/gpt-4o-mini`) ; vous pouvez aussi saisir directement un nouveau slug. Les **règles de routage** de l’onglet **Routage** décident quel module gère chaque langue.

## Obtenir une clé API OpenRouter

1. Rendez-vous sur [openrouter.ai](https://openrouter.ai).
2. Inscrivez-vous ou connectez-vous.
3. Ouvrez **Keys** depuis le menu de votre compte.
4. Créez une nouvelle clé API et copiez-la.
5. Collez-la dans la valeur `OPENROUTER_API_KEY` de l’éditeur du coffre.

Remarque : votre texte est envoyé à OpenRouter puis acheminé vers l’éditeur du modèle choisi, selon les conditions d’OpenRouter et la politique de données de cet éditeur.
