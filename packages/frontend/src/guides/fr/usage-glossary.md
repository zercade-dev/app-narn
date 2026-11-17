# Onglet Glossaire

## Aperçu

L’onglet **Glossaire** maintient la cohérence terminologique. Un projet peut contenir plusieurs glossaires ; chacun est une liste de termes source avec une traduction par langue cible. Les glossaires sont automatiquement rapprochés des entrées, et les termes trouvés sont transmis au modèle pendant la traduction.

## Glossaires et termes

* Créez un glossaire avec **Nouveau glossaire** ; renommez-le ou supprimez-le plus tard.
* **Activez** ou **désactivez** un glossaire — un glossaire désactivé est ignoré lors de l’import et de la traduction.
* Ajoutez des termes avec une **source**, une **traduction par langue**, et des **notes** optionnelles.
* Marquez un terme **constante** lorsqu’il doit ressortir exactement tel qu’il est écrit dans le glossaire, comme un nom de personnage ou une marque — voir *Termes constants* plus bas.
* Un glossaire a deux onglets : **Termes** liste ses termes, et **Correspondances** liste les entrées qui les contiennent, où vous pouvez attribuer le glossaire aux entrées ou le retirer.

Certains glossaires sont en **lecture seule** (gérés globalement) et fournissent des termes sans être modifiables ici.

## Termes constants

* Un terme constant **n’est jamais envoyé au moteur de traduction**. NARN le remplace par un marqueur avant de traduire, puis met à sa place la traduction du glossaire : un nom de personnage comme *Diluc* ressort toujours exactement tel qu’il est écrit dans le glossaire.
* **La casse compte.** Seul un texte écrit exactement comme le terme est protégé : *Venti* (le personnage) l’est, *a venti latte* ne l’est pas. Toute autre graphie est envoyée au moteur comme une indication de glossaire ordinaire, marquée comme nom, pour qu’il distingue le nom du mot courant.
* **Le moteur ne peut pas modifier le mot.** Comme il ne voit jamais le terme, il ne peut ni le décliner ni accorder d’autres mots avec lui : dans des langues comme le russe, le coréen ou le turc, un nom constant apparaît toujours sous sa forme de base. Réservez constante aux noms et codes qui doivent rester fixes.
* Laissez en termes normaux les noms qui sont aussi des mots courants, car les titres et les libellés leur mettent souvent une majuscule (*Gaming Settings*). Dans les glossaires fournis, les noms de personnages, les nations et les noms de produit Genshin Impact, Miliastra Sandbox et Miliastra Wonderland sont constants, sauf Gaming, Amber, Razor, Sucrose, Prune, Traveler et Wanderer.

## Importer et exporter

Importez des termes depuis un fichier **CSV** ou **TBX** — un aperçu montre combien de termes seront ajoutés, mis à jour, ou en conflit avant que vous ne validiez. Exportez le glossaire vers **CSV** ou **TBX**.

## Générer avec l’IA

* **Générer des glossaires** analyse le texte source et propose des glossaires de noms récurrents et de termes personnalisés. L’opération s’exécute en arrière-plan — suivez-la dans l’onglet **Activité** et vérifiez les suggestions avant de les créer. Vous pouvez indiquer des glossaires existants comme « déjà connus » pour que le modèle ne les répète pas.
* **Générer les traductions** complète les traductions cibles des termes qui n’en ont pas encore.

## DeepL

Si vous traduisez avec DeepL, utilisez **Envoyer à DeepL** pour téléverser les termes du glossaire. Après avoir modifié un glossaire déjà envoyé, l’onglet affiche *Nouvel envoi requis* — envoyez-le de nouveau pour mettre à jour DeepL.

## Contrôle par entrée

Depuis l’onglet Traductions, vous pouvez choisir quels glossaires sont **activés** pour une entrée donnée.
