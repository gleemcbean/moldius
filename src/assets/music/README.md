# Musiques d'ambiance

Le jeu joue en boucle un fichier audio de ce dossier, avec un fondu enchaîné quand on passe du menu à la partie.

## Ajouter une musique

1. Déposez le fichier dans ce dossier (`.ogg`, `.opus`, `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac` ou `.webm`).
2. Nommez-le d'après l'endroit où il doit jouer :
   - `menu.ogg` : écran d'accueil, lobby, chargement et résultats ;
   - `game.ogg` : pendant la partie ;
   - `ambient.ogg` : piste de secours, utilisée quand `menu` ou `game` manque.
3. Relancez `npm run dev` (ou reconstruisez) : rien d'autre à faire.

Sans réglage, la piste entière boucle : le dernier échantillon enchaîne sur le premier. Pour une boucle propre, exportez un fichier dont la fin se raccorde exactement au début (sans silence de fin).

## Réglages facultatifs : `music.json`

```json
{
	"game": { "loopStart": 12.5, "loopEnd": 140, "volume": 0.8 }
}
```

- `loopStart` / `loopEnd` (secondes) : le morceau joue une fois son introduction, puis boucle entre ces deux instants.
- `volume` : multiplie le niveau de la piste (1 par défaut), utile pour équilibrer deux morceaux mixés différemment.

Le curseur « Musique » des paramètres règle le volume général par-dessus.

## Musique synthétisée provisoire

`ambient.ogg` est générée par `npm run export:music` (script `scripts/export-music.ts`) à partir des accords et notes de `scripts/sounds/recipes/musicSounds.ts`. Ce script réécrit `ambient.ogg` et son entrée dans `music.json`, sans toucher aux autres pistes. Pour la remplacer par une vraie musique, déposez simplement un `menu.ogg` et un `game.ogg` : ils passent devant `ambient.ogg`.
