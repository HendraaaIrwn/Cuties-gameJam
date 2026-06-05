import Phaser from "phaser";

export class EpilogueScene extends Phaser.Scene {
  private static readonly videoSrc = "assets/video/epilogue-scene.mp4";
  private static readonly fadeMs = 1200;
  private videoLayer: HTMLElement | null = null;

  constructor() {
    super("EpilogueScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#000000");
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    this.playVideoOverlay();
  }

  shutdown(): void {
    this.destroyVideoLayer();
  }

  private playVideoOverlay(): void {
    const root = document.getElementById("ui-root");
    if (!root) {
      this.startGameplayScene();
      return;
    }

    const layer = document.createElement("section");
    layer.className = "epilogue-video-layer";

    const video = document.createElement("video");
    video.src = EpilogueScene.videoSrc;
    video.preload = "auto";
    video.playsInline = true;
    video.controls = false;

    layer.appendChild(video);
    root.appendChild(layer);
    this.videoLayer = layer;

    requestAnimationFrame(() => layer.classList.add("is-visible"));

    video.addEventListener("ended", () => this.finishVideo(), { once: true });
    video.addEventListener("error", () => this.finishVideo(), { once: true });
    void video.play();
  }

  private finishVideo(): void {
    const layer = this.videoLayer;
    if (!layer) {
      this.startGameplayScene();
      return;
    }

    layer.classList.remove("is-visible");
    this.time.delayedCall(EpilogueScene.fadeMs, () => {
      this.destroyVideoLayer();
      this.startGameplayScene();
    });
  }

  private startGameplayScene(): void {
    this.scene.start("GameplayScene", { fadeInFromEpilogue: true });
  }

  private destroyVideoLayer(): void {
    this.videoLayer?.remove();
    this.videoLayer = null;
  }
}
