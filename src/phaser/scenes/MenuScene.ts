import Phaser from "phaser";
import { NarrativeOverlay } from "../../ui/NarrativeOverlay";

export class MenuScene extends Phaser.Scene {
  private overlay?: NarrativeOverlay;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#151923");
    this.add.rectangle(480, 420, 960, 240, 0x1d2430);
    this.add.rectangle(216, 342, 190, 150, 0x2f3d4d);
    this.add.rectangle(512, 300, 246, 190, 0x243040);
    this.add.rectangle(770, 364, 120, 132, 0x0a0b10, 0.42);
    this.add.circle(160, 128, 48, 0xf0c36b, 0.86);

    this.overlay = new NarrativeOverlay();
    this.overlay.showTitle(() => {
      this.overlay?.destroy();
      this.scene.start("GameplayScene");
    });
  }

  shutdown(): void {
    this.overlay?.destroy();
  }
}
