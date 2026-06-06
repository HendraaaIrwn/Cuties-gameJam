import Phaser from "phaser";
import { assetManifest } from "../../assets/manifest";
import { NarrativeOverlay } from "../../ui/NarrativeOverlay";
import {
  createPlayer,
  createPlayerAnimations,
  playPlayerWalk,
  preloadPlayerSprites,
  setPlayerIdle,
} from "../view/proceduralRoom";

type FinalMemoryPhase =
  | "intro"
  | "walking"
  | "waitingMemory"
  | "memoryDialogue"
  | "ending"
  | "done";

type FinalMemoryDefinition = {
  textureKey: string;
  dialogueId: string;
  worldX: number;
};

type FinalMemoryView = {
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  promptTarget: Phaser.GameObjects.Zone;
  definition: FinalMemoryDefinition;
  completed: boolean;
};

export class FinalMemoryScene extends Phaser.Scene {
  private static readonly introBlackToWhiteFadeMs = 1800;
  private static readonly introWhiteHoldMs = 900;
  private static readonly playerFadeInMs = 1200;
  private static readonly playerStartPosition = { x: 106, y: 500 };
  private static readonly playerScale = 3;
  private static readonly playerCenterX = 330;
  private static readonly walkSpeed = 136;
  private static readonly worldScrollSpeed = 168;
  private static readonly memoryFrameSize = { width: 360, height: 360 };
  private static readonly memoryImageSize = 320;
  private static readonly memoryStopScrollPadding = 160;
  private static readonly memoryStopX = 660;
  private static readonly memoryY = 270;
  private static readonly playerFadeOutMs = 1300;
  private static readonly theEndDelayMs = 900;
  private static readonly theEndFadeMs = 900;
  private static readonly playAgainFadeOutMs = 700;
  private static readonly finalMemoryVolume = 0.62;
  private static readonly memories: FinalMemoryDefinition[] = [
    {
      textureKey: "ending.family",
      dialogueId: "final-memory-family-1",
      worldX: 1360,
    },
    {
      textureKey: "ending.friends",
      dialogueId: "final-memory-friends-1",
      worldX: 2260,
    },
    {
      textureKey: "ending.praying",
      dialogueId: "final-memory-praying-1",
      worldX: 3160,
    },
  ];

  private overlay?: NarrativeOverlay;
  private player?: Phaser.GameObjects.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private finalMemorySound?: Phaser.Sound.BaseSound;
  private memoryViews: FinalMemoryView[] = [];
  private phase: FinalMemoryPhase = "intro";
  private worldScroll = 0;
  private activeMemoryIndex = 0;

  constructor() {
    super("FinalMemoryScene");
  }

  preload(): void {
    preloadPlayerSprites(this);
    this.load.image("ending.family", assetManifest.endings["ending.family"]);
    this.load.image("ending.friends", assetManifest.endings["ending.friends"]);
    this.load.image("ending.praying", assetManifest.endings["ending.praying"]);
    this.load.audio("bgm.finalMemory", assetManifest.audio["bgm.finalMemory"]);
  }

  create(): void {
    this.phase = "intro";
    this.worldScroll = 0;
    this.activeMemoryIndex = 0;
    this.memoryViews = [];
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor("#ffffff");
    this.add.rectangle(480, 270, 960, 540, 0xffffff).setDepth(-100);
    this.overlay = new NarrativeOverlay();
    this.overlay.mountDialogueOnly();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keyD = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyE = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    createPlayerAnimations(this);
    this.player = createPlayer(this);
    this.player.setPosition(
      FinalMemoryScene.playerStartPosition.x,
      FinalMemoryScene.playerStartPosition.y,
    );
    this.player.setScale(FinalMemoryScene.playerScale);
    this.player.setAlpha(0);
    setPlayerIdle(this.player, "right");
    this.startFinalMemorySound();

    this.memoryViews = FinalMemoryScene.memories.map((definition) =>
      this.createMemoryView(definition),
    );
    this.refreshMemoryPositions();
    this.startBlackToWhiteTransition();
  }

  update(_: number, delta: number): void {
    if (!this.player || this.phase === "intro" || this.phase === "memoryDialogue") {
      return;
    }

    if (this.phase === "waitingMemory") {
      this.stopPlayerWalk();
      if (this.isInteractPressed()) {
        this.startActiveMemoryDialogue();
      }
      return;
    }

    if (this.phase === "walking") {
      this.updateWalking(delta / 1000);
      this.checkMemoryStop();
      this.checkEndingReached();
    }
  }

