import { dialogues } from "../game/content/dialogues";
import type {
  ArrowDirection,
  ArrowMinigameState,
  Choice,
  DialogueNode,
  GameState,
} from "../game/simulation/types";

type DialogueCallbacks = {
  onChoice: (choice: Choice) => void;
  onComplete: () => void;
};

export class NarrativeOverlay {
  private readonly root: HTMLElement;
  private dialogueId: string | null = null;
  private callbacks: DialogueCallbacks | null = null;
  private typewriterTimer: number | null = null;
  private readonly handleEnterKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.repeat) {
      return;
    }

    const focusedButton =
      document.activeElement instanceof HTMLButtonElement &&
      this.root.contains(document.activeElement) &&
      this.isUsableButton(document.activeElement)
        ? document.activeElement
        : null;
    const targetButton = focusedButton ?? this.findVisibleButton();
    if (!targetButton) {
      return;
    }

    event.preventDefault();
    targetButton.focus({ preventScroll: true });
    targetButton.click();
  };

  constructor(rootId = "ui-root") {
    const root = document.getElementById(rootId);
    if (!root) {
      throw new Error(`Missing #${rootId}`);
    }

    this.root = root;
    window.addEventListener("keydown", this.handleEnterKeyDown);
  }

  showTitle(onStart: () => void): void {
    this.root.innerHTML = `
      <section class="title-screen">
        <div class="title-copy">
          <p class="eyebrow">Walking Sim / Visual Novel</p>
          <h1>Chained by Other People's Shadows</h1>
          <p class="tagline">Toxic productivity, fear of falling behind, and a life that only feels meaningful once it becomes a recording.</p>
          <button class="primary-action" type="button">Start</button>
        </div>
      </section>
    `;

    this.root.querySelector("button")?.addEventListener("click", onStart, { once: true });
  }

  mountHud(): void {
    this.root.innerHTML = `
      <section class="hud" aria-live="polite">
        <div class="hud-chip" data-hud-room></div>
        <div class="hud-chip" data-hud-money></div>
      </section>
      <section class="interaction-prompt hidden" data-prompt></section>
      <section class="tutorial-guidance-layer hidden" data-tutorial-guidance></section>
      <section class="arrow-minigame-layer hidden" data-arrow-minigame></section>
      <section class="dialogue-layer hidden" data-dialogue></section>
      <section class="ending-layer hidden" data-ending></section>
    `;
  }

  updateHud(state: GameState, roomTitle: string): void {
    const phaseLabel: Record<GameState["phase"], string> = {
      buildUp: "Phase I - Pressure",
      actions: "Phase II - Refusal",
      replay: "Phase III - Replay",
      ending: "Ending",
    };

    this.setText("[data-hud-room]", `${phaseLabel[state.phase]} / ${roomTitle}`);
    this.updateMoneyHud(state.money);
  }

  setPrompt(label: string | null): void {
    const prompt = this.root.querySelector<HTMLElement>("[data-prompt]");
    if (!prompt) {
      return;
    }

    prompt.textContent = label ? `E / Click - ${label}` : "";
    prompt.classList.toggle("hidden", !label);
  }

  showDialogue(dialogueId: string, callbacks: DialogueCallbacks): void {
    this.dialogueId = dialogueId;
    this.callbacks = callbacks;
    this.renderDialogue();
  }

  showEnding(onRestart: () => void): void {
    const ending = this.root.querySelector<HTMLElement>("[data-ending]");
    if (!ending) {
      return;
    }

    ending.classList.remove("hidden");
    ending.innerHTML = `
      <article class="ending-card">
        <p class="eyebrow">Recording complete</p>
        <h2>You only live once.</h2>
        <p>What are you really chasing?</p>
        <button class="primary-action" type="button">Play Again</button>
      </article>
    `;

    ending.querySelector("button")?.addEventListener("click", onRestart, { once: true });
  }

  clearEnding(): void {
    const ending = this.root.querySelector<HTMLElement>("[data-ending]");
    if (!ending) {
      return;
    }

    ending.classList.add("hidden");
    ending.innerHTML = "";
  }

  showArrowMinigame(minigame: ArrowMinigameState): void {
    const layer = this.root.querySelector<HTMLElement>("[data-arrow-minigame]");
    if (!layer) {
      return;
    }

    layer.classList.remove("hidden");
    layer.innerHTML = this.arrowMinigameMarkup(minigame);
  }

  updateArrowMinigame(minigame: ArrowMinigameState): void {
    const layer = this.root.querySelector<HTMLElement>("[data-arrow-minigame]");
    if (!layer || layer.classList.contains("hidden")) {
      this.showArrowMinigame(minigame);
      return;
    }

    const progress = layer.querySelector<HTMLElement>("[data-arrow-progress]");
    const progressText = layer.querySelector<HTMLElement>("[data-arrow-progress-text]");
    const attempts = layer.querySelector<HTMLElement>("[data-arrow-attempts]");
    const loop = layer.querySelector<HTMLElement>("[data-arrow-loop]");
    const currentMarkup = layer.querySelector<HTMLElement>("[data-arrow-sequence]");
    const nextSignature = this.arrowSignature(minigame);

    if (currentMarkup?.dataset.arrowSequence !== nextSignature) {
      this.showArrowMinigame(minigame);
      return;
    }

    const progressRatio = minigame.currentIndex / minigame.sequence.length;
    const timeRatio = minigame.timeRemainingMs / minigame.totalTimeMs;

    if (progress) {
      progress.style.width = `${Math.round(timeRatio * 100)}%`;
    }

    if (progressText) {
      progressText.textContent = `${Math.round(progressRatio * 100)}%`;
    }

    if (attempts) {
      attempts.textContent =
        minigame.attempts > 1 ? `Retry ${minigame.attempts}` : "Stay focused";
    }

    if (loop) {
      loop.textContent = `Loop ${Math.min(minigame.loopsCompleted + 1, minigame.loopsRequired)}/${minigame.loopsRequired}`;
    }

    for (const item of layer.querySelectorAll<HTMLElement>("[data-arrow-index]")) {
      const index = Number(item.dataset.arrowIndex ?? 0);
      item.classList.toggle("done", index < minigame.currentIndex);
      item.classList.toggle("current", index === minigame.currentIndex);
    }
  }

  hideArrowMinigame(): void {
    const layer = this.root.querySelector<HTMLElement>("[data-arrow-minigame]");
    if (!layer) {
      return;
    }

    layer.classList.add("hidden");
    layer.innerHTML = "";
  }

  showTutorialGuidance(message: string, onComplete: () => void): void {
    const layer = this.root.querySelector<HTMLElement>("[data-tutorial-guidance]");
    if (!layer) {
      return;
    }

    layer.classList.remove("hidden");
    layer.innerHTML = `
      <article class="tutorial-guidance">
        <div class="tutorial-arrows" aria-hidden="true">
          <span>↑</span>
          <span>↓</span>
          <span>←</span>
          <span>→</span>
        </div>
        <p>${message}</p>
        <button class="tutorial-start-button" type="button">Start</button>
      </article>
    `;

    this.bindTutorialGuidanceButton(layer, onComplete);
  }

  showPlainTutorialGuidance(message: string, onComplete: () => void, buttonLabel = "Start"): void {
    const layer = this.root.querySelector<HTMLElement>("[data-tutorial-guidance]");
    if (!layer) {
      return;
    }

    layer.classList.remove("hidden");
    layer.innerHTML = `
      <article class="tutorial-guidance tutorial-guidance-plain">
        <p>${message}</p>
        <button class="tutorial-start-button" type="button">${buttonLabel}</button>
      </article>
    `;

    this.bindTutorialGuidanceButton(layer, onComplete);
  }

  hideTutorialGuidance(): void {
    const layer = this.root.querySelector<HTMLElement>("[data-tutorial-guidance]");
    if (!layer) {
      return;
    }

    layer.classList.add("hidden");
    layer.innerHTML = "";
  }

  private bindTutorialGuidanceButton(layer: HTMLElement, onComplete: () => void): void {
    layer.querySelector("button")?.addEventListener(
      "click",
      () => {
        this.hideTutorialGuidance();
        onComplete();
      },
      { once: true },
    );
  }

  destroy(): void {
    this.clearTypewriter();
    window.removeEventListener("keydown", this.handleEnterKeyDown);
    this.root.innerHTML = "";
  }

  private renderDialogue(): void {
    if (!this.dialogueId || !this.callbacks) {
      return;
    }

    const node = dialogues[this.dialogueId];
    if (!node) {
      throw new Error(`Missing dialogue node: ${this.dialogueId}`);
    }

    const layer = this.root.querySelector<HTMLElement>("[data-dialogue]");
    if (!layer) {
      return;
    }

    this.clearTypewriter();
    layer.classList.remove("hidden");
    layer.innerHTML = this.dialogueMarkup(node);
    this.startTypewriter(node.text);

    if (node.choices?.length) {
      const choiceHost = layer.querySelector("[data-choices]");
      for (const choice of node.choices) {
        const button = document.createElement("button");
        button.className = "choice-button";
        button.type = "button";
        button.textContent = choice.label;
        button.addEventListener("click", () => {
          this.callbacks?.onChoice(choice);
          this.dialogueId = choice.next ?? null;
          this.dialogueId ? this.renderDialogue() : this.finishDialogue();
        });
        choiceHost?.appendChild(button);
      }
      return;
    }

    layer.querySelector("button")?.addEventListener("click", () => this.advanceDialogue(node));
  }

  private advanceDialogue(node: DialogueNode): void {
    this.dialogueId = node.next ?? null;
    this.dialogueId ? this.renderDialogue() : this.finishDialogue();
  }

  private dialogueMarkup(node: DialogueNode): string {
    return `
      <article class="dialogue-box">
        <div class="portrait ${node.portraitKey ?? "narrator"}"></div>
        <div class="dialogue-content">
          <div class="speaker">${node.speaker}</div>
          <p data-dialogue-text></p>
          <div class="dialogue-actions" data-choices>
            ${node.choices?.length ? "" : '<button class="continue-button" type="button">Continue</button>'}
          </div>
        </div>
      </article>
    `;
  }

  private arrowMinigameMarkup(minigame: ArrowMinigameState): string {
    const icon: Record<ArrowDirection, string> = {
      up: "↑",
      down: "↓",
      left: "←",
      right: "→",
    };

    const arrows = minigame.sequence
      .map(
        (direction, index) => `
          <span
            class="arrow-token ${index === minigame.currentIndex ? "current" : ""}"
            data-arrow-index="${index}"
          >
            ${icon[direction]}
          </span>
        `,
      )
      .join("");

    const progressRatio = minigame.currentIndex / minigame.sequence.length;
    const timeRatio = minigame.timeRemainingMs / minigame.totalTimeMs;

    return `
      <article class="arrow-minigame" aria-label="Arrow work minigame">
        <div class="arrow-work-icon" aria-hidden="true">☝</div>
        <div class="arrow-sequence" data-arrow-sequence="${this.arrowSignature(minigame)}">${arrows}</div>
        <div class="arrow-meter" aria-hidden="true">
          <div class="arrow-meter-fill" data-arrow-progress style="width: ${Math.round(timeRatio * 100)}%"></div>
        </div>
        <div class="arrow-caption">
          <span class="arrow-progress-text" data-arrow-progress-text>${Math.round(progressRatio * 100)}%</span>
          <span data-arrow-loop>Loop ${Math.min(minigame.loopsCompleted + 1, minigame.loopsRequired)}/${minigame.loopsRequired}</span>
          <span data-arrow-attempts>${minigame.attempts > 1 ? `Retry ${minigame.attempts}` : "Stay focused"}</span>
        </div>
      </article>
    `;
  }

  private arrowSignature(minigame: ArrowMinigameState): string {
    return `${minigame.loopsCompleted}:${minigame.sequence.join("-")}`;
  }

  private finishDialogue(): void {
    this.clearTypewriter();
    const layer = this.root.querySelector<HTMLElement>("[data-dialogue]");
    layer?.classList.add("hidden");
    if (layer) {
      layer.innerHTML = "";
    }

    this.callbacks?.onComplete();
    this.dialogueId = null;
    this.callbacks = null;
  }

  private findVisibleButton(): HTMLButtonElement | null {
    return [...this.root.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      this.isUsableButton(button),
    ) ?? null;
  }

  private isUsableButton(button: HTMLButtonElement): boolean {
    if (button.disabled || button.closest(".hidden")) {
      return false;
    }

    return button.getClientRects().length > 0;
  }

  private setText(selector: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (element) {
      element.textContent = text;
    }
  }

  private updateMoneyHud(money: number): void {
    const element = this.root.querySelector<HTMLElement>("[data-hud-money]");
    if (!element) {
      return;
    }

    element.classList.add("hud-money");
    element.innerHTML = `
      <span class="coin-icon" aria-hidden="true"></span>
      <span class="money-label">$${money}</span>
    `;
  }

  private startTypewriter(text: string): void {
    const textElement = this.root.querySelector<HTMLElement>("[data-dialogue-text]");
    if (!textElement) {
      return;
    }

    textElement.textContent = "";
    textElement.classList.add("typewriter-active");

    let index = 0;
    this.typewriterTimer = window.setInterval(() => {
      index += 1;
      textElement.textContent = text.slice(0, index);

      if (index >= text.length) {
        this.clearTypewriter();
        textElement.classList.remove("typewriter-active");
      }
    }, 22);
  }

  private clearTypewriter(): void {
    if (this.typewriterTimer !== null) {
      window.clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }
}
