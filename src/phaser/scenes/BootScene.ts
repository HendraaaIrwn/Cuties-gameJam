import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  async create(): Promise<void> {
    await Promise.all([
      document.fonts.load('400 16px "Pixelify Sans"'),
      document.fonts.load('900 32px "Pixelify Sans"'),
      document.fonts.ready,
    ]).catch(() => undefined);
    this.scene.start("MenuScene");
  }
}
