import Phaser from "phaser";
import { assetManifest } from "../../assets/manifest";
import { NarrativeOverlay } from "../../ui/NarrativeOverlay";
import {
  createBedroomNightOverlay,
  createPlayer,
  drawRoom,
  preloadPlayerSprites,
  preloadRoomSprites,
} from "../view/proceduralRoom";

export class MenuScene extends Phaser.Scene {
  private static readonly startFadeMs = 700;
  private static readonly replayFadeInMs = 700;
  private static readonly laptopBlueLightPosition = { x: 280, y: 119 };
  private static readonly laptopBlueLightScale = 4.2;
  private static readonly laptopBlueLightAlpha = 0.68;
  private overlay?: NarrativeOverlay;
  private shouldFadeInFromPlayAgain = false;

  constructor() {
    super("MenuScene");
  }

  preload(): void {
    preloadRoomSprites(this);
    preloadPlayerSprites(this);
    this.load.image("room.bedroom.laptopBlueLight", assetManifest.rooms["room.bedroom.laptopBlueLight"]);
    this.load.image("ui.mail", assetManifest.ui["ui.mail"]);
    this.load.image("ui.mosque", assetManifest.ui["ui.mosque"]);
    this.load.video("epilogue-scene", "assets/video/epilogue-scene.mp4");
  }

  init(data: { fadeInFromPlayAgain?: boolean } = {}): void {
    this.shouldFadeInFromPlayAgain = data.fadeInFromPlayAgain === true;
  }

  create(): void {
    this.cameras.main.resetFX();
    this.createBedroomBackdrop();

    this.overlay = new NarrativeOverlay();
    this.overlay.showTitle(() => {
      this.overlay?.destroy();
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        let nextScene = "EpilogueScene";
        // if (import.meta.env.DEV) nextScene = "GameplayScene";
        this.scene.start(nextScene);
      });
      this.cameras.main.fadeOut(MenuScene.startFadeMs, 0, 0, 0);
    });

    if (this.shouldFadeInFromPlayAgain) {
      this.cameras.main.fadeIn(MenuScene.replayFadeInMs, 0, 0, 0);
    }
  }

  shutdown(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.tweens.killAll();
    this.shouldFadeInFromPlayAgain = false;
  }

  private createBedroomBackdrop(): void {
    const roomGraphics = this.add.graphics();
    drawRoom(this, roomGraphics, "bedroom");

    createBedroomNightOverlay(this, 0.72);

    this.add
      .image(
        MenuScene.laptopBlueLightPosition.x,
        MenuScene.laptopBlueLightPosition.y,
        "room.bedroom.laptopBlueLight",
      )
      .setOrigin(0, 0)
      .setScale(MenuScene.laptopBlueLightScale)
      .setAlpha(MenuScene.laptopBlueLightAlpha)
      .setDepth(517);

    const player = createPlayer(this)
      .setPosition(620, 492)
      .setTexture("player-down-0")
      .setDepth(515);

    this.tweens.add({
      targets: player,
      y: player.y - 2,
      duration: 920,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.createMenuNotification(742, 306, "ui.mail", 0);
    this.createMenuNotification(792, 252, "ui.mosque", 160);

    this.add.rectangle(480, 270, 960, 540, 0x080a11, 0.26).setDepth(700);
    this.add.rectangle(42, 270, 84, 540, 0x080a11, 0.42).setDepth(701);
  }

  private createMenuNotification(x: number, y: number, textureKey: string, delay: number): void {
    const shadow = this.add.rectangle(0, 9, 68, 44, 0x080a11, 0.46);
    const border = this.add.rectangle(0, 0, 74, 52, 0xfff6cf, 0.84);
    const panel = this.add.rectangle(0, 0, 66, 44, 0x151923, 0.92);
    const icon = this.add.image(0, 0, textureKey).setDisplaySize(34, 34);
    const bubble = this.add.container(x, y, [shadow, border, panel, icon]).setDepth(704);

    this.tweens.add({
      targets: bubble,
      y: y - 8,
      delay,
      duration: 820,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }
}
