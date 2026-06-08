import { rooms } from "../content/rooms";
import { stageForMoney, typingWordPools } from "../content/typingWords";
import type {
  ArrowDirection,
  ArrowMinigameState,
  Choice,
  GameState,
  Interactable,
  RoomDefinition,
  TypingMinigameState,
} from "./types";

const buildUpRequired: string[] = [];
const actionsRequired = ["friend", "parent-call", "work-desk"];
const replayRequired = ["replay-friend", "replay-parent", "final-question"];
const arrowDirections: ArrowDirection[] = ["up", "down", "left", "right"];
const deskSequenceLength = 6;
const deskLoopCount = 1;
const deskTimeLimitMs = 6000;
const deskTimeStepMs = 2000;
const deskMinimumTimeMs = 3600;
const workRewardMoney = 25;
const typingWordsPerLoop = 5;
const typingTimeLimitMs = 12000;
const typingTimeStepMs = 1500;
const typingMinimumTimeMs = 7000;

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
    arrowMinigame: state.arrowMinigame,
    typingMinigame: state.typingMinigame,
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

export function earnMoney(state: GameState, amount = workRewardMoney): GameState {
  return {
    ...state,
    storyFlags: { ...state.storyFlags },
    completedInteractions: [...state.completedInteractions],
    money: state.money + amount,
  };
}

export function shouldStartDeskMinigame(interactable: Interactable): boolean {
  return interactable.startsDeskMinigame === true;
}

export function startDeskMinigame(state: GameState): GameState {
  return {
    ...state,
    storyFlags: { ...state.storyFlags, workingAtDesk: true },
    typingMinigame: createTypingMinigame(state.money),
  };
}

export function createTypingMinigame(currentMoney: number, attempts = 1, mistakes = 0): TypingMinigameState {
  const stage = stageForMoney(currentMoney);
  const pool = typingWordPools[stage];
  const totalTimeMs = getTypingLoopTimeLimit(0);

  return {
    words: pickTypingWords(pool, typingWordsPerLoop),
    currentWordIndex: 0,
    typedSoFar: "",
    loopsCompleted: 0,
    loopsRequired: deskLoopCount,
    timeRemainingMs: totalTimeMs,
    totalTimeMs,
    attempts,
    mistakes,
    stageLabel: stage,
  };
}

export function updateTypingMinigame(state: GameState, elapsedMs: number): GameState {
  if (!state.typingMinigame) {
    return state;
  }

  const timeRemainingMs = Math.max(0, state.typingMinigame.timeRemainingMs - elapsedMs);
  if (timeRemainingMs > 0) {
    return {
      ...state,
      typingMinigame: {
        ...state.typingMinigame,
        timeRemainingMs,
      },
    };
  }

  return {
    ...state,
    typingMinigame: createTypingMinigame(
      state.money,
      state.typingMinigame.attempts + 1,
      state.typingMinigame.mistakes + 1,
    ),
  };
}

export function typeCharacter(state: GameState, char: string): GameState {
  if (!state.typingMinigame) {
    return state;
  }

  const mg = state.typingMinigame;
  const currentWord = mg.words[mg.currentWordIndex];
  const nextTyped = mg.typedSoFar + char.toLowerCase();

  if (currentWord.startsWith(nextTyped)) {
    if (nextTyped === currentWord) {
      return advanceTypingWord(state);
    }

    return {
      ...state,
      typingMinigame: {
        ...mg,
        typedSoFar: nextTyped,
      },
    };
  }

  return {
    ...state,
    typingMinigame: {
      ...mg,
      mistakes: mg.mistakes + 1,
    },
  };
}

export function typeBackspace(state: GameState): GameState {
  if (!state.typingMinigame || state.typingMinigame.typedSoFar === "") {
    return state;
  }

  return {
    ...state,
    typingMinigame: {
      ...state.typingMinigame,
      typedSoFar: state.typingMinigame.typedSoFar.slice(0, -1),
    },
  };
}

export function isTypingMinigameComplete(state: GameState): boolean {
  return Boolean(
    state.typingMinigame &&
      state.typingMinigame.loopsCompleted >= state.typingMinigame.loopsRequired,
  );
}

export function clearTypingMinigame(state: GameState): GameState {
  return {
    ...state,
    storyFlags: { ...state.storyFlags, workingAtDesk: false, completedDeskMinigame: true },
    typingMinigame: null,
  };
}

