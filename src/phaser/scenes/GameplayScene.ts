import Phaser from "phaser";
import { assetManifest } from "../../assets/manifest";
import { dialogues } from "../../game/content/dialogues";
import { createInitialState } from "../../game/simulation/state";
import {
  applyChoice,
  canInteract,
  clearArrowMinigame,
  completeInteraction,
  earnMoney,
  getCurrentRoom,
  getVisibleInteractables,
  isArrowMinigameComplete,
  pressArrowInput,
  shouldStartDeskMinigame,
  startDeskMinigame,
  updateArrowMinigame,
} from "../../game/simulation/rules";
import type { ArrowDirection, GameState, Interactable } from "../../game/simulation/types";
import { NarrativeOverlay } from "../../ui/NarrativeOverlay";
import {
  createIconNotificationBubble,
  setIconNotificationBubbleHighlighted,
} from "../view/iconNotificationBubble";
import { createMailBubble, setMailBubbleHighlighted } from "../view/mailBubble";
import {
  createSpeechBubble,
  type SpeechBubbleContainer,
} from "../view/speechBubble";
import {
  bedroomPlayerDepth,
  createBedroomNightOverlay,
  createPlayerAnimations,
  createInteractableView,
  createPlayer,
  drawRoom,
  playPlayerWalk,
  preloadPlayerSprites,
  preloadRoomSprites,
  setBedroomClockFrame,
  setPlayerIdle,
  setPlayerMirrorIdle,
  setInteractableHighlighted,
  type PlayerFacing,
} from "../view/proceduralRoom";

export class GameplayScene extends Phaser.Scene {
  private static readonly firstWorkRewardGuidance =
    "You earned $25 for working hard. Keep working to earn more money.";
  private static readonly firstWorkGoalGuidance =
    "you have to collect $500 so you can be successful";
  private static readonly vacanciesDialogueMoneyThreshold = 50;
  private static readonly applications125DialogueMoneyThreshold = 125;
  private static readonly foodOrderMoneyThreshold = 75;
  private static readonly keepPushingDialogueMoneyThreshold = 275;
  private static readonly parentMessageMoneyThreshold = 150;
  private static readonly newProjectDialogueMoneyThreshold = 200;
  private static readonly hasToWorkDialogueMoneyThreshold = 350;
  private static readonly prayerTimeMoneyThreshold = 400;
  private static readonly blackFadeDialogueMoneyThreshold = 475;
  private static readonly bedroomFloorY = 486;
  private static readonly bedroomWardrobeCollider = { left: 135, right: 160 };
  private static readonly bedroomDoorInteractionPose = { x: 200, y: 486, facing: "up" as const };
  private static readonly bedroomWardrobeInteractionPose = { x: 170, y: 486, facing: "left" as const };
  private static readonly bedroomLaptopInteractionPose = { x: 620, y: 486, facing: "down" as const };
  private static readonly bedroomLaptopWorkingPose = { x: 620, y: 492, facing: "down" as const };
  private static readonly bedroomLaptopPlayerDepth = 515;
  private static readonly laptopBlueLightDepth = 517;
  private static readonly laptopBlueLightPosition = { x: 280, y: 119 };
  private static readonly laptopBlueLightScale = 4.2;
  private static readonly laptopBlueLightAlpha = 0.58;
  private static readonly bedroomDeskOcclusionBounds = { left: 420, right: 820 };
  private static readonly playerStandingScale = 7;
  private static readonly playerSittingScaleY = 7;
  private static readonly parentMailInteractableId = "parent-mail";
  private static readonly parentMailBubblePose = { x: 742, y: 306 };
  private static readonly parentMailInteractionPose = { x: 696, y: 486, facing: "down" as const };
  private static readonly parentMailBubbleHitBox = { width: 104, height: 112 };
  private static readonly zulfanMailInteractableId = "zulfan-mail";
  private static readonly zulfanMailBubblePose = { x: 742, y: 306 };
  private static readonly zulfanMailInteractionPose = { x: 696, y: 486, facing: "down" as const };
  private static readonly zulfanMailBubbleHitBox = { width: 104, height: 112 };
  private static readonly prayerTimeInteractableId = "prayer-time";
  private static readonly prayerTimeBubblePose = { x: 742, y: 306 };
  private static readonly prayerTimeInteractionPose = { x: 696, y: 486, facing: "down" as const };
  private static readonly prayerTimeBubbleHitBox = { width: 104, height: 112 };
  private static readonly footstepVolume = 0.34;
  private static readonly footstepRate = 1.5;
  private static readonly phase1BacksoundVolume = 0.1;
  private static readonly postMinigameSilentMs = 1200;
  private static readonly notificationBubbleDelayMs = 900;
  private static readonly foodOrderArrivalDelayMs = 900;
  private static readonly doorKnockDelayMs = 900;
  private static readonly monologueBubbleOffsetY = 280;
  private static readonly monologueBubbleDelayMs = 1000;
  private static readonly phase1BacksoundStartMoneyThreshold = 25;
  private static readonly phase1BacksoundStartDelayMs = 1200;
  private static readonly faintBeforeOverlayDelayMs = 1000;
  private static readonly faintRedOverlayHoldMs = 2500;
  private static readonly faintRedOverlayFadeMs = 220;
  private static readonly faintRedOverlayAlpha = 0.58;
  private static readonly faintShakeMs = 1150;
  private static readonly faintShakeIntensity = 0.055;
  private static readonly faintBlackFadeMs = 1400;
  private static readonly faintBlackHoldMs = 700;
  private static readonly faintBlackoutAlpha = 0.96;
  private static readonly faintAfterDialoguePauseMs = 900;
  private static readonly zulfanReplyMonologueBubbleWidth = 270;
  private static readonly dayNightCycleMs = 30_000;
  private static readonly dayNightFadeMs = 1200;
  private static readonly nightOverlayAlpha = 0.82;
  private static readonly epilogueFadeInMs = 1200;
  private static readonly zulfanReplyMonologueLines = [
    "Royyan already becoming a director.",
    "Irfan's doing great too.",
    "...",
    "I need to catch up first.",
  ];
  private static readonly foodOrderDialogueDelayMs = 1550;
  private static readonly doorFadeMs = 1800;
  private state: GameState = createInitialState();
  private overlay?: NarrativeOverlay;
  private roomGraphics?: Phaser.GameObjects.Graphics;
  private player?: Phaser.GameObjects.Sprite;
  private laptopBlueLight?: Phaser.GameObjects.Image;
  private laptopBlueLightEnabled = false;
  private parentMailBubble?: Phaser.GameObjects.Container;
  private zulfanMailBubble?: Phaser.GameObjects.Container;
  private prayerTimeBubble?: Phaser.GameObjects.Container;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private interactableViews = new Map<string, Phaser.GameObjects.Container>();
  private moveTarget: Phaser.Math.Vector2 | null = null;
  private pendingInteractableId: string | null = null;
  private activeDeskInteractable: Interactable | null = null;
  private highlightedId: string | null = null;
  private dialogueActive = false;
  private silentPauseActive = false;
  private playerFacing: PlayerFacing = "up";
  private footstepSound?: Phaser.Sound.BaseSound;
  private phase1Backsound?: Phaser.Sound.BaseSound;
  private monologueBubble?: SpeechBubbleContainer;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private monologueDismissReady = false;
  private monologueQueue: string[] = [];
  private monologueQueueIndex = 0;
  private nightOverlay?: Phaser.GameObjects.Image;
  private dayNightTimer?: Phaser.Time.TimerEvent;
  private isNight = false;
  private bedroomClockFrameIndex = 0;
  private shouldFadeInFromEpilogue = false;

  constructor() {
    super("GameplayScene");
  }

  init(data: { fadeInFromEpilogue?: boolean } = {}): void {
    this.shouldFadeInFromEpilogue = data.fadeInFromEpilogue === true;
  }

