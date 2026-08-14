# Module GitHub Copilot

## Aperçu

Le module **Copilot** traduit via GitHub Copilot. Il s’authentifie avec un jeton GitHub provenant d’un compte disposant d’un **abonnement Copilot actif**, stocké dans le coffre de credentials sous la clé `GITHUB_TOKEN`.

## Ajouter votre jeton au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **GitHub Copilot**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `GITHUB_TOKEN`, collez votre jeton comme valeur, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**.

Si la liste des modèles affiche *Aucun modèle disponible*, c’est que le jeton est manquant, invalide, ou que le coffre est verrouillé — déverrouillez le coffre ou vérifiez votre jeton GitHub, puis rouvrez la carte.

## Obtenir un jeton GitHub

Utilisez un jeton d’accès personnel **à portée fine** (« fine-grained ») afin qu’il n’accorde que l’accès à Copilot, rien de plus.

1. Rendez-vous sur [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Cliquez sur **Generate new token** (les jetons à portée fine sont proposés par défaut).
3. Donnez-lui un nom (par exemple « Translator-Copilot ») et définissez une **date d’expiration**.
4. Sous **Permissions → Account permissions**, trouvez **Copilot Requests** et réglez-le sur **Read-only**. Aucune autre permission n’est nécessaire.
5. Cliquez sur **Generate token** et copiez-le immédiatement — GitHub ne l’affiche qu’une seule fois.
6. Collez-le dans la valeur `GITHUB_TOKEN` de l’éditeur du coffre.

Le compte associé au jeton doit disposer d’un abonnement Copilot actif pour que les traductions aboutissent.
