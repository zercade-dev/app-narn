# Module Generic AI

## Aperçu

Le module **Generic AI** se connecte à n’importe quelle API compatible OpenAI — un fournisseur hébergé ou un serveur exécuté localement (par exemple Ollama, LM Studio, vLLM). Sa clé est stockée dans le coffre de credentials sous `GENERIC_API_KEY`.

**La clé API est facultative.** Elle n’importe que pour les points d’accès qui exigent une authentification (la plupart des fournisseurs cloud payants). Un serveur local comme Ollama ou LM Studio n’a besoin d’aucune vraie clé — mais le coffre exige quand même que le champ `GENERIC_API_KEY` ne soit pas vide, donc stockez-y n’importe quelle valeur d’espace réservé (par exemple `local`) pour le satisfaire.

## Ajouter votre clé au coffre de credentials

Les identifiants de fournisseur vivent dans un **coffre de credentials** chiffré, jamais dans une configuration en clair. Vous déverrouillez le coffre une fois par session, avec un mot de passe.

1. Ouvrez **Configuration globale** depuis la barre latérale.
2. Si vous n’avez pas encore configuré le coffre, créez-le : choisissez un mot de passe du coffre (que vous réutiliserez à chaque session) puis déverrouillez-le.
3. Sous **Activer un module**, sélectionnez **Generic AI**. Si une clé requise est manquante, l’éditeur du coffre s’ouvre automatiquement sur la bonne clé — sinon, cliquez sur **Gérer le coffre de credentials**.
4. Dans l’éditeur du coffre, ajoutez vos identifiants : choisissez la clé `GENERIC_API_KEY`, saisissez votre **mot de passe**, puis cliquez sur **Enregistrer**. Pour un point d’accès payant, collez la vraie clé API comme valeur. Pour un serveur local qui n’exige aucune authentification, la clé est facultative — stockez-y simplement une valeur d’espace réservé non vide (par exemple `local`).

## Faire fonctionner plusieurs points d’accès avec des instances

Generic AI prend en charge les **instances nommées**, ce qui vous permet d’enregistrer plusieurs points d’accès côte à côte (par exemple un fournisseur cloud et un serveur local). Utilisez **Ajouter une autre instance de Generic AI** dans Configuration globale. Chaque instance obtient sa propre clé de coffre dérivée — par exemple `GENERIC_API_KEY__MY-OLLAMA` — que vous renseignez dans le même éditeur du coffre.

## Choisir le point d’accès et le modèle

Définissez l’URL de base et le modèle du module (ou de chaque instance) dans ses réglages de Configuration globale, puis choisissez le modèle par projet dans l’onglet **Configuration**. Les **règles de routage** de l’onglet **Routage** décident quel module ou quelle instance gère chaque langue.

## Obtenir des identifiants

Pour un **serveur local** (Ollama, LM Studio, vLLM), aucun compte ni aucune clé n’est nécessaire — seulement l’URL de base (par exemple `http://localhost:11434/v1`) et une valeur d’espace réservé dans le champ `GENERIC_API_KEY`.

Pour un **fournisseur payant**, la marche à suivre dépend du fournisseur : créez un compte, obtenez l’URL de base et la clé API, et vérifiez que le point d’accès parle le format de complétion de chat OpenAI avant de saisir la clé dans le coffre.
