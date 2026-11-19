# Guide d'utilisation des modèles `.glb` dans Moldius

Ce dossier contient les **243 modèles 3D** du jeu exportés au format binaire `.glb` (avec leurs textures PBR exactes déjà embarquées et des **placeholders `dyn_*`** pour tout ce qui change dynamiquement en partie).

L'inventaire complet (chemins, dimensions `bbox`, pivots d'animation, matériaux `dyn_*`) est disponible dans `models/manifest.json`.

---

## 1. Rendre le dossier accessible au client Vite

Aujourd'hui, les `.glb` sont dans `models/` à la racine du dépôt. Pour que le jeu puisse les télécharger via `fetch` / `GLTFLoader` en dev comme en build :

1. **Option la plus simple (recommandée)** : déplacer (ou copier) `models/` vers `public/models/`. Ils seront alors servis automatiquement sur `/models/...` par Vite (`npm run dev`), Express (`npm start`) et Electron.
2. **Alternative** : garder `models/` à la racine et ajouter un import statique Vite ou un plugin/middleware qui sert `/models`.

---

## 2. Charger et cloner un `.glb` avec `GLTFLoader`

Three.js fournit déjà `GLTFLoader` et `SkeletonUtils` dans `three/addons/`. Crée un petit cache asynchrone (ex. `src/features/models/glbCache.ts`) pour ne charger chaque `.glb` qu'une seule fois en mémoire, puis clone-le à la demande :

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

export function loadGlbTemplate(relPath: string): Promise<THREE.Group> {
	let pending = cache.get(relPath);
	if (!pending) {
		pending = loader.loadAsync(`/models/${relPath}`).then((gltf) => gltf.scene);
		cache.set(relPath, pending);
	}
	return pending;
}

