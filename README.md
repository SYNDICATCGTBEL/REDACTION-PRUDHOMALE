# Rédaction prud’homale

Version actuelle : 0.3.58

Application Electron locale pour organiser une rédaction de jugement en trois temps : « Exposé du litige », « Motifs de la décision » et « Par ces motifs ». L’exposé présente la procédure, les prétentions et les faits. Les motifs suivent le raisonnement juridique : chef de demande, règle de droit, « En l’espèce » et « En conséquence ». Toutes les zones de rédaction utilisent le même éditeur inspiré de Word : police et taille, gras, italique, soulignement, couleurs, surlignage, alignements, titres et listes. La mise en forme est sauvegardée localement et transmise à l’export Microsoft Word au format `.docx`. Une bibliothèque locale de 267 modèles de motivation, enrichie à partir des jugements Word et PDF fournis, permet de rechercher un thème et d’insérer le chef de demande et la règle de droit.

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
