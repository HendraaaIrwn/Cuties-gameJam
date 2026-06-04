export type StoryPhase = "buildUp" | "actions" | "replay" | "ending";

export type RoomId = "bedroom" | "street" | "replay";

export type ArrowDirection = "up" | "down" | "left" | "right";

export interface ArrowMinigameState {
  sequence: ArrowDirection[];
  currentIndex: number;
  loopsCompleted: number;
  loopsRequired: number;
  timeRemainingMs: number;
  totalTimeMs: number;
  attempts: number;
  mistakes: number;
}

export interface GameState {
  phase: StoryPhase;
  currentRoom: RoomId;
  storyFlags: Record<string, boolean>;
  completedInteractions: string[];
  arrowMinigame: ArrowMinigameState | null;
}

export interface Choice {
  label: string;
  next?: string;
  setFlags?: string[];
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  portraitKey?: string;
  next?: string;
  choices?: Choice[];
}

export interface Interactable {
  id: string;
  label: string;
  kind: "object" | "npc" | "exit" | "shadow";
  x: number;
  y: number;
  radius: number;
  dialogueId: string;
  requiredFlags?: string[];
  hiddenFlags?: string[];
  onCompleteFlags?: string[];
  repeatable?: boolean;
  startsDeskMinigame?: boolean;
  afterMinigameDialogueId?: string;
}

export interface RoomDefinition {
  id: RoomId;
  title: string;
  backgroundKey: string;
  playerStart: { x: number; y: number };
  interactables: Interactable[];
}

export interface AssetManifest {
  characters: Record<string, string>;
  rooms: Record<string, string>;
  ui: Record<string, string>;
  audio: Record<string, string>;
}
