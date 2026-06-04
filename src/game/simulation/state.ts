import type { GameState } from "./types";

export function createInitialState(): GameState {
  return {
    phase: "buildUp",
    currentRoom: "bedroom",
    storyFlags: {},
    completedInteractions: [],
    arrowMinigame: null,
    money: 125,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    phase: state.phase,
    currentRoom: state.currentRoom,
    storyFlags: { ...state.storyFlags },
    completedInteractions: [...state.completedInteractions],
    arrowMinigame: state.arrowMinigame
      ? {
          ...state.arrowMinigame,
          sequence: [...state.arrowMinigame.sequence],
        }
      : null,
    money: state.money,
  };
}
