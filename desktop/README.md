# MOLDIUS — application de bureau

Une fenêtre Electron qui charge le serveur du jeu : sans barre de navigateur, plein écran
(F11 ou Alt+Entrée), micro et verrouillage de la souris autorisés pour le seul site du jeu,
page « serveur injoignable » qui réessaie toute seule, bouton « Quitter le jeu » sur l'accueil.

## Adresse du jeu

`scripts/prepare.mjs` l'écrit dans `app-config.json` avant chaque lancement ou empaquetage :
la variable `MOLDIUS_URL`, sinon `PUBLIC_URL` du `.env` du projet, sinon `http://localhost:5173`.
Hors serveur local, l'adresse doit être en `https`. Au lancement, `MOLDIUS_URL` la remplace aussi.

## Construire l'installateur Windows

Depuis Windows (PowerShell ou cmd), dans ce dossier :

```
set MOLDIUS_URL=https://adresse-du-jeu
npm install
npm run dist:win
```

L'installateur sort dans `release/MOLDIUS-Setup-<version>.exe`. Il n'est pas signé :
Windows SmartScreen avertit au premier lancement tant qu'aucun certificat n'est configuré.

## Tester sans fenêtre

`MOLDIUS_SMOKE_TEST=C:\chemin\capture.png` lance l'application cachée, photographie la page
au bout de 6 secondes et quitte.
