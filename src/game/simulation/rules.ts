import { rooms } from "../content/rooms";
import type { Choice, GameState, Interactable, RoomDefinition } from "./types";

const buildUpRequired = ["laptop", "calendar", "mirror"];
const actionsRequired = ["friend", "parent-call", "work-desk"];
const regretRequired = ["replay-friend", "replay-parent", "final-question"];

export function hasFlags(state: GameState, flags: string[] = []): boolean {
  return flags.every((flag) => state.storyFlags[flag]);
}

export function isInteractableVisible(state: GameState, interactable: Interactable): boolean {
  if (!hasFlags(state, interactable.requiredFlags)) {
    return false;
  }

  return !interactable.hiddenFlags?.some((flag) => state.storyFlags[flag]);
}

export function getCurrentRoom(state: GameState): RoomDefinition {
  return rooms[state.currentRoom];
}

export function getVisibleInteractables(state: GameState): Interactable[] {
  return getCurrentRoom(state).interactables.filter((interactable) =>
    isInteractableVisible(state, interactable),
  );
}

export function canInteract(state: GameState, interactable: Interactable): boolean {
  if (!isInteractableVisible(state, interactable)) {
    return false;
  }

  return interactable.repeatable || !state.completedInteractions.includes(interactable.id);
}

export function applyChoice(state: GameState, choice: Choice): GameState {
  const nextState = {
    ...state,
    storyFlags: { ...state.storyFlags },
    completedInteractions: [...state.completedInteractions],
    regretScore: Math.max(0, state.regretScore + (choice.regretDelta ?? 0)),
  };

  for (const flag of choice.setFlags ?? []) {
    nextState.storyFlags[flag] = true;
  }

  return nextState;
}

export function completeInteraction(state: GameState, interactable: Interactable): GameState {
  const nextState = {
    ...state,
    storyFlags: { ...state.storyFlags },
    completedInteractions: interactable.repeatable
      ? [...state.completedInteractions]
      : [...new Set([...state.completedInteractions, interactable.id])],
  };

  for (const flag of interactable.onCompleteFlags ?? []) {
    nextState.storyFlags[flag] = true;
  }

  return advancePhase(nextState);
}

export function advancePhase(state: GameState): GameState {
  const completed = new Set(state.completedInteractions);

  if (state.phase === "buildUp" && buildUpRequired.every((id) => completed.has(id))) {
    return {
      ...state,
      phase: "actions",
      currentRoom: "street",
      storyFlags: { ...state.storyFlags, phaseActionsStarted: true },
      completedInteractions: state.completedInteractions.filter((id) => !buildUpRequired.includes(id)),
    };
  }

  if (state.phase === "actions" && actionsRequired.every((id) => completed.has(id))) {
    return {
      ...state,
      phase: "regret",
      currentRoom: "replay",
      storyFlags: { ...state.storyFlags, collapsed: true },
      completedInteractions: [],
    };
  }

  if (state.phase === "regret" && regretRequired.every((id) => completed.has(id))) {
    return {
      ...state,
      phase: "ending",
      storyFlags: { ...state.storyFlags, endingUnlocked: true },
    };
  }

  return state;
}
