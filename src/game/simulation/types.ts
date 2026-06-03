export type StoryPhase = "buildUp" | "actions" | "regret" | "ending";

export type RoomId = "bedroom" | "street" | "replay";

export interface GameState {
  phase: StoryPhase;
  currentRoom: RoomId;
  storyFlags: Record<string, boolean>;
  regretScore: number;
  completedInteractions: string[];
}

export interface Choice {
  label: string;
  next?: string;
  setFlags?: string[];
  regretDelta?: number;
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
