import Phaser from "phaser";
import { dialogues } from "../../game/content/dialogues";
import { createInitialState } from "../../game/simulation/state";
import {
  applyChoice,
  canInteract,
  clearArrowMinigame,
  completeInteraction,
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
  createPlayerAnimations,
  createInteractableView,
  createPlayer,
  drawRoom,
  playPlayerWalk,
  preloadPlayerSprites,
  setPlayerIdle,
  setInteractableHighlighted,
  type PlayerFacing,
} from "../view/proceduralRoom";

export class GameplayScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private overlay?: NarrativeOverlay;
  private roomGraphics?: Phaser.GameObjects.Graphics;
  private player?: Phaser.GameObjects.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private interactableViews = new Map<string, Phaser.GameObjects.Container>();
  private moveTarget: Phaser.Math.Vector2 | null = null;
  private pendingInteractableId: string | null = null;
  private activeDeskInteractable: Interactable | null = null;
  private highlightedId: string | null = null;
  private dialogueActive = false;
  private playerFacing: PlayerFacing = "down";

  constructor() {
    super("GameplayScene");
  }

  preload(): void {
    preloadPlayerSprites(this);
  }

  create(): void {
    this.state = createInitialState();
    this.overlay = new NarrativeOverlay();
    this.overlay.mountHud();
    this.overlay.clearEnding();
    createPlayerAnimations(this);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,E,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    this.roomGraphics = this.add.graphics();
    this.renderRoom();
    this.bindInput();
    this.startFreeDialogue("opening");
  }

  update(_: number, delta: number): void {
    if (this.dialogueActive || this.state.phase === "ending") {
      return;
    }

    if (this.state.arrowMinigame) {
      this.updateDeskMinigame(delta);
      return;
    }

    this.updateMovement(delta / 1000);
    this.updateInteractionFocus();
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.dialogueActive || this.state.phase === "ending") {
        return;
      }

      if (this.state.arrowMinigame) {
        return;
      }

      const clicked = this.findInteractableAt(pointer.worldX, pointer.worldY);
      if (clicked) {
        this.pendingInteractableId = clicked.id;
        this.moveTarget = new Phaser.Math.Vector2(clicked.x, clicked.y + 18);
        return;
      }

      this.pendingInteractableId = null;
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });
  }

  private renderRoom(): void {
    const room = getCurrentRoom(this.state);
    if (!this.roomGraphics) {
      return;
    }

    this.interactableViews.forEach((view) => view.destroy(true));
    this.interactableViews.clear();
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
    if (this.cursors.up.isDown || this.keys.W.isDown) direction.y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) direction.y += 1;

    if (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryInteract(this.highlightedId);
    }

    if (direction.lengthSq() > 0) {
      this.moveTarget = null;
      this.pendingInteractableId = null;
      this.setPlayerWalkFromDirection(direction);
      direction.normalize().scale(speed * seconds);
      this.player.x += direction.x;
      this.player.y += direction.y;
    } else if (this.moveTarget) {
      const toTarget = this.moveTarget.clone().subtract(new Phaser.Math.Vector2(this.player.x, this.player.y));
      const distance = toTarget.length();
      const step = speed * seconds;
      if (distance <= step) {
        this.player.setPosition(this.moveTarget.x, this.moveTarget.y);
        this.moveTarget = null;
        setPlayerIdle(this.player, this.playerFacing);
        this.tryInteract(this.pendingInteractableId);
        this.pendingInteractableId = null;
      } else {
        this.setPlayerWalkFromDirection(toTarget);
        toTarget.normalize().scale(step);
        this.player.x += toTarget.x;
        this.player.y += toTarget.y;
      }
    } else {
      setPlayerIdle(this.player, this.playerFacing);
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 38, 922);
    this.player.y = Phaser.Math.Clamp(this.player.y, 276, 440);
    this.player.setDepth(this.player.y + 8);
  }

  private setPlayerWalkFromDirection(direction: Phaser.Math.Vector2): void {
    if (!this.player) {
      return;
    }

    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      this.playerFacing = direction.x >= 0 ? "right" : "left";
    } else {
      this.playerFacing = direction.y >= 0 ? "down" : "up";
    }

    playPlayerWalk(this.player, this.playerFacing);
  }

  private updateInteractionFocus(): void {
    const nearest = this.findNearestInteractable();
    if (nearest?.id !== this.highlightedId) {
      if (this.highlightedId) {
        const previous = this.interactableViews.get(this.highlightedId);
        if (previous) setInteractableHighlighted(previous, false);
      }

      this.highlightedId = nearest?.id ?? null;
      if (this.highlightedId) {
        const next = this.interactableViews.get(this.highlightedId);
        if (next) setInteractableHighlighted(next, true);
      }
    }

    this.overlay?.setPrompt(nearest ? nearest.label : null);
  }

  private findNearestInteractable(): Interactable | null {
    if (!this.player) {
      return null;
    }

    let nearest: Interactable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const interactable of getVisibleInteractables(this.state)) {
      if (!canInteract(this.state, interactable)) {
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
      getVisibleInteractables(this.state).find((interactable) => {
        if (!canInteract(this.state, interactable)) {
          return false;
        }
        return Phaser.Math.Distance.Between(x, y, interactable.x, interactable.y) <= interactable.radius;
      }) ?? null
    );
  }

  private tryInteract(interactableId: string | null): void {
    if (!interactableId || this.dialogueActive) {
      return;
    }

    const interactable = getVisibleInteractables(this.state).find((item) => item.id === interactableId);
    if (!interactable || !canInteract(this.state, interactable)) {
      return;
    }

    this.startInteractionDialogue(interactable);
  }

  private startFreeDialogue(dialogueId: string): void {
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
      },
    });
  }

  private startInteractionDialogue(interactable: Interactable): void {
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
          this.overlay?.showEnding(this.state.regretScore, () => this.scene.restart());
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

  private startDeskWork(interactable: Interactable): void {
    this.state = startDeskMinigame(this.state);
    this.activeDeskInteractable = interactable;
    this.pendingInteractableId = null;
    this.moveTarget = null;
    this.highlightedId = null;
    this.playerFacing = "up";

    if (this.player) {
      this.player.setPosition(interactable.x, interactable.y + 24);
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
    this.activeDeskInteractable = null;
    this.pendingInteractableId = null;
    this.moveTarget = null;

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

  private completeDeskWorkInteraction(deskInteractable: Interactable): void {
    const previousRoom = this.state.currentRoom;
    this.state = completeInteraction(this.state, deskInteractable);
    this.dialogueActive = false;

    if (this.state.phase === "ending") {
      this.overlay?.updateHud(this.state, getCurrentRoom(this.state).title);
      this.overlay?.showEnding(this.state.regretScore, () => this.scene.restart());
      return;
    }

    if (previousRoom !== this.state.currentRoom) {
      this.renderRoom();
    } else {
      this.refreshInteractables();
    }
  }
}
