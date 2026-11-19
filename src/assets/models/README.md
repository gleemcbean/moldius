# Modèles `.glb` de Moldius

Ce dossier contient tous les modèles 3D chargés par le jeu. Ils sont générés depuis le code des constructeurs dans `scripts/models/` puis chargés au lancement par `modelLibrary` (`src/features/models/ModelLibrary.ts`). Le jeu ne fabrique plus aucune géométrie de modèle au runtime : seuls les murs, sols, plafonds et escaliers du manoir restent construits selon le plan généré.

L'inventaire (chemin, taille, nœuds nommés, `bbox`) est dans `manifest.json`.

## Régénérer

```bash
npm run export:assets
```

Cette commande exporte d'abord les textures (`npm run export:textures` → `src/assets/textures/`), puis les modèles (`npm run export:glb` → ce dossier). Les modèles référencent les textures par nom : il faut exporter les textures avant les modèles.

## Organisation

| Dossier | Contenu | Utilisé par |
|---|---|---|
| `anomalies/<espèce>.glb` | Les 15 anomalies (`veilleur`, `crache-cendre`, `gorgone`…), `double.glb` ne contient que les crocs, griffes et yeux greffés sur le champignon | `createAnomalyModel()` |
| `player/` | `mushroom.glb`, `first_person_body.glb`, `first_person_arms.glb` | `MushroomModel`, `FirstPersonBody`, `FirstPersonRig` |
| `tools/` | `lantern.glb`, `camera.glb`, `walkie.glb`, `grimoire.glb` | `LanternModel`, `createCameraModel()`, `createWalkieModel()`, `GrimoireModel` |
| `occult/`, `pickups/` | Objets occultes et matériaux ramassables | `createOccultModel()`, `createMaterialModel()` |
| `world/` | `door.glb`, `door_3panel.glb`, `altar_book.glb`, `stake_orb.glb` | `DoorViews`, `AltarViews`, `StakeViews` |
| `furniture/<type>[_v<n>].glb` | Une variante du catalogue par fichier, plus `stoneSlab.glb` en secours | `furnitureParts()` dans `ManorMeshBuilder` |

## Conventions lues par le jeu

- **Nœuds nommés** : le code d'animation retrouve les pivots par leur nom unique (`hips`, `cap`, `hip_0`, `knee_1`, `flame_2`…). Un modèle retouché dans Blender doit garder ces noms.
- **Matériaux** : chaque matériau porte dans ses `extras` les options `surface` du jeu (`texture`, `color`, `roughness`…). Le jeu reconstruit ses propres matériaux (ombrage pixel, relief, vagues des flammes) à partir de ces options ; les images référencées pointent vers `../../textures/` pour l'affichage dans un éditeur.
- **Matériaux propres à l'instance** : `extras.owned` (couleur animée d'une anomalie) et `extras.slot` (bois des portes selon leur style) sont remplacés au runtime.
- **Visibilité et rotations** : `extras.hidden`, `extras.euler` et `extras.renderOrder` restituent l'état exact de construction (ordre d'Euler compris).
- **Meubles** :
  - `extras.reference` donne les dimensions d'export ; les morph targets `width`, `height`, `depth`, `top` (distance au plafond) et `bottom` (distance au sol) adaptent le meuble à la taille demandée et à la hauteur de la pièce (conduits de cheminée, tuyaux, rideaux).
  - `sample_<n>` : plusieurs tirages de géométrie pour les meubles dont la forme est aléatoire (livres, plantes…).
  - `extras.palette` + `choices` : variantes de matériaux tirées selon la graine du meuble ; `bind` lie un matériau à la pièce (pierre sculptée, sol, chapelle).
  - Les groupes `anim` portent pivot, axe, vitesse et amplitude pour `DecorAnimator` ; les groupes `when` ne s'affichent que sous condition (pas de rideaux en serre).
