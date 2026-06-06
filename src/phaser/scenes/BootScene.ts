import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  async create(): Promise<void> {
    await document.fonts.load('16px "Pixelify Sans"').catch(() => undefined);
    this.scene.start("MenuScene");
  }
}
