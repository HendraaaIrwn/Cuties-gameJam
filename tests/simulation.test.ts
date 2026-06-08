import { describe, expect, it } from "vitest";
import { rooms } from "../src/game/content/rooms";
import {
  applyChoice,
  clearTypingMinigame,
  completeInteraction,
  earnMoney,
  getVisibleInteractables,
  isTypingMinigameComplete,
  shouldStartDeskMinigame,
  startDeskMinigame,
  typeCharacter,
  updateTypingMinigame,
} from "../src/game/simulation/rules";
import { createInitialState } from "../src/game/simulation/state";
import type { GameState } from "../src/game/simulation/types";

describe("story simulation", () => {
  it("applies choice flags without scoring", () => {
    const state = createInitialState();
    const nextState = applyChoice(state, {
      label: "Reject",
      setFlags: ["rejectedFriend", "handledFriend"],
    });

    expect(nextState.storyFlags.rejectedFriend).toBe(true);
    expect(nextState.storyFlags.handledFriend).toBe(true);
  });

  it("keeps bedroom interactions repeatable without advancing phase", () => {
    const phaseOneIds = ["bed", "laptop", "door", "wardrobe"];
    const interactables = phaseOneIds.map((id) => {
      const interactable = rooms.bedroom.interactables.find((item) => item.id === id);
      if (!interactable) throw new Error(`missing ${id}`);
      return interactable;
    });

    let state = createInitialState();
    for (const interactable of interactables) {
      state = completeInteraction(state, interactable);
      state = completeInteraction(state, interactable);
    }

    expect(state.phase).toBe("buildUp");
    expect(state.currentRoom).toBe("bedroom");
    expect(state.completedInteractions).toEqual([]);
    expect(state.storyFlags.checkedBed).toBe(true);
    expect(state.storyFlags.checkedLaptop).toBe(true);
    expect(state.storyFlags.checkedDoor).toBe(true);
    expect(state.storyFlags.checkedWardrobe).toBe(true);
    expect(state.storyFlags.phaseActionsStarted).toBeUndefined();
  });

  it("uses only the requested bedroom interaction fixtures", () => {
    const bedroomIds = rooms.bedroom.interactables.map((item) => item.id);

    expect(bedroomIds).toEqual(["door", "wardrobe", "laptop", "bed"]);
    expect(rooms.bedroom.interactables.every((item) => item.repeatable)).toBe(true);
    expect(bedroomIds).not.toContain("clock");
    expect(bedroomIds).not.toContain("chair");
    expect(bedroomIds).not.toContain("desk");
    expect(bedroomIds).not.toContain("calendar");
    expect(bedroomIds).not.toContain("mirror");
  });

  it("keeps the bedroom door reachable from the wardrobe collider edge", () => {
    const door = rooms.bedroom.interactables.find((item) => item.id === "door");

    if (!door) {
      throw new Error("missing door fixture");
    }

    const wardrobeRightEdge = { x: 160, y: rooms.bedroom.playerStart.y };
    const distance = Math.hypot(door.x - wardrobeRightEdge.x, door.y - wardrobeRightEdge.y);

    expect(distance).toBeLessThanOrEqual(door.radius + 26);
  });

  it("keeps the bedroom door and mirror wardrobe focus areas separate", () => {
    const door = rooms.bedroom.interactables.find((item) => item.id === "door");
    const wardrobe = rooms.bedroom.interactables.find((item) => item.id === "wardrobe");

    if (!door || !wardrobe) {
      throw new Error("missing bedroom door or wardrobe fixture");
    }

    const focusPadding = 26;
    const distance = Math.hypot(door.x - wardrobe.x, door.y - wardrobe.y);

    expect(distance).toBeGreaterThan(door.radius + wardrobe.radius + focusPadding * 2);
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

  it("marks both bedroom laptop and work desk interactions as desk minigame triggers", () => {
    const laptop = rooms.bedroom.interactables.find((item) => item.id === "laptop");
    const workDesk = rooms.street.interactables.find((item) => item.id === "work-desk");
    const bed = rooms.bedroom.interactables.find((item) => item.id === "bed");

    if (!laptop || !workDesk || !bed) {
      throw new Error("missing minigame trigger fixture");
    }

    expect(shouldStartDeskMinigame(laptop)).toBe(true);
    expect(shouldStartDeskMinigame(workDesk)).toBe(true);
    expect(workDesk.afterMinigameDialogueId).toBe("collapse");
    expect(shouldStartDeskMinigame(bed)).toBe(false);
  });

  it("keeps the desk interaction incomplete while the typing minigame is running", () => {
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
    expect(state.typingMinigame?.words).toHaveLength(5);
    expect(state.typingMinigame?.loopsRequired).toBe(1);
    expect(state.typingMinigame?.loopsCompleted).toBe(0);
    expect(state.money).toBe(0);
  });

  it("adds $25 after completed laptop work is paid", () => {
    let state = startDeskMinigame(createInitialState());

    while (!isTypingMinigameComplete(state)) {
      const words = state.typingMinigame?.words ?? [];
      for (const word of words) {
        for (const char of word) {
          state = typeCharacter(state, char);
        }
      }
    }

    state = clearTypingMinigame(state);
    state = earnMoney(state);

    expect(state.typingMinigame).toBeNull();
    expect(state.money).toBe(25);
  });

  it("completes the typing minigame after one loop is typed", () => {
    let state = startDeskMinigame({
      ...createInitialState(),
      phase: "actions",
      currentRoom: "street",
    });

    const firstWords = state.typingMinigame?.words ?? [];
    for (const word of firstWords) {
      for (const char of word) {
        state = typeCharacter(state, char);
      }
    }

    expect(state.typingMinigame?.loopsCompleted).toBe(1);
    expect(isTypingMinigameComplete(state)).toBe(true);
    state = clearTypingMinigame(state);
    expect(state.typingMinigame).toBeNull();
    expect(state.storyFlags.completedDeskMinigame).toBe(true);
  });

  it("completes the typing minigame in a single loop", () => {
    let state = startDeskMinigame(createInitialState());

    for (const word of state.typingMinigame?.words ?? []) {
      for (const char of word) {
        state = typeCharacter(state, char);
      }
    }

    expect(state.typingMinigame?.loopsCompleted).toBe(1);
    expect(isTypingMinigameComplete(state)).toBe(true);
  });

  it("restarts the typing minigame when time runs out", () => {
    const state = startDeskMinigame(createInitialState());
    const expiredState = updateTypingMinigame(state, 12000);

    expect(expiredState.typingMinigame?.attempts).toBe(2);
    expect(expiredState.typingMinigame?.currentWordIndex).toBe(0);
    expect(expiredState.typingMinigame?.loopsCompleted).toBe(0);
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
      phase: "replay",
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
