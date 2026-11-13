# Pont Discord (Social SDK)

Le Discord Social SDK n'existe qu'en C++ : ce petit programme le charge pour
l'application de bureau. Electron le lance (`desktop/discord.cjs`) et lui parle
par lignes JSON sur stdin/stdout. Sans lui, l'application marche sans Discord.

Il apporte :

- **la présence** : « Dans le lobby », « En partie », taille du groupe, chrono ;
- **« Rejoindre » sur Discord** pour un lobby public, ou privé ouvert aux amis.
  Le secret de présence est l'identifiant du lobby, jamais son code : le serveur
  vérifie que celui qui rejoint est ami avec l'hôte. Jeu fermé, Discord le lance ;
- **les amis Discord** : la liste est envoyée au serveur, qui ne lie deux comptes
  que si chacun a déclaré l'autre (personne ne peut se dire l'ami d'un autre) ;
- **les invitations Discord** depuis la fenêtre Amis.

## Portail développeur Discord

Sur l'application dont l'identifiant est `DISCORD_CLIENT_ID` (celle de la
connexion Discord du site) :

1. **Discord Social SDK → Getting Started** : activer le Social SDK.
2. **OAuth2** : activer **Public Client** (le pont échange le code sans secret)
   et ajouter la redirection `http://127.0.0.1/callback`.
3. **Discord Social SDK → Downloads** : télécharger le SDK C++.

Rien à téléverser dans **Rich Presence → Art Assets** : la présence donne
directement l'adresse des images de `src/features/discord/art/`, servies par le
jeu, et Discord les récupère tant que le jeu est joignable en `https`. Elles se
régénèrent avec `scripts/mode-art.html` (`npm run dev:client`, puis
`/scripts/mode-art.html`).

## Compiler (Windows)

Demande CMake et Visual Studio 2022 (charge « Développement Desktop en C++ »).

1. Décompresser le SDK pour obtenir `discord-bridge/sdk/discord_social_sdk/`
   (`include/discordpp.h`, `lib/release/`, `bin/release/`).
2. Depuis `desktop/` : `npm run bridge:build`.

Le programme et `discord_partner_sdk.dll` arrivent dans `discord-bridge/dist/`,
que `npm run dist:win` embarque dans l'installateur (`resources/discord/`).

L'identifiant d'application vient de `MOLDIUS_DISCORD_APP_ID`, sinon de
`DISCORD_CLIENT_ID` dans le `.env` du projet ; `scripts/prepare.mjs` l'écrit dans
`app-config.json`.

## Les amis Discord dans le jeu

Le joueur clique sur « Connecter Discord » dans la fenêtre Amis. Ses amis Discord
apparaissent dans sa liste dès que **les deux** :

- ont un compte Moldius lié au même compte Discord que celui de l'application ;
- se sont connectés à Discord au moins une fois depuis l'application de bureau.

Une amitié Discord ne se retire pas depuis le jeu : elle suit Discord.
