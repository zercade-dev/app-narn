# Coffre de credentials

## Aperçu

Les clés API des fournisseurs ne sont jamais conservées dans des fichiers de configuration en clair ou des variables d’environnement. Elles vivent dans le **coffre de credentials** — un stockage chiffré qui doit être déverrouillé avant que toute traduction ou révision par IA puisse utiliser un identifiant. Vous déverrouillez une fois par session de navigateur ; les identifiants ne sont déchiffrés qu’en mémoire.

<!-- local-only -->
## Coffre par mot de passe (auto-hébergé)

Sur une installation auto-hébergée, le coffre est un fichier local chiffré. Le premier déverrouillage le crée : le mot de passe que vous choisissez devient le mot de passe du coffre, et chaque identifiant que vous enregistrez rechiffre le fichier. Le mot de passe lui-même n’est jamais stocké — sans lui, le fichier ne peut pas être déchiffré. Déverrouillez depuis **Configuration globale**, ou depuis n’importe quelle carte *Coffre verrouillé*.
<!-- /local-only -->

## Coffre lié à l’appareil (cloud)

Sur la version cloud, le coffre est stocké **chiffré sur le serveur**, et son déchiffrement exige deux facteurs :

- Votre **mot de passe** — jamais stocké nulle part, ni sur le serveur ni sur l’appareil.
- Une **clé propre à l’appareil** — générée dans votre navigateur lorsque vous enrôlez un appareil, et conservée uniquement sur cet appareil.

Quand vous déverrouillez, les deux facteurs transitent par la connexion chiffrée et sont combinés côté serveur pour dériver la clé de déchiffrement **en mémoire, pour votre session uniquement**. Ni l’un des facteurs ni la clé dérivée ne sont jamais écrits dans le stockage du serveur — ce qui est stocké, c’est uniquement le coffre chiffré lui-même. Ainsi, les données stockées côté serveur ne peuvent à elles seules révéler vos identifiants, et un mot de passe compromis à lui seul ne suffit pas non plus : le déverrouillage exige aussi l’un de vos appareils enrôlés.

Si Configuration globale affiche un bouton **Aller à la page du coffre** au lieu d’une invite de mot de passe, vous êtes sur le coffre lié à l’appareil — la page Coffre gère la configuration, l’enrôlement des appareils, le déverrouillage, la modification des identifiants et les changements de mot de passe.

## Bon à savoir

- Un appareil jamais utilisé auparavant doit être **enrôlé** sur la page Coffre avant de pouvoir déverrouiller.
- Si vous perdez votre mot de passe (ou, sur le cloud, tous vos appareils enrôlés), le contenu du coffre ne peut pas être récupéré — vous devrez reconfigurer le coffre et ressaisir les clés de vos fournisseurs.
- Tout ce que l’application journalise passe par une rédaction automatique, donc les valeurs d’identifiants n’apparaissent jamais dans les journaux.
