import type { AssetManifest } from "../game/simulation/types";

export const assetManifest: AssetManifest = {
  characters: {
    "character.player": "/assets/characters/player/Sprite_0006.png",
    "character.player.walk.right.0": "/assets/characters/player/Sprite_0000.png",
    "character.player.walk.right.1": "/assets/characters/player/Sprite_0001.png",
    "character.player.walk.right.2": "/assets/characters/player/Sprite_0002.png",
    "character.player.walk.left.0": "/assets/characters/player/Sprite_0003.png",
    "character.player.walk.left.1": "/assets/characters/player/Sprite_0004.png",
    "character.player.walk.left.2": "/assets/characters/player/Sprite_0005.png",
    "character.player.walk.down.0": "/assets/characters/player/Sprite_0006.png",
    "character.player.walk.down.1": "/assets/characters/player/Sprite_0007.png",
    "character.player.walk.up.0": "/assets/characters/player/Sprite_0008.png",
    "character.player.walk.up.1": "/assets/characters/player/Sprite_0009.png",
    "npc.friend": "procedural/friend",
    "npc.parent": "procedural/parent",
    "npc.shadow": "procedural/shadow",
  },
  rooms: {
    "room.bedroom": "procedural/bedroom",
    "room.street": "procedural/street",
    "room.replay": "procedural/replay",
  },
  ui: {
    "ui.textbox": "dom/textbox",
    "ui.interact": "procedural/interact",
  },
  audio: {},
};
