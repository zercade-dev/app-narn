# Module Google AI (Gemini)

## Aperçu

Le module **Google AI** traduit avec les modèles Gemini de Google. Il nécessite une clé API Google AI Studio, stockée dans le coffre de credentials sous la clé `GOOGLE_API_KEY`.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **Google AI (Gemini)**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `GOOGLE_API_KEY`, collez votre clé comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

Si une carte affiche ensuite *Coffre verrouillé*, cliquez sur **Déverrouiller le coffre** avant de traduire.

## Choisir un modèle

Dans l’onglet **Configuration** d’un projet, choisissez un modèle Gemini (avec, en option, un effort de raisonnement), ou héritez du réglage global par défaut. Les **règles de routage** de l’onglet **Routage** décident quel module gère chaque langue. Les modèles à raisonnement affichent des totaux de tokens élevés par rapport au nombre de caractères, donc les estimations de coût peuvent paraître élevées.

## Obtenir une clé API Google

1. Rendez-vous sur [ai.google.dev](https://ai.google.dev) et cliquez sur **Get API key**, ou allez directement sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Cliquez sur **Create API key** et sélectionnez votre projet.
3. Copiez la clé générée.
4. Collez-la dans la valeur `GOOGLE_API_KEY` de l’éditeur du coffre.
