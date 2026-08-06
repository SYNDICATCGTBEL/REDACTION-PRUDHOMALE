# Contrôle visuel — éditeur de texte Word

## Référence et périmètre

- Référence fournie : `Texte word.png`, 588 × 121 pixels.
- Version contrôlée : v0.3.47. Les captures de l’éditeur Word réalisées en v0.3.46 restent valables, ce composant n’ayant pas été modifié par la v0.3.47.
- Comparaison combinée inspectée : `qa-0.3.46-comparison.png`.
- Capture de l’éditeur construit : `qa-0.3.46-packaged-editor.png`.
- La référence montre le ruban Word avec Aptos (Corps), taille 12, les commandes de police, de paragraphe et de styles. Elle ne montre pas la page ni les marges du document.

## Fidélité visuelle

- Police et taille : conformes à la référence avec Aptos (Corps) et 12 points par défaut.
- Mise en forme : gras, italique, souligné, barré, indice, exposant, couleur du texte et surlignage sont visibles dans la barre.
- Paragraphes : styles Normal, Titre 1 et Titre 2, alignements, justification, listes à puces et listes numérotées sont disponibles.
- Historique : les commandes Annuler, Rétablir et Effacer le format sont directement accessibles.
- Mise en page : la barre reprend la densité et le regroupement du ruban Word sans copier les commandes qui ne concernent pas la rédaction juridique, comme le collage d’images.
- Couleurs : les surfaces restent claires, les libellés sont lisibles et les états actifs utilisent le système visuel existant de l’application.
- Icônes et libellés : les commandes de mise en forme utilisent les conventions visibles de Word ; les commandes de paragraphe restent écrites en toutes lettres pour éviter toute ambiguïté.

## Couverture de l’application

- Les 24 zones de texte présentes dans l’écran principal et les fenêtres de travail possèdent toutes le même éditeur.
- Les sept parties de la fenêtre « Modifier la motivation » possèdent chacune la barre complète.
- Les fiches d’analyse, l’import d’un syllogisme, la recherche juridique et toutes les parties du jugement utilisent le même composant.
- Le texte simple déjà enregistré reste compatible et est automatiquement affiché dans le nouvel éditeur.

## États, interactions et persistance

- Sélection réelle puis application de gras, souligné, italique, Arial 14, couleur et liste à puces : réussie.
- Fermeture, relance et relecture des mêmes styles : réussie.
- Modification d’une règle de droit, enregistrement puis réouverture de la règle avec ses styles : réussie.
- Aperçu du jugement : les balises de mise en forme enregistrées sont restituées.
- Export Word : les tests contrôlent le XML pour le gras, l’italique, le souligné, la couleur, le surlignage, Arial 14 et les listes.
- Parcours fonctionnel historique dans l’application construite : 20 contrôles réussis sur 20, sans erreur de console inattendue.

## Résistance des dimensions et accessibilité

- Largeurs contrôlées : 1440, 1024, 768 et 390 pixels.
- Aucun débordement horizontal de la page aux quatre largeurs.
- À 390 pixels, le ruban reste sur deux lignes et se fait défiler horizontalement à l’intérieur de l’éditeur ; le contenu de la page ne déborde pas.
- La fenêtre de modification d’une règle passe sur une colonne à petite largeur et son contenu ne déborde pas.
- Chaque surface d’édition expose un rôle de zone de texte multiligne et un nom accessible repris du champ d’origine.
- Les boutons possèdent un intitulé ou une infobulle et les contrôles gardent un indicateur de focus visible.

## Chefs de demande du dossier — v0.3.47

- Capture de la liste : `qa-0.3.46-requests-switcher-viewport.png`.
- Capture de l’aperçu : `qa-0.3.46-request-preview-viewport.png`.
- Capture mobile corrigée : `qa-0.3.46-requests-mobile-fixed.png`.
- L’ancien état « Ouvert », qui ne déclenchait aucune action visible, est remplacé par « Aperçu » pour le chef de demande actif. « Ouvrir » reste disponible pour les autres chefs de demande.
- L’aperçu présente la demande, la règle de droit, les faits, la conséquence et le sens du délibéré tout en conservant la mise en forme riche nettoyée.
- Le basculement entre deux chefs de demande et la persistance après rechargement sont validés.
- À 375, 390, 768 et 1440 pixels, aucun débordement horizontal n’est présent. Sous 430 pixels, l’intitulé occupe une ligne complète et les deux actions restent contenues dessous.
- Les intitulés accessibles des actions sont actualisés immédiatement lorsqu’une requête est renommée.

## Passes de comparaison

- Passage 1 : la première intégration reproduisait Aptos 12 et les commandes demandées, mais un intitulé juridique très long provoquait un débordement horizontal. La grille et la liste des règles ont été corrigées.
- Passage 2 : à 390 pixels, le groupe de commandes de paragraphe débordait encore. Le ruban a été rendu défilable dans son propre cadre.
- Passage 3 : la comparaison combinée entre `Texte word.png` et l’application construite confirme la présence du réglage Aptos 12, des commandes de police, de paragraphe et de styles. Le texte riche d’essai est visible et aucune zone n’est coupée.

final result: passed
