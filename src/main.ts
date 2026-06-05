import Phaser from "phaser";
import "./style.css";
import { BootScene } from "./phaser/scenes/BootScene";
import { EpilogueScene } from "./phaser/scenes/EpilogueScene";
import { GameplayScene } from "./phaser/scenes/GameplayScene";
import { MenuScene } from "./phaser/scenes/MenuScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: "game-container",
  backgroundColor: "#151923",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  scene: [
    BootScene,
    MenuScene,
    EpilogueScene,
    GameplayScene,
  ],
};

new Phaser.Game(config);
