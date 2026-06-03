import Phaser from "phaser";
import type { Interactable, RoomId } from "../../game/simulation/types";

export type PlayerFacing = "right" | "left" | "up" | "down";

const playerFrames: Record<PlayerFacing, string[]> = {
  right: [
    "player-right-0",
    "player-right-1",
    "player-right-2",
    "player-right-3",
    "player-right-4",
    "player-right-5",
  ],
  left: ["player-left-0", "player-left-1", "player-left-2"],
  down: ["player-down-0", "player-down-1"],
  up: ["player-up-0", "player-up-1"],
};

const playerFiles: Record<string, string> = {
  "player-right-0": "/assets/characters/player/Sprite_00010.png",
  "player-right-1": "/assets/characters/player/Sprite_00011.png",
  "player-right-2": "/assets/characters/player/Sprite_00012.png",
  "player-right-3": "/assets/characters/player/Sprite_00013.png",
  "player-right-4": "/assets/characters/player/Sprite_00014.png",
  "player-right-5": "/assets/characters/player/Sprite_00015.png",
  "player-left-0": "/assets/characters/player/Sprite_0003.png",
  "player-left-1": "/assets/characters/player/Sprite_0004.png",
  "player-left-2": "/assets/characters/player/Sprite_0005.png",
  "player-down-0": "/assets/characters/player/Sprite_0006.png",
  "player-down-1": "/assets/characters/player/Sprite_0007.png",
  "player-up-0": "/assets/characters/player/Sprite_0008.png",
  "player-up-1": "/assets/characters/player/Sprite_0009.png",
};

export function preloadPlayerSprites(scene: Phaser.Scene): void {
  for (const [key, file] of Object.entries(playerFiles)) {
    scene.load.image(key, file);
  }
}

export function createPlayerAnimations(scene: Phaser.Scene): void {
  for (const [facing, frames] of Object.entries(playerFrames) as [PlayerFacing, string[]][]) {
    const key = `player-walk-${facing}`;
    if (scene.anims.exists(key)) {
      continue;
    }

    scene.anims.create({
      key,
      frames: frames.map((frameKey) => ({ key: frameKey })),
      frameRate: facing === "up" || facing === "down" ? 5 : 7,
      repeat: -1,
    });
  }
}

export function setPlayerIdle(player: Phaser.GameObjects.Sprite, facing: PlayerFacing): void {
  player.stop();
  player.setTexture(playerFrames[facing][0]);
}

export function playPlayerWalk(player: Phaser.GameObjects.Sprite, facing: PlayerFacing): void {
  player.play(`player-walk-${facing}`, true);
}

export function drawRoom(scene: Phaser.Scene, graphics: Phaser.GameObjects.Graphics, roomId: RoomId): void {
  graphics.clear();

  if (roomId === "bedroom") {
    drawBedroom(graphics);
  } else if (roomId === "street") {
    drawStreet(graphics);
  } else {
    drawReplay(graphics);
  }

  graphics.lineStyle(2, 0x0b0d13, 0.35);
  for (let x = 0; x <= 960; x += 24) {
    graphics.lineBetween(x, 0, x, 540);
  }
  for (let y = 0; y <= 540; y += 24) {
    graphics.lineBetween(0, y, 960, y);
  }

  scene.cameras.main.setBackgroundColor("#11151e");
}

export function createPlayer(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(0, 0, playerFrames.down[0]);
  sprite.setOrigin(0.5, 0.9);
  sprite.setScale(2.2);
  sprite.setDepth(20);
  return sprite;
}

export function createInteractableView(
  scene: Phaser.Scene,
  interactable: Interactable,
): Phaser.GameObjects.Container {
  const pieces: Phaser.GameObjects.GameObject[] = [];
  const labelY = interactable.kind === "object" ? -48 : -64;

  if (interactable.kind === "npc") {
    pieces.push(...createNpcPieces(scene, interactable.id));
  } else if (interactable.kind === "shadow") {
    pieces.push(...createShadowPieces(scene));
  } else {
    const objectPieces = createObjectPieces(scene, interactable.id);
    scalePieces(objectPieces, 0.72);
    pieces.push(...objectPieces);
  }

  const label = scene.add
    .text(0, labelY, interactable.label, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fff6cf",
      backgroundColor: "rgba(14,16,24,0.72)",
      padding: { x: 5, y: 3 },
    })
    .setOrigin(0.5);

  pieces.push(label);

  const container = scene.add.container(interactable.x, interactable.y, pieces);
  container.setDepth(interactable.y);
  return container;
}

export function setInteractableHighlighted(
  container: Phaser.GameObjects.Container,
  highlighted: boolean,
): void {
  container.setScale(highlighted ? 1.05 : 1);
  container.setAlpha(highlighted ? 1 : 0.88);
}

function scalePieces(pieces: Phaser.GameObjects.GameObject[], scale: number): void {
  for (const piece of pieces) {
    const target = piece as Phaser.GameObjects.GameObject & {
      x?: number;
      y?: number;
      setScale?: (x: number, y?: number) => unknown;
    };

    if (typeof target.x === "number") {
      target.x *= scale;
    }

    if (typeof target.y === "number") {
      target.y *= scale;
    }

    target.setScale?.(scale);
  }
}