function advanceTypingWord(state: GameState): GameState {
  if (!state.typingMinigame) {
    return state;
  }

  const mg = state.typingMinigame;
  const nextWordIndex = mg.currentWordIndex + 1;

  if (nextWordIndex < mg.words.length) {
    return {
      ...state,
      typingMinigame: {
        ...mg,
        currentWordIndex: nextWordIndex,
        typedSoFar: "",
      },
    };
  }

  const loopsCompleted = mg.loopsCompleted + 1;
  if (loopsCompleted >= mg.loopsRequired) {
    return {
      ...state,
      typingMinigame: {
        ...mg,
        currentWordIndex: mg.words.length,
        typedSoFar: "",
        loopsCompleted,
      },
    };
  }

  const stage = stageForMoney(state.money);
  const pool = typingWordPools[stage];
  const totalTimeMs = getTypingLoopTimeLimit(loopsCompleted);

  return {
    ...state,
    typingMinigame: {
      words: pickTypingWords(pool, typingWordsPerLoop),
      currentWordIndex: 0,
      typedSoFar: "",
      loopsCompleted,
      loopsRequired: mg.loopsRequired,
      timeRemainingMs: totalTimeMs,
      totalTimeMs,
      attempts: mg.attempts,
      mistakes: mg.mistakes,
      stageLabel: stage,
    },
  };
}

function pickTypingWords(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function getTypingLoopTimeLimit(loopsCompleted: number): number {
  return Math.max(typingMinimumTimeMs, typingTimeLimitMs - loopsCompleted * typingTimeStepMs);
}

export function updateArrowMinigame(state: GameState, elapsedMs: number): GameState {
  if (!state.arrowMinigame) {
    return state;
  }

  const timeRemainingMs = Math.max(0, state.arrowMinigame.timeRemainingMs - elapsedMs);
  if (timeRemainingMs > 0) {
    return {
      ...state,
      arrowMinigame: {
        ...state.arrowMinigame,
        timeRemainingMs,
      },
    };
  }

  return {
    ...state,
    arrowMinigame: createArrowMinigame(
      state.arrowMinigame.attempts + 1,
      state.arrowMinigame.mistakes + 1,
    ),
  };
}

export function pressArrowInput(state: GameState, direction: ArrowDirection): GameState {
  if (!state.arrowMinigame) {
    return state;
  }

  const expected = state.arrowMinigame.sequence[state.arrowMinigame.currentIndex];
  if (direction !== expected) {
    return {
      ...state,
      arrowMinigame: {
        ...state.arrowMinigame,
        currentIndex: Math.max(0, state.arrowMinigame.currentIndex - 1),
        mistakes: state.arrowMinigame.mistakes + 1,
      },
    };
  }

  return {
    ...state,
    arrowMinigame: {
      ...state.arrowMinigame,
      ...advanceArrowProgress(state.arrowMinigame),
    },
  };
}

export function isArrowMinigameComplete(state: GameState): boolean {
  return Boolean(
    state.arrowMinigame &&
      state.arrowMinigame.loopsCompleted >= state.arrowMinigame.loopsRequired,
  );
}

export function clearArrowMinigame(state: GameState): GameState {
  return {
    ...state,
    storyFlags: { ...state.storyFlags, workingAtDesk: false, completedDeskMinigame: true },
    arrowMinigame: null,
  };
}

export function advancePhase(state: GameState): GameState {
  const completed = new Set(state.completedInteractions);

  if (
    state.phase === "buildUp" &&
    buildUpRequired.length > 0 &&
    buildUpRequired.every((id) => completed.has(id))
  ) {
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
      phase: "replay",
      currentRoom: "replay",
      storyFlags: { ...state.storyFlags, collapsed: true },
      completedInteractions: [],
    };
  }

  if (state.phase === "replay" && replayRequired.every((id) => completed.has(id))) {
    return {
      ...state,
      phase: "ending",
      storyFlags: { ...state.storyFlags, endingUnlocked: true },
    };
  }

  return state;
}

function createArrowMinigame(attempts = 1, mistakes = 0): ArrowMinigameState {
  const totalTimeMs = getDeskLoopTimeLimit(0);

  return {
    sequence: Array.from({ length: deskSequenceLength }, () => PhaserlessRandom.pick(arrowDirections)),
    currentIndex: 0,
    loopsCompleted: 0,
    loopsRequired: deskLoopCount,
    timeRemainingMs: totalTimeMs,
    totalTimeMs,
    attempts,
    mistakes,
  };
}

function advanceArrowProgress(minigame: ArrowMinigameState): Partial<ArrowMinigameState> {
  const nextIndex = minigame.currentIndex + 1;
  if (nextIndex < minigame.sequence.length) {
    return { currentIndex: nextIndex };
  }

  const loopsCompleted = minigame.loopsCompleted + 1;
  if (loopsCompleted >= minigame.loopsRequired) {
    return {
      currentIndex: minigame.sequence.length,
      loopsCompleted,
    };
  }

  const totalTimeMs = getDeskLoopTimeLimit(loopsCompleted);

  return {
    sequence: Array.from({ length: deskSequenceLength }, () => PhaserlessRandom.pick(arrowDirections)),
    currentIndex: 0,
    loopsCompleted,
    timeRemainingMs: totalTimeMs,
    totalTimeMs,
  };
}

function getDeskLoopTimeLimit(loopsCompleted: number): number {
  return Math.max(deskMinimumTimeMs, deskTimeLimitMs - loopsCompleted * deskTimeStepMs);
}

const PhaserlessRandom = {
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  },
};
