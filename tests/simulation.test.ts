import { describe, expect, it } from "vitest";
import { rooms } from "../src/game/content/rooms";
import { applyChoice, completeInteraction, getVisibleInteractables } from "../src/game/simulation/rules";
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
