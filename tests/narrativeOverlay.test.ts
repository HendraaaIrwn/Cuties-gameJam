import { afterEach, describe, expect, it, vi } from "vitest";
import { NarrativeOverlay } from "../src/ui/NarrativeOverlay";

class FakeClassList {
  private readonly names = new Set<string>();

  constructor(names: string[] = []) {
    names.forEach((name) => this.names.add(name));
  }

  add(name: string): void {
    this.names.add(name);
  }

  remove(name: string): void {
    this.names.delete(name);
  }

  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeButton {
  disabled = false;
  clicks = 0;
  focused = false;
  classList = new FakeClassList();
  parentElement: { children: FakeButton[] } | null = null;
  dialogueLayer: FakeDialogueLayer | null = null;
  private clickListener: (() => void) | null = null;

  constructor(classes: string[] = []) {
    this.classList = new FakeClassList(classes);
  }

  closest(selector?: string): FakeDialogueLayer | null {
    if (selector === "[data-dialogue]") {
      return this.dialogueLayer;
    }
    return null;
  }

  getClientRects(): unknown[] {
    return [{}];
  }

  focus(): void {
    this.focused = true;
  }

  addEventListener(_type: string, listener: () => void): void {
    this.clickListener = listener;
  }

  click(): void {
    this.clicks += 1;
    this.clickListener?.();
  }
}

class FakeRoot {
  innerHTML = "";

  constructor(private readonly button: FakeButton) {}

  contains(element: unknown): boolean {
    return element === this.button;
  }

  querySelectorAll(): FakeButton[] {
    return [this.button];
  }
}

class FakeTextElement {
  textContent = "";
  classList = new FakeClassList();
}

class FakeDialogueLayer {
  innerHTML = "";
  classList = new FakeClassList(["hidden"]);
  readonly textElement = new FakeTextElement();

  constructor(private readonly button: FakeButton) {}

  querySelector(selector: string): FakeButton | FakeTextElement | null {
    if (selector === "[data-dialogue-text]") {
      return this.textElement;
    }

    if (selector === "button") {
      return this.button;
    }

    return null;
  }
}

class FakeDialogueRoot {
  innerHTML = "";

  constructor(
    private readonly button: FakeButton,
    private readonly layer: FakeDialogueLayer,
  ) {}

  contains(element: unknown): boolean {
    return element === this.button;
  }

  querySelectorAll(): FakeButton[] {
    return [this.button];
  }

  querySelector(selector: string): FakeDialogueLayer | null {
    if (selector === "[data-dialogue]") {
      return this.layer;
    }

    return null;
  }
}

function createOverlayHarness() {
  let keydownListener: ((event: KeyboardEvent) => void) | null = null;
  let keyupListener: ((event: KeyboardEvent) => void) | null = null;
  const button = new FakeButton();
  const root = new FakeRoot(button);

  vi.stubGlobal("HTMLButtonElement", FakeButton);
  vi.stubGlobal("document", {
    activeElement: null,
    getElementById: vi.fn(() => root),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "keydown") {
        keydownListener = listener as (event: KeyboardEvent) => void;
      }
      if (type === "keyup") {
        keyupListener = listener as (event: KeyboardEvent) => void;
      }
    }),
    removeEventListener: vi.fn(),
  });

  const overlay = new NarrativeOverlay();
  if (!keydownListener) {
    throw new Error("missing keydown listener");
  }

  const pressEnter = (repeat: boolean) => {
    const event = {
      key: "Enter",
      repeat,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    keydownListener?.(event);
    return event as KeyboardEvent & {
      preventDefault: ReturnType<typeof vi.fn>;
      stopPropagation: ReturnType<typeof vi.fn>;
    };
  };

  const releaseEnter = () => {
    keyupListener?.({ key: "Enter" } as KeyboardEvent);
  };

  return { button, overlay, pressEnter, releaseEnter };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NarrativeOverlay keyboard controls", () => {
  it("clicks the visible dialogue button once for a fresh Enter press", () => {
    const { button, overlay, pressEnter } = createOverlayHarness();

    const event = pressEnter(false);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(button.focused).toBe(true);
    expect(button.clicks).toBe(1);

    overlay.destroy();
  });

  it("blocks repeated Enter presses without clicking through the next dialogue", () => {
    const { button, overlay, pressEnter } = createOverlayHarness();

    const event = pressEnter(true);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(button.focused).toBe(false);
    expect(button.clicks).toBe(0);

    overlay.destroy();
  });

  it("requires Enter to be released before the next dialogue action", () => {
    const { button, overlay, pressEnter, releaseEnter } = createOverlayHarness();

    pressEnter(false);
    pressEnter(false);
    expect(button.clicks).toBe(1);

    releaseEnter();
    pressEnter(false);
    expect(button.clicks).toBe(2);

    overlay.destroy();
  });

  it("starts a fresh typewriter when Enter advances to the next dialogue", () => {
    const listeners: { keydown?: (event: KeyboardEvent) => void } = {};
    const button = new FakeButton(["continue-button"]);
    const layer = new FakeDialogueLayer(button);
    button.dialogueLayer = layer;
    button.parentElement = { children: [button] };
    const root = new FakeDialogueRoot(button, layer);

    vi.stubGlobal("HTMLButtonElement", FakeButton);
    vi.stubGlobal("document", {
      activeElement: null,
      getElementById: vi.fn(() => root),
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === "keydown") {
          listeners.keydown = listener as (event: KeyboardEvent) => void;
        }
      }),
      clearInterval: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1),
    });

    const overlay = new NarrativeOverlay();
    overlay.showDialogue("final-memory-intro-world", {
      onChoice: vi.fn(),
      onComplete: vi.fn(),
    });
    (overlay as unknown as { clearTypewriter: () => void }).clearTypewriter();
    layer.textElement.textContent = "this doesn't look like my world";

    const keydownListener = listeners.keydown;
    if (!keydownListener) {
      throw new Error("missing keydown listener");
    }

    keydownListener({
      key: "Enter",
      repeat: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(button.clicks).toBe(0);
    expect(button.focused).toBe(true);
    expect(layer.textElement.textContent).toBe("");
    expect(layer.textElement.classList.contains("typewriter-active")).toBe(true);
    expect(window.setInterval).toHaveBeenCalledTimes(2);

    overlay.destroy();
  });
});