  preload(): void {
    preloadPlayerSprites(this);
    preloadRoomSprites(this);
    this.load.audio("sfx.player.footstep", assetManifest.audio["sfx.player.footstep"]);
    this.load.audio("sfx.door.bell", assetManifest.audio["sfx.door.bell"]);
    this.load.audio("sfx.door.knock", assetManifest.audio["sfx.door.knock"]);
    this.load.audio("sfx.door.rustle", assetManifest.audio["sfx.door.rustle"]);
    this.load.audio("sfx.keyboard.tap", assetManifest.audio["sfx.keyboard.tap"]);
    this.load.audio("sfx.money.earn", assetManifest.audio["sfx.money.earn"]);
    this.load.audio("sfx.bubble.popup", assetManifest.audio["sfx.bubble.popup"]);
    this.load.audio("sfx.prayer.adzan", assetManifest.audio["sfx.prayer.adzan"]);
    this.load.audio("sfx.environment.cricket", assetManifest.audio["sfx.environment.cricket"]);
    this.load.audio("sfx.environment.chicken", assetManifest.audio["sfx.environment.chicken"]);
    this.load.audio("bgm.phase1", assetManifest.audio["bgm.phase1"]);
    this.load.image("room.bedroom.laptopBlueLight", assetManifest.rooms["room.bedroom.laptopBlueLight"]);
    this.load.image("ui.mail", assetManifest.ui["ui.mail"]);
    this.load.image("ui.mosque", assetManifest.ui["ui.mosque"]);
  }

  create(): void {
    this.resetRuntimeState();
    this.cameras.main.resetFX();
    this.overlay = new NarrativeOverlay();
    this.overlay.mountHud();
    this.overlay.clearEnding();
    createPlayerAnimations(this);
    this.footstepSound = this.sound.add("sfx.player.footstep", {
      loop: true,
      rate: GameplayScene.footstepRate,
      volume: GameplayScene.footstepVolume,
    });
    this.phase1Backsound = this.sound.add("bgm.phase1", {
      loop: true,
      volume: GameplayScene.phase1BacksoundVolume,
    });

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,E,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.roomGraphics = this.add.graphics();
    this.renderRoom();
    this.startDayNightCycle();
    this.bindInput();
    this.setPlayerAtBedroomLaptop(true);
    this.startOpeningSequence();
  }

  update(_: number, delta: number): void {
    if (this.dialogueActive || this.silentPauseActive || this.state.phase === "ending") {
      this.stopFootsteps();
      return;
    }

    if (
      this.monologueBubble &&
      this.enterKey &&
      this.monologueDismissReady &&
      Phaser.Input.Keyboard.JustDown(this.enterKey)
    ) {
      this.advanceMonologueBubble();
    }

    if (this.state.arrowMinigame) {
      this.stopFootsteps();
      this.updateDeskMinigame(delta);
      return;
    }

    this.updateMovement(delta / 1000);
    this.updateMonologueBubblePosition();
    this.updateInteractionFocus();
  }

  shutdown(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.destroyLoopingSounds();
    this.dayNightTimer?.remove(false);
    this.dayNightTimer = undefined;
    this.destroyParentMailBubble();
    this.destroyZulfanMailBubble();
    this.destroyPrayerTimeBubble();
    this.destroyMonologueBubble();
    this.destroyLaptopBlueLight();
    this.destroyNightOverlay();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.input.off("pointerdown");
    this.resetRuntimeState();
  }

  private destroyLoopingSounds(): void {
    this.stopFootsteps();
    this.footstepSound?.destroy();
    this.footstepSound = undefined;

    this.stopPhase1Backsound();
    this.phase1Backsound?.destroy();
    this.phase1Backsound = undefined;
  }

  private resetRuntimeState(): void {
    this.state = createInitialState();
    this.roomGraphics = undefined;
    this.player = undefined;
    this.laptopBlueLight = undefined;
    this.laptopBlueLightEnabled = false;
    this.parentMailBubble = undefined;
    this.zulfanMailBubble = undefined;
    this.prayerTimeBubble = undefined;
    this.cursors = undefined;
    this.keys = undefined;
    this.interactableViews.clear();
    this.moveTarget = null;
    this.pendingInteractableId = null;
    this.activeDeskInteractable = null;
    this.highlightedId = null;
    this.dialogueActive = false;
    this.silentPauseActive = false;
    this.playerFacing = "up";
    this.footstepSound = undefined;
    this.phase1Backsound = undefined;
    this.monologueBubble = undefined;
    this.enterKey = undefined;
    this.monologueDismissReady = false;
    this.monologueQueue = [];
    this.monologueQueueIndex = 0;
    this.nightOverlay = undefined;
    this.dayNightTimer = undefined;
    this.isNight = false;
    this.bedroomClockFrameIndex = 0;
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.dialogueActive || this.silentPauseActive || this.state.phase === "ending") {
        return;
      }

      if (this.state.arrowMinigame) {
        return;
      }

      const clicked = this.findInteractableAt(pointer.worldX, pointer.worldY);
      if (clicked) {
        this.pendingInteractableId = clicked.id;
        this.moveTarget = new Phaser.Math.Vector2(clicked.x, this.getMoveTargetY(clicked.y + 18));
        return;
      }

      if (this.isMessagePending()) {
        return;
      }

