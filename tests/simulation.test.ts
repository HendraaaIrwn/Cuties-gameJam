import { describe, expect, it } from "vitest";
import { rooms } from "../src/game/content/rooms";
import {
  applyChoice,
  clearArrowMinigame,
  completeInteraction,
  getVisibleInteractables,
  isArrowMinigameComplete,
  pressArrowInput,
  shouldStartDeskMinigame,
  startDeskMinigame,
  updateArrowMinigame,
} from "../src/game/simulation/rules";
import { createInitialState } from "../src/game/simulation/state";
import type { GameState } from "../src/game/simulation/types";

describe("story simulation", () => {
  it("applies choice flags and regret deltas", () => {
    const state = createInitialState();
    const nextState = applyChoice(state, {
      label: "Tolak",
      setFlags: ["rejectedFriend", "handledFriend"],
      regretDelta: 2,
    });

    expect(nextState.storyFlags.rejectedFriend).toBe(true);
    expect(nextState.storyFlags.handledFriend).toBe(true);
    expect(nextState.regretScore).toBe(2);
  });

  it("advances from build up to actions after required interactions", () => {
    const [laptop, calendar, mirror] = ["laptop", "calendar", "mirror"].map((id) => {
      const interactable = rooms.bedroom.interactables.find((item) => item.id === id);
      if (!interactable) throw new Error(`missing ${id}`);
      return interactable;
    });

    let state = createInitialState();
    state = completeInteraction(state, laptop);
    state = completeInteraction(state, calendar);
    state = completeInteraction(state, mirror);

    expect(state.phase).toBe("actions");
    expect(state.currentRoom).toBe("street");
    expect(state.storyFlags.phaseActionsStarted).toBe(true);
  });

  it("keeps gated interactables hidden until required flags are present", () => {
    const initialState = {
      ...createInitialState(),
      phase: "actions" as const,
      currentRoom: "street" as const,
    };

    expect(getVisibleInteractables(initialState).some((item) => item.id === "work-desk")).toBe(false);

    const unlockedState = {
      ...initialState,
      storyFlags: {
        handledFriend: true,
        handledParentCall: true,
      },
    };

    expect(getVisibleInteractables(unlockedState).some((item) => item.id === "work-desk")).toBe(true);
  });

  it("marks both laptop and work desk interactions as desk minigame triggers", () => {
    const laptop = rooms.bedroom.interactables.find((item) => item.id === "laptop");
    const workDesk = rooms.street.interactables.find((item) => item.id === "work-desk");
    const calendar = rooms.bedroom.interactables.find((item) => item.id === "calendar");

    if (!laptop || !workDesk || !calendar) {
      throw new Error("missing minigame trigger fixture");
    }

    expect(shouldStartDeskMinigame(laptop)).toBe(true);
    expect(shouldStartDeskMinigame(workDesk)).toBe(true);
    expect(workDesk.afterMinigameDialogueId).toBe("collapse");
    expect(shouldStartDeskMinigame(calendar)).toBe(false);
  });

  it("keeps the desk interaction incomplete while the arrow minigame is running", () => {
    const state = startDeskMinigame({
      ...createInitialState(),
      phase: "actions",
      currentRoom: "street",
      storyFlags: {
        handledFriend: true,
        handledParentCall: true,
      },
    });

    expect(state.storyFlags.workingAtDesk).toBe(true);
    expect(state.completedInteractions).not.toContain("work-desk");
    expect(state.arrowMinigame?.sequence).toHaveLength(6);
    expect(state.arrowMinigame?.loopsRequired).toBe(5);
    expect(state.arrowMinigame?.loopsCompleted).toBe(0);
  });

  it("completes the arrow minigame only after five loops are pressed", () => {
    let state = startDeskMinigame({
      ...createInitialState(),
      phase: "actions",
      currentRoom: "street",
    });

    const firstSequence = state.arrowMinigame?.sequence ?? [];
    for (const direction of firstSequence) {
      state = pressArrowInput(state, direction);
    }

    expect(state.arrowMinigame?.loopsCompleted).toBe(1);
    expect(isArrowMinigameComplete(state)).toBe(false);

    while (!isArrowMinigameComplete(state)) {
      const sequence = state.arrowMinigame?.sequence ?? [];
      for (const direction of sequence) {
        state = pressArrowInput(state, direction);
      }
    }

    expect(state.arrowMinigame?.loopsCompleted).toBe(5);
    expect(isArrowMinigameComplete(state)).toBe(true);
    state = clearArrowMinigame(state);
    expect(state.arrowMinigame).toBeNull();
    expect(state.storyFlags.completedDeskMinigame).toBe(true);
  });

  it("shortens the timer after each completed arrow loop", () => {
    let state = startDeskMinigame(createInitialState());
    const firstLoopTime = state.arrowMinigame?.totalTimeMs ?? 0;

    for (const direction of state.arrowMinigame?.sequence ?? []) {
      state = pressArrowInput(state, direction);
    }

    expect(state.arrowMinigame?.loopsCompleted).toBe(1);
    expect(state.arrowMinigame?.totalTimeMs).toBeLessThan(firstLoopTime);
    expect(state.arrowMinigame?.timeRemainingMs).toBe(state.arrowMinigame?.totalTimeMs);
  });

  it("restarts the arrow minigame when time runs out", () => {
    const state = startDeskMinigame(createInitialState());
    const expiredState = updateArrowMinigame(state, 9000);

    expect(expiredState.arrowMinigame?.attempts).toBe(2);
    expect(expiredState.arrowMinigame?.currentIndex).toBe(0);
    expect(expiredState.arrowMinigame?.loopsCompleted).toBe(0);
    expect(expiredState.storyFlags.workingAtDesk).toBe(true);
  });

  it("advances to ending after all replay memories are seen", () => {
    const replayItems = ["replay-friend", "replay-parent", "final-question"].map((id) => {
      const interactable = rooms.replay.interactables.find((item) => item.id === id);
      if (!interactable) throw new Error(`missing ${id}`);
      return interactable;
    });

    let state: GameState = {
      ...createInitialState(),
      phase: "regret",
      currentRoom: "replay",
      storyFlags: {
        sawReplayFriend: true,
        sawReplayParent: true,
      },
    };

    for (const item of replayItems) {
      state = completeInteraction(state, item);
    }

    expect(state.phase).toBe("ending");
    expect(state.storyFlags.endingUnlocked).toBe(true);
  });
});
