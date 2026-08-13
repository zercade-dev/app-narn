# Module DeepL

## Aperçu

Le module **DeepL** fournit une traduction automatique neuronale professionnelle. Contrairement aux modules LLM, il s’agit de TA classique, et il peut envoyer les glossaires du projet à DeepL pour une terminologie cohérente. Sa clé est stockée dans le coffre de credentials sous `DEEPL_API_KEY`.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **DeepL**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `DEEPL_API_KEY`, collez votre clé d’authentification comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

DeepL ne prend pas en charge les instances nommées — il n’existe qu’un seul module DeepL.

## Utiliser des glossaires

DeepL peut appliquer un glossaire pendant la traduction. Créez des termes dans l’onglet **Glossaire**, puis utilisez **Envoyer à DeepL** pour les téléverser. Si un glossaire change après un envoi, l’onglet affiche *Nouvel envoi requis* — envoyez-le de nouveau pour mettre à jour DeepL.

## Obtenir une clé API DeepL

1. Rendez-vous sur [deepl.com/account](https://www.deepl.com/account).
2. Créez un compte API Free ou Pro.
3. Ouvrez **Account Settings** et repérez la section **API Key**.
4. Copiez votre clé d’authentification.
5. Collez-la dans la valeur `DEEPL_API_KEY` de l’éditeur du coffre.