  shutdown(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.stopFinalMemorySound();
    this.time.removeAllEvents();
    this.tweens.killAll();
  }

  private startBlackToWhiteTransition(): void {
    const fade = this.add.rectangle(480, 270, 960, 540, 0x000000)
      .setDepth(1000)
      .setAlpha(1);

    this.tweens.add({
      targets: fade,
      alpha: 0,
      duration: FinalMemoryScene.introBlackToWhiteFadeMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        fade.destroy();
        this.startIntroSequence();
      },
    });
  }

  private startIntroSequence(): void {
    this.time.delayedCall(FinalMemoryScene.introWhiteHoldMs, () => {
      if (!this.player) {
        return;
      }

      this.tweens.add({
        targets: this.player,
        alpha: 1,
        duration: FinalMemoryScene.playerFadeInMs,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.showDialogue("final-memory-intro-where", () => {
            this.phase = "walking";
          });
        },
      });
    });
  }

  private updateWalking(seconds: number): void {
    if (!this.player) {
      return;
    }

    const movingForward = this.cursors?.right.isDown === true || this.keyD?.isDown === true;
    if (!movingForward) {
      this.stopPlayerWalk();
      return;
    }

    playPlayerWalk(this.player, "right");
    if (this.player.x < FinalMemoryScene.playerCenterX) {
      this.player.x = Math.min(
        FinalMemoryScene.playerCenterX,
        this.player.x + FinalMemoryScene.walkSpeed * seconds,
      );
      return;
    }

    this.worldScroll += FinalMemoryScene.worldScrollSpeed * seconds;
    this.refreshMemoryPositions();
  }

  private checkMemoryStop(): void {
    const view = this.memoryViews[this.activeMemoryIndex];
    if (!view || view.completed || view.container.x > FinalMemoryScene.memoryStopX) {
      return;
    }

    this.worldScroll = view.definition.worldX - FinalMemoryScene.memoryStopX;
    this.refreshMemoryPositions();
    this.phase = "waitingMemory";
    this.overlay?.setPrompt("Memory");
    view.promptTarget.setInteractive({ useHandCursor: true });
    this.stopPlayerWalk();
  }

  private checkEndingReached(): void {
    if (
      this.phase !== "walking" ||
      this.activeMemoryIndex < this.memoryViews.length ||
      this.memoryViews.length === 0
    ) {
      return;
    }

    const lastMemory = this.memoryViews[this.memoryViews.length - 1];
    const frameHalfWidth = FinalMemoryScene.memoryFrameSize.width / 2;
    if (lastMemory.container.x + frameHalfWidth > -FinalMemoryScene.memoryStopScrollPadding) {
      return;
    }

    this.startEndingBeat();
  }

  private startActiveMemoryDialogue(): void {
    const view = this.memoryViews[this.activeMemoryIndex];
    if (!view || this.phase !== "waitingMemory") {
      return;
    }

    this.overlay?.setPrompt(null);
    this.phase = "memoryDialogue";
    this.showDialogue(view.definition.dialogueId, () => {
      view.completed = true;
      view.frame.setStrokeStyle(6, 0x9d9d9d, 0.62);
      view.promptTarget.disableInteractive();
      this.activeMemoryIndex += 1;
      this.phase = "walking";
    });
  }

  private startEndingBeat(): void {
    if (!this.player || this.phase === "ending" || this.phase === "done") {
      return;
    }

    this.phase = "ending";
    this.overlay?.setPrompt(null);
    this.stopPlayerWalk();
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      duration: FinalMemoryScene.playerFadeOutMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.time.delayedCall(FinalMemoryScene.theEndDelayMs, () => this.showTheEnd());
      },
    });
  }

  private showTheEnd(): void {
    this.phase = "done";
    this.stopFinalMemorySound();
    const text = this.add
      .text(480, 238, "The End.", {
        color: "#242424",
        fontFamily: "\"Pixelify Sans\", system-ui, sans-serif",
        fontSize: "58px",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: FinalMemoryScene.theEndFadeMs,
      ease: "Sine.easeInOut",
    });

    const button = this.createPlayAgainButton();
    this.tweens.add({
      targets: button,
      alpha: 1,
      duration: FinalMemoryScene.theEndFadeMs,
      ease: "Sine.easeInOut",
    });
  }

  private showDialogue(dialogueId: string, onComplete: () => void): void {
    this.overlay?.showDialogue(dialogueId, {
      onChoice: () => undefined,
      onComplete,
    });
  }

  private createMemoryView(definition: FinalMemoryDefinition): FinalMemoryView {
    const { width, height } = FinalMemoryScene.memoryFrameSize;
    const container = this.add.container(definition.worldX, FinalMemoryScene.memoryY);
    container.setDepth(20);

    const shadow = this.add.rectangle(14, 14, width, height, 0x000000, 0.1);
    const outerBacking = this.add.rectangle(0, 0, width, height, 0xffffff, 1);
    outerBacking.setStrokeStyle(8, 0x000000, 1);
    const cornerSize = 22;
    const corners = [
      this.add.rectangle(-width / 2 + cornerSize / 2, -height / 2 + cornerSize / 2, cornerSize, cornerSize, 0x000000, 1),
      this.add.rectangle(width / 2 - cornerSize / 2, -height / 2 + cornerSize / 2, cornerSize, cornerSize, 0x000000, 1),
      this.add.rectangle(-width / 2 + cornerSize / 2, height / 2 - cornerSize / 2, cornerSize, cornerSize, 0x000000, 1),
      this.add.rectangle(width / 2 - cornerSize / 2, height / 2 - cornerSize / 2, cornerSize, cornerSize, 0x000000, 1),
    ];
    const image = this.add.image(0, 0, definition.textureKey);
    const imageScale = FinalMemoryScene.memoryImageSize / Math.max(image.width, image.height);
    image.setScale(imageScale);

    const frame = this.add.rectangle(0, 0, width, height, 0xffffff, 0);
    frame.setStrokeStyle(6, 0x000000, 1);
    const innerFrame = this.add.rectangle(0, 0, width - 32, height - 32, 0xffffff, 0);
    innerFrame.setStrokeStyle(3, 0x505050, 0.9);
    const pixelNotches = [
      this.add.rectangle(0, -height / 2 + 18, width - 92, 6, 0x000000, 1),
      this.add.rectangle(0, height / 2 - 18, width - 92, 6, 0x000000, 1),
      this.add.rectangle(-width / 2 + 18, 0, 6, height - 92, 0x000000, 1),
      this.add.rectangle(width / 2 - 18, 0, 6, height - 92, 0x000000, 1),
    ];
    const hitZone = this.add.zone(0, 0, width, height);
    hitZone.on("pointerdown", () => this.startActiveMemoryDialogue());

    container.add([
      shadow,
      outerBacking,
      image,
      frame,
      innerFrame,
      ...corners,
      ...pixelNotches,
      hitZone,
    ]);

    return {
      container,
      frame,
      promptTarget: hitZone,
      definition,
      completed: false,
    };
  }

  private refreshMemoryPositions(): void {
    for (const view of this.memoryViews) {
      view.container.x = view.definition.worldX - this.worldScroll;
      view.container.y = FinalMemoryScene.memoryY;
    }
  }

  private isInteractPressed(): boolean {
    return (
      (this.keyE && Phaser.Input.Keyboard.JustDown(this.keyE)) === true ||
      (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) === true
    );
  }

  private stopPlayerWalk(): void {
    if (!this.player) {
      return;
    }

    setPlayerIdle(this.player, "right");
  }

  private startFinalMemorySound(): void {
    this.finalMemorySound = this.sound.add("bgm.finalMemory", {
      loop: true,
      volume: FinalMemoryScene.finalMemoryVolume,
    });
    this.finalMemorySound.play();
  }

  private stopFinalMemorySound(): void {
    if (!this.finalMemorySound) {
      return;
    }

    if (this.finalMemorySound.isPlaying) {
      this.finalMemorySound.stop();
    }
    this.finalMemorySound.destroy();
    this.finalMemorySound = undefined;
  }

  private createPlayAgainButton(): Phaser.GameObjects.Container {
    const container = this.add.container(480, 334).setAlpha(0);
    const backing = this.add.rectangle(0, 0, 180, 48, 0xffffff, 1);
    backing.setStrokeStyle(4, 0x000000, 1);
    const shadow = this.add.rectangle(6, 6, 180, 48, 0x000000, 0.16);
    const text = this.add
      .text(0, -2, "Play Again", {
        color: "#000000",
        fontFamily: "\"Pixelify Sans\", system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 180, 48).setInteractive({ useHandCursor: true });
    hitZone.on("pointerdown", () => this.startPlayAgainTransition());
    container.add([shadow, backing, text, hitZone]);
    return container;
  }

  private startPlayAgainTransition(): void {
    this.input.enabled = false;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("MenuScene", { fadeInFromPlayAgain: true });
    });
    this.cameras.main.fadeOut(FinalMemoryScene.playAgainFadeOutMs, 0, 0, 0);
  }
}