      this.pendingInteractableId = null;
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, this.getMoveTargetY(pointer.worldY));
    });
  }

  private renderRoom(): void {
    const room = getCurrentRoom(this.state);
    if (!this.roomGraphics) {
      return;
    }

    this.interactableViews.forEach((view) => view.destroy(true));
    this.interactableViews.clear();
    this.destroyParentMailBubble();
    this.destroyZulfanMailBubble();
    this.destroyPrayerTimeBubble();
    this.destroyMonologueBubble();
    this.destroyLaptopBlueLight();
    this.highlightedId = null;

    drawRoom(this, this.roomGraphics, room.id);
    this.refreshBedroomClockFrame();
    this.refreshNightOverlay();

    if (!this.player) {
      this.player = createPlayer(this);
    }
    this.player.setPosition(room.playerStart.x, room.playerStart.y);
    setPlayerIdle(this.player, this.playerFacing);

    for (const interactable of getVisibleInteractables(this.state)) {
      const view = createInteractableView(this, interactable);
      this.interactableViews.set(interactable.id, view);
    }
    this.refreshParentMailBubble();
    this.refreshZulfanMailBubble();
    this.refreshPrayerTimeBubble();

    this.overlay?.updateHud(this.state, room.title);
    this.overlay?.setPrompt(null);
    this.overlay?.hideArrowMinigame();
  }

  private startDayNightCycle(): void {
    this.dayNightTimer?.remove(false);
    this.dayNightTimer = this.time.addEvent({
      delay: GameplayScene.dayNightCycleMs,
      loop: true,
      callback: () => this.toggleDayNight(),
    });
  }

  private startOpeningSequence(): void {
    if (!this.shouldFadeInFromEpilogue) {
      this.startFreeDialogue("opening", () => this.showOpeningArrowTutorial());
      return;
    }

    this.silentPauseActive = true;
    this.overlay?.setPrompt(null);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.silentPauseActive = false;
      this.startFreeDialogue("opening", () => this.showOpeningArrowTutorial());
    });
    this.cameras.main.fadeIn(GameplayScene.epilogueFadeInMs, 0, 0, 0);
  }

  private toggleDayNight(): void {
    this.isNight = !this.isNight;
    this.advanceBedroomClockFrame();
    this.updateLaptopBlueLightVisibility();
    const overlay = this.ensureNightOverlay();
    if (!overlay) {
      if (this.isNight) {
        this.playCricketSound();
      } else {
        this.playChickenSound();
      }
      return;
    }

    this.tweens.killTweensOf(overlay);
    this.tweens.add({
      targets: overlay,
      alpha: this.isNight ? GameplayScene.nightOverlayAlpha : 0,
      duration: GameplayScene.dayNightFadeMs,
      ease: "Sine.easeInOut",
    });

    if (this.isNight) {
      this.playCricketSound();
    } else {
      this.playChickenSound();
    }
  }

  private advanceBedroomClockFrame(): void {
    this.bedroomClockFrameIndex += 1;
    this.refreshBedroomClockFrame();
  }

  private refreshBedroomClockFrame(): void {
    if (!this.isBedroom()) {
      return;
    }

    setBedroomClockFrame(this, this.bedroomClockFrameIndex);
  }

  private refreshNightOverlay(): void {
    this.destroyNightOverlay();
    if (!this.isBedroom()) {
      return;
    }

    this.nightOverlay = createBedroomNightOverlay(
      this,
      this.isNight ? GameplayScene.nightOverlayAlpha : 0,
    );
  }

  private ensureNightOverlay(): Phaser.GameObjects.Image | undefined {
    if (!this.isBedroom()) {
      this.destroyNightOverlay();
      return undefined;
    }

    if (!this.nightOverlay?.active) {
      this.nightOverlay = createBedroomNightOverlay(this, this.isNight ? GameplayScene.nightOverlayAlpha : 0);
    }

    return this.nightOverlay;
  }

  private destroyNightOverlay(): void {
    if (!this.nightOverlay) {
      return;
    }

    this.tweens.killTweensOf(this.nightOverlay);
    this.nightOverlay.destroy();
    this.nightOverlay = undefined;
  }

  private refreshInteractables(): void {
    const currentPositions = new Map(
      [...this.interactableViews.entries()].map(([id, view]) => [id, { x: view.x, y: view.y }]),
    );

    this.interactableViews.forEach((view) => view.destroy(true));
    this.interactableViews.clear();

    for (const interactable of getVisibleInteractables(this.state)) {
      const view = createInteractableView(this, interactable);
      const previous = currentPositions.get(interactable.id);
      if (previous) {
        view.setPosition(previous.x, previous.y);
      }
      this.interactableViews.set(interactable.id, view);
    }
    this.refreshParentMailBubble();
    this.refreshZulfanMailBubble();
    this.refreshPrayerTimeBubble();

    this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
  }

  private updateMovement(seconds: number): void {
    if (!this.player || !this.cursors || !this.keys) {
      return;
    }

    const speed = 138;
    const direction = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.keys.A.isDown) direction.x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) direction.x += 1;
    const bedroomUpFacingPressed = this.isBedroomUpFacingPressed();
    const bedroomDownFacingPressed = this.isBedroomDownFacingPressed();
    if (!this.isBedroom()) {
      if (this.cursors.up.isDown || this.keys.W.isDown) direction.y -= 1;
      if (this.cursors.down.isDown || this.keys.S.isDown) direction.y += 1;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryInteract(this.highlightedId);
      if (this.dialogueActive || this.silentPauseActive) {
        return;
      }
    }

    if (direction.lengthSq() > 0) {
      this.moveTarget = null;
      this.pendingInteractableId = null;
      this.setPlayerStandingScale();
      this.setPlayerWalkFromDirection(direction);
      direction.normalize().scale(speed * seconds);
      const previousX = this.player.x;
      const previousY = this.player.y;
      this.player.x = this.resolveBedroomWardrobeCollision(this.player.x, this.player.x + direction.x);
      this.player.y += direction.y;
      this.updateFootstepsForMovement(previousX, previousY, true);
    } else if (this.moveTarget) {
      if (this.isBedroom()) {
        this.moveTarget.y = GameplayScene.bedroomFloorY;
        this.moveTarget.x = this.resolveBedroomWardrobeCollision(this.player.x, this.moveTarget.x);
      }
      const toTarget = this.moveTarget.clone().subtract(new Phaser.Math.Vector2(this.player.x, this.player.y));
      const distance = toTarget.length();
      const step = speed * seconds;
      if (distance <= step) {
        this.player.setPosition(this.moveTarget.x, this.moveTarget.y);
        this.moveTarget = null;
        this.setPlayerStandingScale();
        setPlayerIdle(this.player, this.playerFacing);
        this.stopFootsteps();
        this.tryInteract(this.pendingInteractableId);
        this.pendingInteractableId = null;
      } else {
        this.setPlayerStandingScale();
        this.setPlayerWalkFromDirection(toTarget);
        toTarget.normalize().scale(step);
        const previousX = this.player.x;
        const previousY = this.player.y;
        this.player.x = this.resolveBedroomWardrobeCollision(this.player.x, this.player.x + toTarget.x);
        this.player.y += toTarget.y;
        this.updateFootstepsForMovement(previousX, previousY, false);
      }
    } else {
      if (bedroomUpFacingPressed) {
        this.playerFacing = "up";
        playPlayerWalk(this.player, this.playerFacing);
      } else if (bedroomDownFacingPressed) {
        this.playerFacing = "down";
        playPlayerWalk(this.player, this.playerFacing);
      } else {
        setPlayerIdle(this.player, this.playerFacing);
      }
      this.stopFootsteps();
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 38, 922);
    this.player.y = this.isBedroom()
      ? GameplayScene.bedroomFloorY
      : Phaser.Math.Clamp(this.player.y, 276, 440);
    this.setPlayerDepth();
  }

  private setPlayerWalkFromDirection(direction: Phaser.Math.Vector2): void {
    if (!this.player) {
      return;
    }

    if (this.isBedroom()) {
      this.playerFacing = direction.x >= 0 ? "right" : "left";
    } else if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      this.playerFacing = direction.x >= 0 ? "right" : "left";
    } else {
      this.playerFacing = direction.y >= 0 ? "down" : "up";
    }

    playPlayerWalk(this.player, this.playerFacing);
  }

  private updateFootstepsForMovement(
    previousX: number,
    previousY: number,
    keepPlayingWhenBlocked: boolean,
  ): void {
    const moved = !!this.player && (this.player.x !== previousX || this.player.y !== previousY);
    this.setFootstepsPlaying(moved || keepPlayingWhenBlocked);
  }

  private setPlayerDepth(): void {
    if (!this.player) {
      return;
    }

    if (!this.isBedroom()) {
      this.player.setDepth(this.player.y + 8);
      return;
    }

    this.player.setDepth(
      this.isPlayerBehindBedroomDesk()
        ? GameplayScene.bedroomLaptopPlayerDepth
        : bedroomPlayerDepth,
    );
  }

  private isPlayerBehindBedroomDesk(): boolean {
    if (!this.player) {
      return false;
    }

    const { left, right } = GameplayScene.bedroomDeskOcclusionBounds;
    return this.player.x >= left && this.player.x <= right;
  }

  private stopFootsteps(): void {
    this.setFootstepsPlaying(false);
  }

  private setFootstepsPlaying(isWalking: boolean): void {
    if (!this.footstepSound) {
      return;
    }

    if (isWalking) {
      if (!this.footstepSound.isPlaying) {
        this.footstepSound.play();
      }
      return;
    }

    if (this.footstepSound.isPlaying) {
      this.footstepSound.stop();
    }
  }

  private updateInteractionFocus(): void {
    const nearest = this.findNearestInteractable();
    if (nearest?.id !== this.highlightedId) {
      if (this.highlightedId) {
        this.setInteractionViewHighlighted(this.highlightedId, false);
      }

      this.highlightedId = nearest?.id ?? null;
      if (this.highlightedId) {
        this.setInteractionViewHighlighted(this.highlightedId, true);
      }
    }

    this.overlay?.setPrompt(nearest ? nearest.label : null);
  }

  private setInteractionViewHighlighted(interactableId: string, highlighted: boolean): void {
    if (interactableId === GameplayScene.parentMailInteractableId) {
      if (this.parentMailBubble) {
        setMailBubbleHighlighted(this.parentMailBubble, highlighted);
      }
      return;
    }

    if (interactableId === GameplayScene.zulfanMailInteractableId) {
      if (this.zulfanMailBubble) {
        setMailBubbleHighlighted(this.zulfanMailBubble, highlighted);
      }
      return;
    }

    if (interactableId === GameplayScene.prayerTimeInteractableId) {
      if (this.prayerTimeBubble) {
        setIconNotificationBubbleHighlighted(this.prayerTimeBubble, highlighted);
      }
      return;
    }

    const view = this.interactableViews.get(interactableId);
    if (view) {
      setInteractableHighlighted(view, highlighted);
    }
  }

  private findNearestInteractable(): Interactable | null {
    if (!this.player) {
      return null;
    }

    let nearest: Interactable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const interactable of this.getInteractionTargets()) {
      if (!this.canUseInteractableNow(interactable)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        interactable.x,
        interactable.y,
      );
      if (distance < interactable.radius + 26 && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private findInteractableAt(x: number, y: number): Interactable | null {
    return (
      this.getInteractionTargets().find((interactable) => {
        if (!this.canUseInteractableNow(interactable)) {
          return false;
        }
        if (interactable.id === GameplayScene.parentMailInteractableId) {
          return this.isPointOnMailBubble(
            x,
            y,
            GameplayScene.parentMailBubblePose,
            GameplayScene.parentMailBubbleHitBox,
            GameplayScene.parentMailInteractionPose,
          );
        }
        if (interactable.id === GameplayScene.zulfanMailInteractableId) {
          return this.isPointOnMailBubble(
            x,
            y,
            GameplayScene.zulfanMailBubblePose,
            GameplayScene.zulfanMailBubbleHitBox,
            GameplayScene.zulfanMailInteractionPose,
          );
        }
        if (interactable.id === GameplayScene.prayerTimeInteractableId) {
          return this.isPointOnMailBubble(
            x,
            y,
            GameplayScene.prayerTimeBubblePose,
            GameplayScene.prayerTimeBubbleHitBox,
            GameplayScene.prayerTimeInteractionPose,
          );
        }
        return Phaser.Math.Distance.Between(x, y, interactable.x, interactable.y) <= interactable.radius;
      }) ?? null
    );
  }

  private tryInteract(interactableId: string | null): void {
    if (!interactableId || this.dialogueActive) {
      return;
    }

    const interactable = this.getInteractionTargets().find((item) => item.id === interactableId);
    if (!interactable || !this.canUseInteractableNow(interactable)) {
      return;
    }

    this.startInteractionDialogue(interactable);
  }

  private startFreeDialogue(dialogueId: string, onComplete?: () => void): void {
    if (!dialogues[dialogueId]) {
      return;
    }

    this.dialogueActive = true;
    this.overlay?.showDialogue(dialogueId, {
      onChoice: (choice) => {
        this.state = applyChoice(this.state, choice);
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      },
      onComplete: () => {
        this.dialogueActive = false;
        onComplete?.();
      },
    });
  }

  private startOpeningDeskMinigame(): void {
    const laptop = getVisibleInteractables(this.state).find((item) => item.id === "laptop");
    if (!laptop) {
      return;
    }

    this.startDeskWork(laptop);
  }

  private showOpeningArrowTutorial(): void {
    this.dialogueActive = true;
    this.overlay?.showTutorialGuidance("Click the corresponding arrow to progress.", () => {
      this.dialogueActive = false;
      this.startOpeningDeskMinigame();
    });
  }

  private startInteractionDialogue(interactable: Interactable): void {
    if (interactable.id === GameplayScene.parentMailInteractableId) {
      this.alignPlayerForInteraction(interactable);
      this.startParentMessageDialogue();
      return;
    }

    if (interactable.id === GameplayScene.zulfanMailInteractableId) {
      this.alignPlayerForInteraction(interactable);
      this.startZulfanMessageDialogue();
      return;
    }

    if (interactable.id === GameplayScene.prayerTimeInteractableId) {
      this.alignPlayerForInteraction(interactable);
      this.startPrayerTimeDialogue();
      return;
    }

    if (this.shouldPlayFoodDoorSequence(interactable)) {
      this.startFoodDoorSequence(interactable);
      return;
    }

    this.alignPlayerForInteraction(interactable);
    this.dialogueActive = true;
    this.overlay?.showDialogue(interactable.dialogueId, {
      onChoice: (choice) => {
        this.state = applyChoice(this.state, choice);
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      },
      onComplete: () => {
        if (shouldStartDeskMinigame(interactable)) {
          this.dialogueActive = false;
          this.startDeskWork(interactable);
          return;
        }

        const previousRoom = this.state.currentRoom;
        this.state = completeInteraction(this.state, interactable);
        this.dialogueActive = false;
        this.pendingInteractableId = null;
        this.moveTarget = null;

        if (this.state.phase === "ending") {
          this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
          this.overlay?.showEnding(() => this.scene.restart());
          return;
        }

        if (previousRoom !== this.state.currentRoom) {
          this.renderRoom();
        } else {
          this.refreshInteractables();
        }
      },
    });
  }

  private alignPlayerForInteraction(interactable: Interactable): void {
    if (!this.player || !this.isBedroom()) {
      return;
    }

    if (interactable.id === "bed") {
      this.moveTarget = null;
      this.pendingInteractableId = null;
      this.playerFacing = "down";
      this.setPlayerStandingScale();
      setPlayerIdle(this.player, this.playerFacing);
      this.setPlayerDepth();
      this.stopFootsteps();
      return;
    }

    if (interactable.id === "wardrobe") {
      this.moveTarget = null;
      this.pendingInteractableId = null;
      this.playerFacing = GameplayScene.bedroomWardrobeInteractionPose.facing;
      this.player.setPosition(
        GameplayScene.bedroomWardrobeInteractionPose.x,
        GameplayScene.bedroomWardrobeInteractionPose.y,
      );
      this.setPlayerStandingScale();
      setPlayerMirrorIdle(this.player);
      this.setPlayerDepth();
      this.stopFootsteps();
      return;
    }

    const pose =
      interactable.id === "door"
        ? GameplayScene.bedroomDoorInteractionPose
        : interactable.id === "laptop"
          ? GameplayScene.bedroomLaptopInteractionPose
          : interactable.id === GameplayScene.parentMailInteractableId
            ? GameplayScene.parentMailInteractionPose
            : null;
    if (!pose) {
      return;
    }

    this.moveTarget = null;
    this.pendingInteractableId = null;
    this.playerFacing = pose.facing;
    this.player.setPosition(pose.x, pose.y);
    this.setPlayerStandingScale();
    setPlayerIdle(this.player, this.playerFacing);
    if (interactable.id === "laptop") {
      this.setPlayerLaptopDepth();
    } else {
      this.setPlayerDepth();
    }
    this.stopFootsteps();
  }

  private setPlayerAtBedroomLaptop(isWorking = false): void {
    if (!this.player || !this.isBedroom()) {
      return;
    }

    const pose = isWorking
      ? GameplayScene.bedroomLaptopWorkingPose
      : GameplayScene.bedroomLaptopInteractionPose;

    this.playerFacing = pose.facing;
    this.player.setPosition(
      pose.x,
      pose.y,
    );
    if (isWorking) {
      this.setPlayerLaptopWorkPose();
    } else {
      this.setPlayerStandingScale();
      setPlayerIdle(this.player, this.playerFacing);
    }
    this.setPlayerLaptopDepth();
  }

  private setPlayerLaptopWorkPose(): void {
    if (!this.player) {
      return;
    }

    this.playerFacing = GameplayScene.bedroomLaptopWorkingPose.facing;
    this.player.setPosition(
      GameplayScene.bedroomLaptopWorkingPose.x,
      GameplayScene.bedroomLaptopWorkingPose.y,
    );
    this.player.setScale(
      GameplayScene.playerStandingScale,
      GameplayScene.playerSittingScaleY,
    );
    playPlayerWalk(this.player, this.playerFacing);
    this.setPlayerLaptopDepth();
    this.showLaptopBlueLight();
  }

  private setPlayerStandingScale(): void {
    this.player?.setScale(GameplayScene.playerStandingScale);
    this.hideLaptopBlueLight();
  }

  private setPlayerLaptopDepth(): void {
    this.player?.setDepth(GameplayScene.bedroomLaptopPlayerDepth);
  }

  private showLaptopBlueLight(): void {
    if (!this.isBedroom()) {
      return;
    }

    this.laptopBlueLightEnabled = true;

    if (!this.laptopBlueLight) {
      this.laptopBlueLight = this.add
        .image(
          GameplayScene.laptopBlueLightPosition.x,
          GameplayScene.laptopBlueLightPosition.y,
          "room.bedroom.laptopBlueLight",
        )
        .setOrigin(0, 0)
        .setScale(GameplayScene.laptopBlueLightScale)
        .setAlpha(GameplayScene.laptopBlueLightAlpha)
        .setDepth(GameplayScene.laptopBlueLightDepth);
    }

    this.updateLaptopBlueLightVisibility();
  }

  private hideLaptopBlueLight(): void {
    this.laptopBlueLightEnabled = false;
    this.updateLaptopBlueLightVisibility();
  }

  private updateLaptopBlueLightVisibility(): void {
    this.laptopBlueLight?.setVisible(
      this.laptopBlueLightEnabled && this.isNight && this.isBedroom(),
    );
  }

  private destroyLaptopBlueLight(): void {
    this.laptopBlueLight?.destroy();
    this.laptopBlueLight = undefined;
    this.laptopBlueLightEnabled = false;
  }

  private startDeskWork(interactable: Interactable): void {
    this.state = startDeskMinigame(this.state);
    this.activeDeskInteractable = interactable;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.highlightedId = null;
    this.playerFacing = this.isBedroom() ? GameplayScene.bedroomLaptopInteractionPose.facing : "up";

    if (this.player) {
      if (this.isBedroom()) {
        this.player.setPosition(
          GameplayScene.bedroomLaptopWorkingPose.x,
          GameplayScene.bedroomLaptopWorkingPose.y,
        );
        this.setPlayerLaptopWorkPose();
      } else {
        this.player.setPosition(interactable.x, this.getMoveTargetY(interactable.y + 24));
        this.setPlayerStandingScale();
        setPlayerIdle(this.player, this.playerFacing);
      }
      if (this.isBedroom()) {
        this.setPlayerLaptopDepth();
      } else {
        this.setPlayerDepth();
      }
    }

    this.overlay?.setPrompt(null);
    if (this.state.arrowMinigame) {
      this.overlay?.showArrowMinigame(this.state.arrowMinigame);
    }
  }

  private updateDeskMinigame(delta: number): void {
    const pressed = this.readPressedArrow();
    if (pressed) {
      this.playKeyboardTapSound();
      this.state = pressArrowInput(this.state, pressed);
    } else {
      this.state = updateArrowMinigame(this.state, delta);
    }

    if (isArrowMinigameComplete(this.state)) {
      this.finishDeskWork();
      return;
    }

    if (this.state.arrowMinigame) {
      this.overlay?.updateArrowMinigame(this.state.arrowMinigame);
    }
  }

  private readPressedArrow(): ArrowDirection | null {
    if (!this.cursors) {
      return null;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) return "up";
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) return "down";
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) return "left";
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) return "right";
    return null;
  }

  private finishDeskWork(): void {
    const deskInteractable = this.activeDeskInteractable;
    if (!deskInteractable) {
      return;
    }

    this.overlay?.hideArrowMinigame();
    this.hideLaptopBlueLight();
    this.state = clearArrowMinigame(this.state);
    let shouldShowFirstWorkRewardGuidance = false;
    let rewardDialogueId: string | null = null;
    let shouldScheduleParentMessage = false;
    let shouldSchedulePrayerTimeEvent = false;
    let shouldStartPhase1Backsound = false;
    if (this.shouldEarnMoneyFromWork(deskInteractable)) {
      shouldShowFirstWorkRewardGuidance = this.shouldShowFirstWorkRewardGuidance();
      this.state = earnMoney(this.state);
      this.playEarnMoneySound();
      shouldStartPhase1Backsound =
        this.state.money === GameplayScene.phase1BacksoundStartMoneyThreshold;
      if (shouldShowFirstWorkRewardGuidance) {
        this.state = this.withStoryFlags(["firstWorkRewardNotificationShown"]);
      }
      rewardDialogueId = this.getEarnMoneyDialogueId();
      if (rewardDialogueId === "money-50-vacancies") {
        this.state = this.withStoryFlags(["vacanciesMoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-125-applications") {
        this.state = this.withStoryFlags(["applications125MoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-275-keep-pushing") {
        this.state = this.withStoryFlags(["keepPushingMoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-200-new-project") {
        this.state = this.withStoryFlags(["newProjectMoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-350-has-to-work") {
        this.state = this.withStoryFlags(["hasToWorkMoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-475-ugh") {
        this.state = this.withStoryFlags(["blackFadeMoneyDialogueSeen"]);
      }
      shouldScheduleParentMessage = this.shouldUnlockParentMessage();
      shouldSchedulePrayerTimeEvent = this.shouldUnlockPrayerTimeEvent();
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
    }

    this.activeDeskInteractable = null;
    this.pendingInteractableId = null;
    this.moveTarget = null;

    if (shouldShowFirstWorkRewardGuidance) {
      this.showFirstWorkRewardGuidance(() => {
        this.showEarnMoneyDialogueIfNeeded(rewardDialogueId, () =>
          this.scheduleMoneyNotificationEvents(
            shouldScheduleParentMessage,
            shouldSchedulePrayerTimeEvent,
            () =>
              this.continueAfterMoneyEvents(shouldStartPhase1Backsound, deskInteractable),
          ),
        );
      });
      return;
    }

    this.showEarnMoneyDialogueIfNeeded(rewardDialogueId, () =>
      this.scheduleMoneyNotificationEvents(
        shouldScheduleParentMessage,
        shouldSchedulePrayerTimeEvent,
        () => this.continueAfterMoneyEvents(shouldStartPhase1Backsound, deskInteractable),
      ),
    );
  }

  private continueAfterMoneyEvents(
    shouldStartPhase1Backsound: boolean,
    deskInteractable: Interactable,
  ): void {
    if (shouldStartPhase1Backsound) {
      this.time.delayedCall(GameplayScene.phase1BacksoundStartDelayMs, () => {
        this.startPhase1Backsound();
      });
    }

    this.continueAfterDeskWork(deskInteractable);
  }

  private continueAfterDeskWork(deskInteractable: Interactable): void {
    if (this.shouldStartFoodOrderSequence(deskInteractable)) {
      this.startFoodOrderSequence(deskInteractable);
      return;
    }

    this.startSilentPause(() => this.finishDeskWorkAfterSilentPause(deskInteractable));
  }

  private shouldStartFoodOrderSequence(deskInteractable: Interactable): boolean {
    return (
      this.isBedroom() &&
      deskInteractable.id === "laptop" &&
      this.state.money === GameplayScene.foodOrderMoneyThreshold &&
      this.state.storyFlags.waitingForFoodOrder !== true
    );
  }

  private shouldEarnMoneyFromWork(deskInteractable: Interactable): boolean {
    return this.isBedroom() && deskInteractable.id === "laptop";
  }

  private shouldUnlockParentMessage(): boolean {
    return (
      this.state.money === GameplayScene.parentMessageMoneyThreshold &&
      this.state.storyFlags.parentMessageAvailable !== true &&
      this.state.storyFlags.parentMessageRead !== true
    );
  }

  private shouldUnlockPrayerTimeEvent(): boolean {
    return (
      this.state.money === GameplayScene.prayerTimeMoneyThreshold &&
      this.state.storyFlags.prayerTimeAvailable !== true &&
      this.state.storyFlags.prayerTimeRead !== true
    );
  }

  private shouldShowFirstWorkRewardGuidance(): boolean {
    return this.state.money === 0 && this.state.storyFlags.firstWorkRewardNotificationShown !== true;
  }

  private getEarnMoneyDialogueId(): string | null {
    if (
      this.state.money === GameplayScene.vacanciesDialogueMoneyThreshold &&
      this.state.storyFlags.vacanciesMoneyDialogueSeen !== true
    ) {
      return "money-50-vacancies";
    }

    if (
      this.state.money === GameplayScene.applications125DialogueMoneyThreshold &&
      this.state.storyFlags.applications125MoneyDialogueSeen !== true
    ) {
      return "money-125-applications";
    }

    if (
      this.state.money === GameplayScene.keepPushingDialogueMoneyThreshold &&
      this.state.storyFlags.keepPushingMoneyDialogueSeen !== true
    ) {
      return "money-275-keep-pushing";
    }

    if (
      this.state.money === GameplayScene.newProjectDialogueMoneyThreshold &&
      this.state.storyFlags.newProjectMoneyDialogueSeen !== true
    ) {
      return "money-200-new-project";
    }

    if (
      this.state.money === GameplayScene.hasToWorkDialogueMoneyThreshold &&
      this.state.storyFlags.hasToWorkMoneyDialogueSeen !== true
    ) {
      return "money-350-has-to-work";
    }

    if (
      this.state.money === GameplayScene.blackFadeDialogueMoneyThreshold &&
      this.state.storyFlags.blackFadeMoneyDialogueSeen !== true
    ) {
      return "money-475-ugh";
    }

    return null;
  }

  private showFirstWorkRewardGuidance(onComplete: () => void): void {
    this.dialogueActive = true;
    this.overlay?.showPlainTutorialGuidance(
      GameplayScene.firstWorkRewardGuidance,
      () => {
        this.overlay?.showPlainTutorialGuidance(
          GameplayScene.firstWorkGoalGuidance,
          () => {
            this.dialogueActive = false;
            onComplete();
          },
          "Continue",
        );
      },
      "Continue",
    );
  }

  private showEarnMoneyDialogueIfNeeded(dialogueId: string | null, onComplete: () => void): void {
    if (!dialogueId) {
      onComplete();
      return;
    }

    if (dialogueId === "money-275-keep-pushing") {
      this.startFreeDialogue(dialogueId, () => this.scheduleZulfanMessageEvent(onComplete));
      return;
    }

    if (dialogueId === "money-475-ugh") {
      this.startFaintEventDialogue(dialogueId);
      return;
    }

    this.startFreeDialogue(dialogueId, onComplete);
  }

  private startFaintEventDialogue(dialogueId: string): void {
    this.silentPauseActive = true;
    this.overlay?.setPrompt(null);
    this.stopFootsteps();

    if (this.player) {
      setPlayerIdle(this.player, this.playerFacing);
    }

    this.time.delayedCall(GameplayScene.faintBeforeOverlayDelayMs, () => {
      this.startFaintCollapse(dialogueId);
    });
  }

  private startFaintCollapse(dialogueId: string): void {
    this.stopPhase1Backsound();

    this.overlay?.showFaintRedOverlay(
      GameplayScene.faintRedOverlayHoldMs,
      GameplayScene.faintRedOverlayFadeMs,
      GameplayScene.faintRedOverlayAlpha,
    );
    this.cameras.main.shake(
      GameplayScene.faintShakeMs,
      GameplayScene.faintShakeIntensity,
      true,
    );

    this.time.delayedCall(GameplayScene.faintRedOverlayHoldMs, () => {
      this.overlay?.showFaintBlackout(
        GameplayScene.faintBlackFadeMs,
        GameplayScene.faintBlackoutAlpha,
      );
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.time.delayedCall(GameplayScene.faintBlackHoldMs, () => {
          this.silentPauseActive = false;
          this.startFreeDialogue(dialogueId, () => {
            this.silentPauseActive = true;
            this.time.delayedCall(GameplayScene.faintAfterDialoguePauseMs, () => {
              this.scene.start("FinalMemoryScene");
            });
          });
        });
      });
      this.cameras.main.fadeOut(GameplayScene.faintBlackFadeMs, 0, 0, 0);
    });
  }

  private scheduleZulfanMessageEvent(onComplete: () => void): void {
    if (
      this.state.storyFlags.zulfanMessageAvailable === true ||
      this.state.storyFlags.zulfanMessageRead === true
    ) {
      onComplete();
      return;
    }

    this.silentPauseActive = true;
    this.overlay?.setPrompt(null);
    this.time.delayedCall(GameplayScene.notificationBubbleDelayMs, () => {
      this.state = this.withStoryFlags(["zulfanMessageAvailable"]);
      this.playBubblePopupSound();
      this.silentPauseActive = false;
      this.refreshZulfanMailBubble();
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      this.updateInteractionFocus();
      onComplete();
    });
  }

  private scheduleMoneyNotificationEvents(
    shouldScheduleParentMessage: boolean,
    shouldSchedulePrayerTimeEvent: boolean,
    onComplete: () => void,
  ): void {
    if (!shouldScheduleParentMessage && !shouldSchedulePrayerTimeEvent) {
      onComplete();
      return;
    }

    this.silentPauseActive = true;
    this.overlay?.setPrompt(null);
    this.time.delayedCall(GameplayScene.notificationBubbleDelayMs, () => {
      if (shouldScheduleParentMessage) {
        this.state = this.withStoryFlags(["parentMessageAvailable"]);
        this.playBubblePopupSound();
        this.refreshParentMailBubble();
      }

      if (shouldSchedulePrayerTimeEvent) {
        this.state = this.withStoryFlags(["prayerTimeAvailable"]);
        this.playAdzanSound();
        this.refreshPrayerTimeBubble();
      }

      this.silentPauseActive = false;
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      this.updateInteractionFocus();
      onComplete();
    });
  }

  private refreshParentMailBubble(): void {
    this.destroyParentMailBubble();
    if (!this.shouldShowParentMailBubble()) {
      return;
    }

    this.parentMailBubble = this.createParentMailBubble();
  }

  private shouldShowParentMailBubble(): boolean {
    return (
      this.isBedroom() &&
      this.state.storyFlags.parentMessageAvailable === true &&
      this.state.storyFlags.parentMessageRead !== true
    );
  }

  private createParentMailBubble(): Phaser.GameObjects.Container {
    const { x, y } = GameplayScene.parentMailBubblePose;
    const bubble = createMailBubble(this, {
      x,
      y,
      textureKey: "ui.mail",
    });

    this.tweens.add({
      targets: bubble,
      y: y - 7,
      duration: 720,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return bubble;
  }

  private refreshZulfanMailBubble(): void {
    this.destroyZulfanMailBubble();
    if (!this.shouldShowZulfanMailBubble()) {
      return;
    }

    this.zulfanMailBubble = this.createZulfanMailBubble();
  }

  private shouldShowZulfanMailBubble(): boolean {
    return (
      this.isBedroom() &&
      this.state.storyFlags.zulfanMessageAvailable === true &&
      this.state.storyFlags.zulfanMessageRead !== true
    );
  }

  private createZulfanMailBubble(): Phaser.GameObjects.Container {
    const { x, y } = GameplayScene.zulfanMailBubblePose;
    const bubble = createMailBubble(this, {
      x,
      y,
      textureKey: "ui.mail",
    });

    this.tweens.add({
      targets: bubble,
      y: y - 7,
      duration: 720,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return bubble;
  }

  private destroyZulfanMailBubble(): void {
    if (!this.zulfanMailBubble) {
      return;
    }

    this.tweens.killTweensOf(this.zulfanMailBubble);
    this.zulfanMailBubble.destroy(true);
    this.zulfanMailBubble = undefined;
  }

  private refreshPrayerTimeBubble(): void {
    this.destroyPrayerTimeBubble();
    if (!this.shouldShowPrayerTimeBubble()) {
      return;
    }

    this.prayerTimeBubble = this.createPrayerTimeBubble();
  }

  private shouldShowPrayerTimeBubble(): boolean {
    return (
      this.isBedroom() &&
      this.state.storyFlags.prayerTimeAvailable === true &&
      this.state.storyFlags.prayerTimeRead !== true
    );
  }

  private createPrayerTimeBubble(): Phaser.GameObjects.Container {
    const { x, y } = GameplayScene.prayerTimeBubblePose;
    const bubble = createIconNotificationBubble(this, {
      x,
      y,
      textureKey: "ui.mosque",
    });

    this.tweens.add({
      targets: bubble,
      y: y - 7,
      duration: 720,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return bubble;
  }

  private destroyPrayerTimeBubble(): void {
    if (!this.prayerTimeBubble) {
      return;
    }

    this.tweens.killTweensOf(this.prayerTimeBubble);
    this.prayerTimeBubble.destroy(true);
    this.prayerTimeBubble = undefined;
  }

  private destroyParentMailBubble(): void {
    if (!this.parentMailBubble) {
      return;
    }

    this.tweens.killTweensOf(this.parentMailBubble);
    this.parentMailBubble.destroy(true);
    this.parentMailBubble = undefined;
  }

  private startParentMessageDialogue(): void {
    if (this.dialogueActive || this.silentPauseActive || !this.shouldShowParentMailBubble()) {
      return;
    }

    this.state = this.withStoryFlags(["parentMessageRead"]);
    this.refreshParentMailBubble();
    this.dialogueActive = true;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.stopFootsteps();
    this.overlay?.showPlainTutorialGuidance(
      "you have messages from your Mom",
      () => {
        this.overlay?.showDialogue("parent-message-1", {
          onChoice: (choice) => {
            this.state = applyChoice(this.state, choice);
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
          },
          onComplete: () => {
            this.dialogueActive = false;
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
            this.time.delayedCall(GameplayScene.monologueBubbleDelayMs, () => {
              this.showParentMailMonologue();
            });
            this.updateInteractionFocus();
          },
        });
      },
      "Continue",
    );
  }

  private startZulfanMessageDialogue(): void {
    if (this.dialogueActive || this.silentPauseActive || !this.shouldShowZulfanMailBubble()) {
      return;
    }

    this.state = this.withStoryFlags(["zulfanMessageRead"]);
    this.refreshZulfanMailBubble();
    this.dialogueActive = true;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.stopFootsteps();
    this.overlay?.showPlainTutorialGuidance(
      "you have messages from your friend",
      () => {
        this.overlay?.showDialogue("zulfan-message-1", {
          onChoice: (choice) => {
            this.state = applyChoice(this.state, choice);
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
          },
          onComplete: () => {
            this.dialogueActive = false;
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
            this.time.delayedCall(GameplayScene.monologueBubbleDelayMs, () => {
              this.showZulfanReplyMonologue();
            });
            this.updateInteractionFocus();
          },
        });
      },
      "Continue",
    );
  }

  private startPrayerTimeDialogue(): void {
    if (this.dialogueActive || this.silentPauseActive || !this.shouldShowPrayerTimeBubble()) {
      return;
    }

    this.state = this.withStoryFlags(["prayerTimeRead"]);
    this.refreshPrayerTimeBubble();
    this.dialogueActive = true;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.stopFootsteps();
    this.overlay?.showPlainTutorialGuidance(
      "Phone Notification: \"It's Prayer Time!\"",
      () => {
        this.overlay?.showDialogue("prayer-time-1", {
          onChoice: (choice) => {
            this.state = applyChoice(this.state, choice);
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
          },
          onComplete: () => {
            this.dialogueActive = false;
            this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
            this.updateInteractionFocus();
          },
        });
      },
      "Continue",
    );
  }

  private showParentMailMonologue(): void {
    this.monologueQueue = [];
    this.monologueQueueIndex = 0;
    this.showPlayerMonologueBubble("Maybe after I finally get a proper job.", false);
  }

  private showZulfanReplyMonologue(): void {
    this.monologueQueue = [...GameplayScene.zulfanReplyMonologueLines];
    this.monologueQueueIndex = 0;
    this.showPlayerMonologueBubble(this.monologueQueue[this.monologueQueueIndex], true);
  }

  private showPlayerMonologueBubble(text: string | undefined, useZulfanReplySize: boolean): void {
    if (!text) {
      return;
    }

    this.destroyMonologueBubble();

    if (!this.player) {
      return;
    }

    const bubble = createSpeechBubble(this, {
      x: this.player.x,
      y: this.player.y - GameplayScene.monologueBubbleOffsetY,
      text,
      speaker: "Raka",
      maxWidth: useZulfanReplySize
        ? GameplayScene.zulfanReplyMonologueBubbleWidth
        : undefined,
      fixedWidth: useZulfanReplySize,
      theme: {
        fillColor: 0xffffff,
        borderColor: 0x3a3540,
        shadowColor: 0x1a1d28,
        textColor: "#1a1d28",
        speakerColor: "#b84f61",
      },
    }) as SpeechBubbleContainer;

    this.monologueBubble = bubble;
    this.monologueDismissReady = false;

    if (this.state.storyFlags.monologueEnterTutorialShown !== true) {
      this.dialogueActive = true;
      this.overlay?.showPlainTutorialGuidance(
        "Click Enter to dismiss the bubble chat.",
        () => {
          this.state = this.withStoryFlags(["monologueEnterTutorialShown"]);
          this.dialogueActive = false;
          this.time.delayedCall(800, () => {
            this.monologueDismissReady = true;
          });
        },
        "Got it",
      );
    } else {
      this.monologueDismissReady = true;
    }
  }

  private advanceMonologueBubble(): void {
    this.monologueDismissReady = false;

    if (this.monologueQueueIndex < this.monologueQueue.length - 1) {
      this.destroyMonologueBubble(() => {
        this.monologueQueueIndex += 1;
        this.showPlayerMonologueBubble(this.monologueQueue[this.monologueQueueIndex], true);
      });
      return;
    }

    this.monologueQueue = [];
    this.monologueQueueIndex = 0;
    this.destroyMonologueBubble();
  }

  private destroyMonologueBubble(onComplete?: () => void): void {
    if (!this.monologueBubble) {
      onComplete?.();
      return;
    }

    const bubble = this.monologueBubble;
    this.monologueBubble = undefined;
    bubble.destroyBubble(onComplete);
  }

  private updateMonologueBubblePosition(): void {
    if (!this.monologueBubble || !this.player) {
      return;
    }

    this.monologueBubble.setPosition(
      this.player.x,
      this.player.y - GameplayScene.monologueBubbleOffsetY,
    );
  }

  private isMessagePending(): boolean {
    return (
      (this.state.storyFlags.parentMessageAvailable === true &&
        this.state.storyFlags.parentMessageRead !== true) ||
      (this.state.storyFlags.zulfanMessageAvailable === true &&
        this.state.storyFlags.zulfanMessageRead !== true) ||
      (this.state.storyFlags.prayerTimeAvailable === true &&
        this.state.storyFlags.prayerTimeRead !== true)
    );
  }

  private canUseInteractableNow(interactable: Interactable): boolean {
    if (interactable.id === GameplayScene.parentMailInteractableId) {
      return this.shouldShowParentMailBubble();
    }

    if (interactable.id === GameplayScene.zulfanMailInteractableId) {
      return this.shouldShowZulfanMailBubble();
    }

    if (interactable.id === GameplayScene.prayerTimeInteractableId) {
      return this.shouldShowPrayerTimeBubble();
    }

    if (this.isMessagePending()) {
      return false;
    }

    if (!canInteract(this.state, interactable)) {
      return false;
    }

    if (this.isWaitingForFoodArrival()) {
      return false;
    }

    if (this.isWaitingForFoodDoorInteraction()) {
      return interactable.id === "door";
    }

    return true;
  }

  private getInteractionTargets(): Interactable[] {
    const interactables = getVisibleInteractables(this.state);
    const messageInteractables: Interactable[] = [];

    if (this.shouldShowParentMailBubble()) {
      messageInteractables.push(this.getParentMailInteractable());
    }

    if (this.shouldShowZulfanMailBubble()) {
      messageInteractables.push(this.getZulfanMailInteractable());
    }

    if (this.shouldShowPrayerTimeBubble()) {
      messageInteractables.push(this.getPrayerTimeInteractable());
    }

    return [...interactables, ...messageInteractables];
  }

  private getParentMailInteractable(): Interactable {
    return {
      id: GameplayScene.parentMailInteractableId,
      label: "Mail from Parent",
      kind: "object",
      x: GameplayScene.parentMailInteractionPose.x,
      y: GameplayScene.parentMailInteractionPose.y,
      radius: 58,
      dialogueId: "parent-message-1",
      repeatable: true,
    };
  }

  private getZulfanMailInteractable(): Interactable {
    return {
      id: GameplayScene.zulfanMailInteractableId,
      label: "Email from Friend",
      kind: "object",
      x: GameplayScene.zulfanMailInteractionPose.x,
      y: GameplayScene.zulfanMailInteractionPose.y,
      radius: 58,
      dialogueId: "zulfan-message-1",
      repeatable: true,
    };
  }

  private getPrayerTimeInteractable(): Interactable {
    return {
      id: GameplayScene.prayerTimeInteractableId,
      label: "Prayer Time",
      kind: "object",
      x: GameplayScene.prayerTimeInteractionPose.x,
      y: GameplayScene.prayerTimeInteractionPose.y,
      radius: 58,
      dialogueId: "prayer-time-1",
      repeatable: true,
    };
  }

  private isPointOnMailBubble(
    x: number,
    y: number,
    bubble: { x: number; y: number },
    hitBox: { width: number; height: number },
    interaction: { x: number; y: number },
  ): boolean {
    const onBubble =
      Math.abs(x - bubble.x) <= hitBox.width / 2 && Math.abs(y - bubble.y) <= hitBox.height / 2;
    if (onBubble) {
      return true;
    }

    return Phaser.Math.Distance.Between(x, y, interaction.x, interaction.y) <= 58;
  }

  private isWaitingForFoodArrival(): boolean {
    return (
      this.state.storyFlags.waitingForFoodOrder === true &&
      this.state.storyFlags.foodOrderArrived !== true
    );
  }

  private isWaitingForFoodDoorInteraction(): boolean {
    return (
      this.state.storyFlags.waitingForFoodOrder === true &&
      this.state.storyFlags.foodOrderArrived === true &&
      this.state.storyFlags.foodDoorOpened !== true
    );
  }

  private startFoodOrderSequence(deskInteractable: Interactable): void {
    this.state = this.withStoryFlags(["waitingForFoodOrder"]);
    this.completeDeskWorkInteraction(deskInteractable);
    this.scheduleFoodOrderArrival();
  }

  private scheduleFoodOrderArrival(): void {
    if (this.state.storyFlags.foodOrderArrived) {
      return;
    }

    this.time.delayedCall(GameplayScene.foodOrderArrivalDelayMs, () => {
      if (this.state.storyFlags.foodOrderArrived) {
        return;
      }

      this.playDoorbellSound();
      this.time.delayedCall(GameplayScene.doorKnockDelayMs, () => this.playDoorKnockSound());
      this.time.delayedCall(GameplayScene.foodOrderDialogueDelayMs, () => {
        this.showFoodOrderDialogue();
      });
    });
  }

  private showFoodOrderDialogue(): void {
    this.dialogueActive = true;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.stopFootsteps();
    this.overlay?.showDialogue("food-order-arrived", {
      onChoice: (choice) => {
        this.state = applyChoice(this.state, choice);
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      },
      onComplete: () => {
        this.showFoodDoorTutorial();
      },
    });
  }

  private showFoodDoorTutorial(): void {
    this.dialogueActive = true;
    this.overlay?.showPlainTutorialGuidance(
      "Your food order has arrived! Go to the door to receive it.",
      () => {
        this.state = this.withStoryFlags(["foodOrderArrived"]);
        this.dialogueActive = false;
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
        this.updateInteractionFocus();
      },
      "Continue",
    );
  }

  private finishDeskWorkAfterSilentPause(deskInteractable: Interactable): void {
    if (deskInteractable.afterMinigameDialogueId) {
      this.dialogueActive = true;
      this.overlay?.showDialogue(deskInteractable.afterMinigameDialogueId, {
        onChoice: (choice) => {
          this.state = applyChoice(this.state, choice);
          this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
        },
        onComplete: () => {
          this.completeDeskWorkInteraction(deskInteractable);
        },
      });
      return;
    }

    this.completeDeskWorkInteraction(deskInteractable);
  }

  private startSilentPause(onComplete: () => void): void {
    this.silentPauseActive = true;
    this.overlay?.setPrompt(null);

    if (this.player) {
      setPlayerIdle(this.player, this.playerFacing);
    }

    this.time.delayedCall(GameplayScene.postMinigameSilentMs, () => {
      this.silentPauseActive = false;
      onComplete();
    });
  }

  private completeDeskWorkInteraction(deskInteractable: Interactable): void {
    const previousRoom = this.state.currentRoom;
    this.state = completeInteraction(this.state, deskInteractable);
    this.dialogueActive = false;

    if (this.state.phase === "ending") {
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      this.overlay?.showEnding(() => this.scene.restart());
      return;
    }

    if (previousRoom !== this.state.currentRoom) {
      this.renderRoom();
    } else {
      this.refreshInteractables();
    }
  }

  private shouldPlayFoodDoorSequence(interactable: Interactable): boolean {
    return (
      this.isBedroom() &&
      interactable.id === "door" &&
      this.state.storyFlags.foodOrderArrived === true &&
      this.state.storyFlags.foodDoorOpened !== true
    );
  }

  private startFoodDoorSequence(interactable: Interactable): void {
    this.alignPlayerForInteraction(interactable);
    this.dialogueActive = true;
    this.silentPauseActive = true;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.overlay?.setPrompt(null);
    this.stopFootsteps();

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.playDoorRustleSound(() => {
        this.state = this.withStoryFlags(["foodDoorOpened"]);
        this.state = completeInteraction(this.state, interactable);
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
        this.refreshInteractables();
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
          this.showFoodOrderEnoughDialogue();
        });
        this.cameras.main.fadeIn(GameplayScene.doorFadeMs, 0, 0, 0);
      });
    });
    this.cameras.main.fadeOut(GameplayScene.doorFadeMs, 0, 0, 0);
  }

  private showFoodOrderEnoughDialogue(): void {
    this.silentPauseActive = false;
    this.dialogueActive = true;
    this.overlay?.showDialogue("food-order-enough", {
      onChoice: (choice) => {
        this.state = applyChoice(this.state, choice);
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      },
      onComplete: () => {
        this.state = this.withStoryFlags(["foodDoorReflectionSeen"]);
        this.dialogueActive = false;
        this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
        this.updateInteractionFocus();
      },
    });
  }

  private withStoryFlags(flags: string[]): GameState {
    const nextState: GameState = {
      ...this.state,
      storyFlags: { ...this.state.storyFlags },
      completedInteractions: [...this.state.completedInteractions],
    };

    for (const flag of flags) {
      nextState.storyFlags[flag] = true;
    }

    return nextState;
  }

  private playDoorbellSound(): void {
    this.sound.play("sfx.door.bell", { volume: 0.82 });
  }

  private playDoorKnockSound(): void {
    this.sound.play("sfx.door.knock", { volume: 0.86 });
  }

  private playKeyboardTapSound(): void {
    this.sound.play("sfx.keyboard.tap", { volume: 0.72 });
  }

  private playEarnMoneySound(): void {
    this.sound.play("sfx.money.earn", { volume: 0.86 });
  }

  private playBubblePopupSound(): void {
    this.sound.play("sfx.bubble.popup", { volume: 0.82 });
  }

  private playAdzanSound(): void {
    this.sound.play("sfx.prayer.adzan", { volume: 0.86 });
  }

  private playCricketSound(): void {
    this.sound.play("sfx.environment.cricket", { volume: 0.72 });
  }

  private playChickenSound(): void {
    this.sound.play("sfx.environment.chicken", { volume: 0.78 });
  }

  private startPhase1Backsound(): void {
    if (!this.phase1Backsound || this.phase1Backsound.isPlaying) {
      return;
    }

    this.phase1Backsound.play();
  }

  private stopPhase1Backsound(): void {
    if (!this.phase1Backsound?.isPlaying) {
      return;
    }

    this.phase1Backsound.stop();
  }

  private playDoorRustleSound(onComplete: () => void): void {
    const rustleSound = this.sound.add("sfx.door.rustle", { volume: 0.92 });
    let completed = false;
    const completeOnce = () => {
      if (completed) {
        return;
      }

      completed = true;
      rustleSound.destroy();
      onComplete();
    };

    rustleSound.once(Phaser.Sound.Events.COMPLETE, completeOnce);
    if (!rustleSound.play()) {
      completeOnce();
      return;
    }

    this.time.delayedCall(Math.ceil(rustleSound.totalDuration * 1000) + 250, completeOnce);
  }

  private isBedroom(): boolean {
    return this.state.currentRoom === "bedroom";
  }

  private getMoveTargetY(y: number): number {
    return this.isBedroom() ? GameplayScene.bedroomFloorY : y;
  }

  private resolveBedroomWardrobeCollision(previousX: number, nextX: number): number {
    if (!this.isBedroom()) {
      return nextX;
    }

    const { left, right } = GameplayScene.bedroomWardrobeCollider;
    if (previousX >= right && nextX < right) {
      return right;
    }

    if (previousX <= left && nextX > left) {
      return left;
    }

    if (previousX > left && previousX < right) {
      return previousX < (left + right) / 2 ? left : right;
    }

    return nextX;
  }

  private isBedroomDownFacingPressed(): boolean {
    if (!this.isBedroom() || !this.cursors || !this.keys) {
      return false;
    }

    return this.cursors.down.isDown || this.keys.S.isDown;
  }

  private isBedroomUpFacingPressed(): boolean {
    if (!this.isBedroom() || !this.cursors || !this.keys) {
      return false;
    }

    return this.cursors.up.isDown || this.keys.W.isDown;
  }
}
