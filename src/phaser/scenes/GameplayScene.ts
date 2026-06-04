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
import { createMailBubble, setMailBubbleHighlighted } from "../view/mailBubble";
import {
  createPlayerAnimations,
  createInteractableView,
  createPlayer,
  drawRoom,
  playPlayerWalk,
  preloadPlayerSprites,
  preloadRoomSprites,
  setPlayerIdle,
  setPlayerMirrorIdle,
  setInteractableHighlighted,
  type PlayerFacing,
} from "../view/proceduralRoom";

export class GameplayScene extends Phaser.Scene {
  private static readonly firstWorkRewardGuidance =
    "You earned $25 for working hard. Keep working to earn more money.";
  private static readonly vacanciesDialogueMoneyThreshold = 50;
  private static readonly applications125DialogueMoneyThreshold = 125;
  private static readonly foodOrderMoneyThreshold = 75;
  private static readonly keepPushingDialogueMoneyThreshold = 150;
  private static readonly parentMessageMoneyThreshold = 150;
  private static readonly bedroomFloorY = 486;
  private static readonly bedroomWardrobeCollider = { left: 135, right: 160 };
  private static readonly bedroomDoorInteractionPose = { x: 200, y: 486, facing: "up" as const };
  private static readonly bedroomWardrobeInteractionPose = { x: 170, y: 486, facing: "left" as const };
  private static readonly bedroomLaptopInteractionPose = { x: 600, y: 486, facing: "up" as const };
  private static readonly parentMailInteractableId = "parent-mail";
  private static readonly parentMailBubblePose = { x: 742, y: 306 };
  private static readonly parentMailInteractionPose = { x: 696, y: 486, facing: "up" as const };
  private static readonly parentMailBubbleHitBox = { width: 104, height: 112 };
  private static readonly footstepVolume = 0.34;
  private static readonly footstepRate = 1.5;
  private static readonly postMinigameSilentMs = 1200;
  private static readonly foodOrderArrivalDelayMs = 900;
  private static readonly doorKnockDelayMs = 900;
  private static readonly foodOrderDialogueDelayMs = 1550;
  private static readonly doorFadeMs = 1800;
  private state: GameState = createInitialState();
  private overlay?: NarrativeOverlay;
  private roomGraphics?: Phaser.GameObjects.Graphics;
  private player?: Phaser.GameObjects.Sprite;
  private parentMailBubble?: Phaser.GameObjects.Container;
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

  constructor() {
    super("GameplayScene");
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
    this.load.image("ui.mail", assetManifest.ui["ui.mail"]);
  }

  create(): void {
    this.state = createInitialState();
    this.overlay = new NarrativeOverlay();
    this.overlay.mountHud();
    this.overlay.clearEnding();
    createPlayerAnimations(this);
    this.footstepSound = this.sound.add("sfx.player.footstep", {
      loop: true,
      rate: GameplayScene.footstepRate,
      volume: GameplayScene.footstepVolume,
    });

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,E,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    this.roomGraphics = this.add.graphics();
    this.renderRoom();
    this.bindInput();
    this.setPlayerAtBedroomLaptop();
    this.startFreeDialogue("opening", () => this.showOpeningArrowTutorial());
  }