function drawBedroom(graphics: Phaser.GameObjects.Graphics): void {
  graphics.fillStyle(0x202838).fillRect(0, 0, 960, 540);
  graphics.fillStyle(0x2f3d4d).fillRect(0, 0, 960, 316);
  graphics.fillStyle(0x445267).fillRect(58, 74, 260, 142);
  graphics.fillStyle(0x111722).fillRect(72, 88, 232, 108);
  graphics.fillStyle(0xe7a55f).fillRect(124, 120, 64, 34);
  graphics.fillStyle(0x293544).fillRect(84, 336, 246, 76);
  graphics.fillStyle(0x7591a0).fillRect(112, 300, 164, 48);
  graphics.fillStyle(0x7c4d3c).fillRect(436, 354, 214, 28);
  graphics.fillStyle(0x51352e).fillRect(456, 382, 24, 76);
  graphics.fillStyle(0x51352e).fillRect(610, 382, 24, 76);
  graphics.fillStyle(0x181c25).fillRect(514, 304, 72, 50);
  graphics.fillStyle(0x8bb2c4).fillRect(522, 312, 56, 30);
  graphics.fillStyle(0x5d6f72).fillRect(680, 124, 78, 110);
  graphics.fillStyle(0xe4d6ad).fillRect(696, 140, 46, 14);
  graphics.fillStyle(0x263342).fillRect(0, 414, 960, 126);
  graphics.fillStyle(0x1b2430).fillRect(0, 454, 960, 86);
}

function drawStreet(graphics: Phaser.GameObjects.Graphics): void {
  graphics.fillStyle(0x171b28).fillRect(0, 0, 960, 540);
  graphics.fillStyle(0x263447).fillRect(0, 0, 960, 312);
  graphics.fillStyle(0x10151f).fillRect(0, 312, 960, 228);
  graphics.fillStyle(0x3b4d62).fillRect(40, 132, 160, 178);
  graphics.fillStyle(0x2d3f4f).fillRect(248, 78, 194, 232);
  graphics.fillStyle(0x4b566b).fillRect(680, 116, 166, 194);
  graphics.fillStyle(0xe7a55f);
  for (const x of [74, 118, 288, 336, 720, 770]) {
    graphics.fillRect(x, 158, 24, 32);
  }
  graphics.fillStyle(0x677986).fillRect(0, 408, 960, 26);
  graphics.fillStyle(0xe7d18a).fillRect(82, 420, 64, 5);
  graphics.fillStyle(0xe7d18a).fillRect(242, 420, 64, 5);
  graphics.fillStyle(0xe7d18a).fillRect(402, 420, 64, 5);
  graphics.fillStyle(0x704f43).fillRect(744, 338, 110, 52);
  graphics.fillStyle(0x1d2330).fillRect(772, 304, 54, 34);
}

function drawReplay(graphics: Phaser.GameObjects.Graphics): void {
  graphics.fillStyle(0x080910).fillRect(0, 0, 960, 540);
  graphics.fillStyle(0x151923).fillRect(0, 328, 960, 212);
  graphics.fillStyle(0x293448, 0.7).fillRect(84, 112, 210, 210);
  graphics.fillStyle(0x314957, 0.64).fillRect(378, 82, 206, 240);
  graphics.fillStyle(0x4a394e, 0.62).fillRect(670, 120, 190, 202);
  graphics.lineStyle(3, 0xfff6cf, 0.25);
  graphics.strokeRect(84, 112, 210, 210);
  graphics.strokeRect(378, 82, 206, 240);
  graphics.strokeRect(670, 120, 190, 202);
}

function createNpcPieces(scene: Phaser.Scene, id: string): Phaser.GameObjects.GameObject[] {
  const shirt = id.includes("parent") || id.includes("replay-parent") ? 0x477060 : 0xb84f61;
  return [
    scene.add.rectangle(0, 38, 22, 22, 0x252a35),
    scene.add.rectangle(0, 12, 28, 38, shirt),
    scene.add.rectangle(0, -16, 24, 24, 0xd7aa83),
    scene.add.rectangle(0, -26, 26, 10, 0x3b2830),
    scene.add.rectangle(-6, -14, 3, 3, 0x151923),
  ];
}

function createShadowPieces(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  return [
    scene.add.rectangle(0, 28, 30, 44, 0x0a0b10, 0.68),
    scene.add.rectangle(0, -14, 28, 28, 0x0a0b10, 0.72),
    scene.add.rectangle(0, 54, 52, 8, 0x0a0b10, 0.34),
  ];
}

function createObjectPieces(scene: Phaser.Scene, id: string): Phaser.GameObjects.GameObject[] {
  if (id === "calendar") {
    return [
      scene.add.rectangle(0, 0, 48, 56, 0xf0c36b),
      scene.add.rectangle(0, -16, 48, 12, 0xb84f61),
      scene.add.rectangle(-10, 8, 6, 6, 0x2f3d4d),
      scene.add.rectangle(10, 8, 6, 6, 0x2f3d4d),
    ];
  }

  if (id === "mirror") {
    return [
      scene.add.rectangle(0, 0, 42, 76, 0x5d6f72),
      scene.add.rectangle(0, 0, 28, 58, 0x9fb5bd),
    ];
  }

  if (id === "parent-call") {
    return [
      scene.add.rectangle(0, 10, 28, 46, 0x242a36),
      scene.add.rectangle(0, 0, 20, 28, 0x8bb2c4),
      scene.add.circle(0, 28, 4, 0xf0c36b),
    ];
  }

  return [
    scene.add.rectangle(0, 22, 76, 30, 0x7c4d3c),
    scene.add.rectangle(0, -8, 52, 36, 0x181c25),
    scene.add.rectangle(0, -12, 40, 20, 0x8bb2c4),
  ];
}
