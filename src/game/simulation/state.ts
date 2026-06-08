import type { GameState } from "./types";

export function createInitialState(): GameState {
  return {
    phase: "buildUp",
    currentRoom: "bedroom",
    storyFlags: {},
    completedInteractions: [],
    arrowMinigame: null,
    typingMinigame: null,
    money: 0,
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
    typingMinigame: state.typingMinigame
      ? {
          ...state.typingMinigame,
          words: [...state.typingMinigame.words],
        }
      : null,
    money: state.money,
  };
}
