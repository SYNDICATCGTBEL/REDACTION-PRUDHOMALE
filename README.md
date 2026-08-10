# Rédaction prud’homale

Version actuelle : 0.3.68

## Nouveautés de la version 0.3.68

- formules juridiques rapides adaptées à chaque zone de rédaction ;
- modèles de paragraphes pour la procédure, les prétentions, le syllogisme et le dispositif ;
- insertion à l’emplacement du curseur sans écraser le texte existant ;
- blocage de l’export tant qu’un repère `[À compléter : …]` subsiste.

## Nouveautés de la version 0.3.67

- sauvegardes locales atomiques, versions récentes et restauration de secours ;
- recherche dans tout le contenu, tri, duplication et historique des dossiers ;
- assistant de validation avant l’export Word ;
- prise en charge des dates françaises avec le mois en lettres ;
- correction des noms de parties doublés et des espaces de paragraphe ;
- titres du jugement centrés dans l’aperçu et dans Word ;
- lettre de licenciement conservée comme outil interne de rédaction et exclue du jugement ;
- première séparation de la gestion des dossiers et de la validation en modules testables.

L’éditeur propose également des formules juridiques rapides et des modèles de paragraphes adaptés à chaque partie du jugement. Les mentions entre crochets doivent être remplacées avant l’export ; l’assistant de validation bloque tout modèle resté incomplet.

## Signature interne Windows

La version interne peut être signée avec le certificat auto-signé « Syndicat CGT BEL » conservé dans le magasin de certificats du compte Windows de construction.

- Création initiale : `pwsh -NoProfile -File scripts/create-internal-certificate.ps1`
- Construction signée : `npm run dist:signed`
- Autorisation sur un autre ordinateur interne : copier le dossier `certificates` avec le script `scripts/install-internal-certificate.ps1`, puis exécuter ce script sous le compte Windows concerné.

La clé privée ne doit jamais être copiée dans le dépôt GitHub. Le fichier `.cer` est uniquement la partie publique et ne permet pas de signer un programme.

Application Electron locale pour organiser une rédaction de jugement en trois temps : « Exposé du litige », « Motifs de la décision » et « Par ces motifs ». L’exposé présente la procédure, les prétentions et les faits. Les motifs suivent le raisonnement juridique : chef de demande, règle de droit, « En l’espèce » et « En conséquence ». Toutes les zones de rédaction utilisent le même éditeur inspiré de Word : police et taille, gras, italique, soulignement, couleurs, surlignage, alignements, titres et listes. La mise en forme est sauvegardée localement et transmise à l’export Microsoft Word au format `.docx`. Une bibliothèque locale de 267 modèles de motivation, enrichie à partir des jugements Word et PDF fournis, permet de rechercher un thème et d’insérer le chef de demande et la règle de droit.

## Organisation du code

- `main.js` : fenêtre Electron, menus et opérations locales protégées par IPC.
- `index.html` : structure de l’écran et coordination du parcours de rédaction.
- `case-management.js` : recherche, classement et duplication des dossiers.
- `data-protection.js` : contrôle du format des sauvegardes avant chargement.
- `judgment-validation.js` : règles de complétude et de cohérence avant export.
- `validation-assistant.js` : présentation accessible des erreurs et avertissements.
- `rich-text.js` : comportement commun des éditeurs enrichis.
- `document-export.js` : création du document Word.

La logique métier doit être ajoutée dans un module dédié et testable, puis seulement reliée à l’interface depuis `index.html`.

## Lancer l’application

```powershell
npm install
npm start
```

## Créer l’installateur Windows (.exe)

```powershell
npm run dist
```

L’installateur NSIS est créé dans le dossier `dist`.

Les dossiers de travail sont sauvegardés localement dans les données de l’application (localStorage). Aucun contenu n’est envoyé sur Internet. Les noms du demandeur et du défendeur sont modifiables pour chaque dossier. Le bouton « Exporter Word » ouvre une fenêtre permettant de choisir le nom et l’emplacement du fichier `.docx`.

L’introduction de « Par ces motifs », les formules de clôture et la formule de prononcé du Conseil de prud’hommes de Lons-le-Saunier sont ajoutées automatiquement dans l’aperçu et le document Word. Les mentions de date, président et greffier sont modifiables dans le bloc « Formule ajoutée à la fin du jugement ». La date est saisie en chiffres (`JJ/MM/AAAA`) et apparaît en toutes lettres dans le jugement.