  update(_: number, delta: number): void {
    if (this.dialogueActive || this.silentPauseActive || this.state.phase === "ending") {
      this.stopFootsteps();
      return;
    }

    if (this.state.arrowMinigame) {
      this.stopFootsteps();
      this.updateDeskMinigame(delta);
      return;
    }

    this.updateMovement(delta / 1000);
    this.updateInteractionFocus();
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

      if (this.isParentMessagePending()) {
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
    this.highlightedId = null;

    drawRoom(this, this.roomGraphics, room.id);

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

    this.overlay?.updateHud(this.state, room.title);
    this.overlay?.setPrompt(null);
    this.overlay?.hideArrowMinigame();
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
        setPlayerIdle(this.player, this.playerFacing);
        this.stopFootsteps();
        this.tryInteract(this.pendingInteractableId);
        this.pendingInteractableId = null;
      } else {
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
    this.player.setDepth(this.player.y + 8);
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
          return this.isPointOnParentMailBubble(x, y);
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
      setPlayerIdle(this.player, this.playerFacing);
      this.player.setDepth(this.player.y + 8);
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
      setPlayerMirrorIdle(this.player);
      this.player.setDepth(this.player.y + 8);
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
    setPlayerIdle(this.player, this.playerFacing);
    this.player.setDepth(this.player.y + 8);
    this.stopFootsteps();
  }

  private setPlayerAtBedroomLaptop(): void {
    if (!this.player || !this.isBedroom()) {
      return;
    }

    this.playerFacing = GameplayScene.bedroomLaptopInteractionPose.facing;
    this.player.setPosition(
      GameplayScene.bedroomLaptopInteractionPose.x,
      GameplayScene.bedroomLaptopInteractionPose.y,
    );
    setPlayerIdle(this.player, this.playerFacing);
    this.player.setDepth(this.player.y + 8);
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
          GameplayScene.bedroomLaptopInteractionPose.x,
          GameplayScene.bedroomLaptopInteractionPose.y,
        );
      } else {
        this.player.setPosition(interactable.x, this.getMoveTargetY(interactable.y + 24));
      }
      setPlayerIdle(this.player, this.playerFacing);
      this.player.setDepth(this.player.y + 8);
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
    this.state = clearArrowMinigame(this.state);
    let shouldShowFirstWorkRewardGuidance = false;
    let rewardDialogueId: string | null = null;
    if (this.shouldEarnMoneyFromWork(deskInteractable)) {
      shouldShowFirstWorkRewardGuidance = this.shouldShowFirstWorkRewardGuidance();
      this.state = earnMoney(this.state);
      this.playEarnMoneySound();
      if (shouldShowFirstWorkRewardGuidance) {
        this.state = this.withStoryFlags(["firstWorkRewardNotificationShown"]);
      }
      rewardDialogueId = this.getEarnMoneyDialogueId();
      if (rewardDialogueId === "money-50-vacancies") {
        this.state = this.withStoryFlags(["vacanciesMoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-125-applications") {
        this.state = this.withStoryFlags(["applications125MoneyDialogueSeen"]);
      } else if (rewardDialogueId === "money-150-keep-pushing") {
        this.state = this.withStoryFlags(["keepPushingMoneyDialogueSeen"]);
      }
      if (this.shouldUnlockParentMessage()) {
        this.state = this.withStoryFlags(["parentMessageAvailable"]);
      }
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      this.refreshParentMailBubble();
    }

    this.activeDeskInteractable = null;
    this.pendingInteractableId = null;
    this.moveTarget = null;

    if (shouldShowFirstWorkRewardGuidance) {
      this.showFirstWorkRewardGuidance(() => {
        this.showEarnMoneyDialogueIfNeeded(rewardDialogueId, () =>
          this.continueAfterDeskWork(deskInteractable),
        );
      });
      return;
    }

    this.showEarnMoneyDialogueIfNeeded(rewardDialogueId, () =>
      this.continueAfterDeskWork(deskInteractable),
    );
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

  private shouldShowFirstWorkRewardGuidance(): boolean {
    return this.state.storyFlags.firstWorkRewardNotificationShown !== true;
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
      return "money-150-keep-pushing";
    }

    return null;
  }

  private showFirstWorkRewardGuidance(onComplete: () => void): void {
    this.dialogueActive = true;
    this.overlay?.showPlainTutorialGuidance(
      GameplayScene.firstWorkRewardGuidance,
      () => {
        this.dialogueActive = false;
        onComplete();
      },
      "Continue",
    );
  }

  private showEarnMoneyDialogueIfNeeded(dialogueId: string | null, onComplete: () => void): void {
    if (!dialogueId) {
      onComplete();
      return;
    }

    this.startFreeDialogue(dialogueId, onComplete);
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
    this.overlay?.showDialogue("parent-message-1", {
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
  }

  private isParentMessagePending(): boolean {
    return (
      this.state.storyFlags.parentMessageAvailable === true &&
      this.state.storyFlags.parentMessageRead !== true
    );
  }

  private canUseInteractableNow(interactable: Interactable): boolean {
    if (interactable.id === GameplayScene.parentMailInteractableId) {
      return this.shouldShowParentMailBubble();
    }

    if (this.isParentMessagePending()) {
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
    if (!this.shouldShowParentMailBubble()) {
      return interactables;
    }

    return [...interactables, this.getParentMailInteractable()];
  }

  private getParentMailInteractable(): Interactable {
    return {
      id: GameplayScene.parentMailInteractableId,
      label: "Mail",
      kind: "object",
      x: GameplayScene.parentMailInteractionPose.x,
      y: GameplayScene.parentMailInteractionPose.y,
      radius: 58,
      dialogueId: "parent-message-1",
      repeatable: true,
    };
  }

  private isPointOnParentMailBubble(x: number, y: number): boolean {
    const bubble = GameplayScene.parentMailBubblePose;
    const hitBox = GameplayScene.parentMailBubbleHitBox;
    const onBubble =
      Math.abs(x - bubble.x) <= hitBox.width / 2 && Math.abs(y - bubble.y) <= hitBox.height / 2;
    if (onBubble) {
      return true;
    }

    const interaction = GameplayScene.parentMailInteractionPose;
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
