import type { GameState } from "./types";

export function createInitialState(): GameState {
  return {
    phase: "buildUp",
    currentRoom: "bedroom",
    storyFlags: {},
    regretScore: 0,
    completedInteractions: [],
    arrowMinigame: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    phase: state.phase,
    currentRoom: state.currentRoom,
    storyFlags: { ...state.storyFlags },
    regretScore: state.regretScore,
    completedInteractions: [...state.completedInteractions],
    arrowMinigame: state.arrowMinigame
      ? {
          ...state.arrowMinigame,
          sequence: [...state.arrowMinigame.sequence],
        }
      : null,
  };
}