export async function spawnGlb(relPath: string): Promise<THREE.Group> {
	const template = await loadGlbTemplate(relPath);
	const instance = template.clone(true);
	// Cloner les matériaux uniquement sur les meshes dynamiques pour éviter de teinter tous les clones
	instance.traverse((obj) => {
		if (obj instanceof THREE.Mesh && !Array.isArray(obj.material)) {
			if (obj.material.name.startsWith("dyn_")) {
				obj.material = obj.material.clone();
			}
		}
	});
	return instance;
}
```

> **Astuce chargement :** Appelle `Promise.all(...)` pour précharger les `.glb` utiles pendant `SessionLoader` (l'écran de chargement de la partie) avant que la scène ne commence.

---

## 3. Remplacer chaque ancien générateur procédural

Voici la correspondance exacte entre ce qui était généré en code et le `.glb` correspondant :

| Dossier `.glb` | Remplace dans le code actuel | Détails |
|---|---|---|
| `furniture/<kind>.glb` (205 fichiers) | `FURNITURE_BUILDERS` dans `src/features/world/furniture/index.ts` et `ManorMeshBuilder.addFurniture()` (`src/features/world/ManorMeshBuilder.ts`) | Certains meubles ont une variante de forme (ex. `table_round.glb`). Pour les autres tailles du catalogue (`furnitureCatalog.ts`), adapte l'échelle à partir de `bbox` (voir §4). |
| `anomalies/<species>.glb` (15 fichiers) | `createAnomalyModel()` (`src/features/models/anomalies/createAnomalyModel.ts`) | Conserve les groupes/pivots nommés (`hips`, `torso`, `head`, `cap`, `hip`, `knee`, `ankle`, `shoulder`, `elbow`…). |
| `player/mushroom.glb` | `MushroomModel` (`src/features/models/MushroomModel.ts`) | Utilisé dans `RemotePlayers.ts`, `HomeScene.ts` et `DoubleModel`. |
| `player/first_person_body.glb` | `FirstPersonBody` (`src/features/engine/player/FirstPersonBody.ts`) | Torse + jambes/bottes vus quand on baisse la caméra. |
| `player/first_person_arms.glb` | `createArm()` dans `FirstPersonRig` (`src/features/engine/player/FirstPersonRig.ts`) | Contient `left_arm` et `right_arm` avec matériau `dyn_fp_arm_skin`. |
| `tools/lantern.glb` | `LanternModel` (`src/features/models/LanternModel.ts`) | Remplace les placeholders de verre/flamme pour les teintes débloquables. |
| `tools/camera.glb` | `createCameraModel()` (`src/features/models/cameraModel.ts`) | Remplace `dyn_camera_screen` et `dyn_camera_flash`. |
| `tools/walkie.glb` | `createWalkieModel()` (`src/features/models/walkieModel.ts`) | Remplace `dyn_walkie_display`. |
| `tools/grimoire.glb` | `GrimoireModel` (`src/features/grimoire/GrimoireModel.ts`) | Remplace les 2 pages courbes `dyn_grimoire_page_left` / `dyn_grimoire_page_right`. |
| `occult/<id>.glb` (6 fichiers) | `createOccultModel()` (`src/features/models/occultModels.ts`) | Utilisé en main (`FirstPersonRig`), dans `MushroomModel` et les icônes (`objectArt.ts`). |
| `pickups/<id>.glb` (6 fichiers) | `createMaterialModel()` + `PickupViews` (`src/features/engine/world/PickupViews.ts`) | 1 `.glb` par `MaterialId` (`amethyst`, `ruby`, `jade`, `mirror`, `brass`, `bone`). |
| `world/door.glb` & `world/door_3panel.glb` | `DoorViews.buildDoor()` (`src/features/engine/world/DoorViews.ts`) | Le pivot `(0, 0, 0)` est **déjà** sur l'axe des gonds. Utilise `door_3panel.glb` quand `style === 2`. |
| `world/altar_book.glb` | `AltarViews.buildBook()` (`src/features/engine/world/AltarViews.ts`) | Remplace `dyn_altar_page_left` / `dyn_altar_page_right`. |
| `world/stake_orb.glb` | `StakeViews` (`src/features/engine/world/StakeViews.ts`) | Remplace `dyn_stake_orb` par la couleur `STAKE_COLORS[stake.kind]`. |

> **Note :** Les murs, sols, plafonds, escaliers, mezzanines et fenêtres du manoir (`ManorMeshBuilder.ts`) suivent une géométrie par salle qui dépend du plan généré ; ils restent donc procéduraux.

### Correspondance des noms d'anomalies (Bestiaire)

Les 15 espèces du bestiaire (`SPECIES_IDS` dans `shared/config/species.ts`) sont nommées d'après leur `id` technique (directement utilisé par `createAnomalyModel(species)`). Voici les correspondances lorsque l'`id` diffère du nom affiché en jeu :

| Fichier `.glb` (`id`) | Nom en jeu (`name`) | Classe 3D |
|---|---|---|
| `veilleur.glb` | Le Réverbère | `ReverbereModel` |
| `crache-cendre.glb` | Le Brasier | `BrasierModel` |
| `luciole.glb` | Le Feu follet | `FeuFolletModel` |
| `double.glb` | Le Doppelgänger | `DoubleModel` |
| `gorgone.glb` | La Pleureuse | `PleureuseModel` |
| `rat-roi.glb` | Le Roi de rats | `RatRoiModel` |

Les 9 autres (`murmure`, `collecteur`, `archiviste`, `hurleur`, `suinteur`, `boursoufle`, `colosse`, `fulgurant`, `brume`) ont le même nom technique et en jeu.

---

## 4. Adapter la taille des meubles & portes

Comme il y a **1 `.glb` canonique par type** (sauf forme distincte comme `table_round.glb`), si un `FurnitureItem` ou une `Opening` de porte a des dimensions (`item.width`, `item.height`, `item.depth`) différentes de la taille exportée :

```ts
const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3());
model.scale.set(
	item.width / Math.max(0.01, size.x),
	item.height / Math.max(0.01, size.y),
	item.depth / Math.max(0.01, size.z),
);
```

Pour les portes (`DoorViews`), la largeur est `geometry.panelLength` et la hauteur `geometry.panelHeight` (le pivot gond est déjà en `x = 0, y = 0, z = 0`).

---

## 5. Rebrancher les placeholders dynamiques (`dyn_*`) au runtime

Tous les éléments variables du jeu ont un matériau nommé `dyn_*`. Parcours le modèle cloné et applique les vraies textures / couleurs de `TextureLibrary` / `MaterialLibrary` / `CanvasTexture` :

```ts
function replaceDynamicMaterial(
	root: THREE.Object3D,
	slotName: string,
	replacement: THREE.Material | ((mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) => void),
): void {
	root.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		if (obj.material.name !== slotName) return;
		if (typeof replacement === "function") {
			replacement(obj.material);
		} else {
			obj.material = replacement;
		}
	});
}
```

### Tableau de correspondance complet des slots `dyn_*`

| Nom du matériau (`dyn_*`) | Quoi injecter au runtime | Où trouver la valeur dans le code |
|---|---|---|
| `dyn_player_cap` | Matériau avec `texture: capTextureFor(color, pattern)` | `MushroomModel.ts` / `creatureTextures.ts` |
| `dyn_lantern_glass` | Couleur `LANTERN_TINT_COLORS[lantern]` (opacité `0.22`) | `LanternModel.ts` / `shared/rewards.ts` |
| `dyn_lantern_flame` | Texture `"flame"` ou `"flameNeutral"` + teinte | `LanternModel.ts` |
| `dyn_fp_arm_skin` | Teinte dynamique selon lanterne/aura (`ARM_DARK` ↔ `ARM_LIT`) | `FirstPersonRig.ts` (`updateArmTones`) |
| `dyn_grimoire_page_left` / `right` | `CanvasTexture` générée par `pageRenderer.ts` (`setPages`) | `GrimoireModel.ts` / `GrimoireController.ts` |
| `dyn_camera_screen` | `screenTexture` (`RenderTarget` / `PhotoCamera`) | `cameraModel.ts` / `PhotoCamera.ts` |
| `dyn_camera_flash` | Couleur `0xffffff` pendant le flash sinon `0xd8dde4` | `FirstPersonRig.ts` |
| `dyn_walkie_display` | Émissif vert actif quand le talkie transmet | `walkieModel.ts` |
| `dyn_altar_page_left` / `right` | `CanvasTexture` `pageCanvas(...)` | `AltarViews.ts` |
| `dyn_stake_orb` | `STAKE_COLORS[stake.kind]` (intensité réduite si en cooldown) | `StakeViews.ts` |
| `dyn_veilleur_beam` | Couleur calme / alerte + opacité / `alphaMap` `beamFadeTexture()` | `bipeds.ts` (`ReverbereModel`) |
| `dyn_anomaly_emissive` (`_1`…`_4`) | Couleur / intensité émissive d'attaque ou d'alerte | `AnomalyModel` (`DoubleModel`, `BrasierModel`, `ColosseModel`, `ArchivisteModel`, etc.) |
| `dyn_wood_variant` | Un matériau choisi via `SeededRandom(item.seed)` parmi `WOODS` ou `DOOR_WOODS` | `parts.ts` (`pickWood`) / `DoorViews.ts` |
| `dyn_velvet_variant` | `velvetRed` / `velvetGreen` / `velvetBlue` / `velvetPurple` / `linen` | `tables.ts`, `hiding.ts`, `extras.ts` |
| `dyn_stone_variant` | Un matériau de `CARVED_STONES` / `CAST_STATUARY` | `parts.ts` (`pickCarved`, `pickStatuary`) |
| `dyn_painting_variant` | Un tableau parmi `PAINTINGS` (`paintingLandscape`, etc.) | `fixtures.ts`, `extras.ts` |
| `dyn_rug_variant` | `rugPersian` / `rugBlue` / `rugGreen` | `props.ts` |
| `dyn_color_tint` | Teinte aléatoire (`FLOWER_COLORS`, `POTION_COLORS`, livres, etc.) | `props.ts`, `storage.ts`, `garden.ts` |

---

## 6. Conserver les animations sur les modèles exportés

Les hiérarchies d'animation n'ont pas été aplaties lors de l'export :

- **Meubles animés** (`chandelier`, `hangingLantern`, `rockingChair`, moulins/pendules, etc.) : les parties mobiles sont regroupées dans des nœuds `THREE.Group` nommés `anim_swing_<index>` ou `anim_spin_<index>`, placés sur leur point de pivot exact. Il suffit de récupérer `model.getObjectByName("anim_swing_0")` et de le passer à `DecorAnimator` (ou d'animer sa rotation sur son axe local).
- **Joueur & Anomalies** : retrouve les pivots par `model.getObjectByName(...)` (ex. `hips`, `torso`, `head`, `cap`, `pelvis`, `neck`, `lamp`, `hip`, `knee`, `ankle`, `shoulder`, `elbow`) pour appliquer exactement les mêmes rotations/positions que dans `MushroomModel.update()` et `AnomalyModel.update()`.

> **Attention si tu modifies un `.glb` dans Blender :** Garde exactement les noms des matériaux `dyn_*` et des objets pivots (`anim_*`, `hips`, `cap`, `head`, etc.) pour que le code continue de les reconnaître automatiquement.

---

## 7. Ré-exporter les `.glb` après une modification du code procédural

Si un modèle ou une texture procédurale change dans `src/`, régénère tout le dossier avec :

```bash
npm run export:glb
```
