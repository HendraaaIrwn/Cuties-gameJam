import { dialogues } from "../game/content/dialogues";
import { careerStageLabel, type CareerStage } from "../game/content/typingWords";
import type {
  ArrowDirection,
  ArrowMinigameState,
  Choice,
  DialogueNode,
  GameState,
  TypingMinigameState,
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
  private typewriterText: string | null = null;
  private typewriterElement: HTMLElement | null = null;
  private faintOverlayTimer: number | null = null;
  private faintBlackoutTimer: number | null = null;
  private enterKeyHeld = false;
  private readonly handleEnterKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") {
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
    event.stopPropagation();
    if (this.enterKeyHeld || event.repeat) {
      return;
    }

    this.enterKeyHeld = true;
    if (this.completeTypewriter()) {
      return;
    }

    if (this.handleDialogueButton(targetButton)) {
      return;
    }

    targetButton.focus({ preventScroll: true });
    targetButton.click();
  };
  private readonly handleEnterKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      this.enterKeyHeld = false;
    }
  };

  constructor(rootId = "ui-root") {
    const root = document.getElementById(rootId);
    if (!root) {
      throw new Error(`Missing #${rootId}`);
    }

    this.root = root;
    window.addEventListener("keydown", this.handleEnterKeyDown);
    window.addEventListener("keyup", this.handleEnterKeyUp);
  }

  showTitle(onStart: () => void): void {
    this.root.innerHTML = `
      <section class="title-screen">
        <div class="title-copy">
          <p class="eyebrow">Walking Sim / Visual Novel</p>
          <h1>Almost There</h1>
          <p class="tagline">A quiet room, one laptop, and the fear that everyone else is already ahead.</p>
          <div class="menu-actions">
            <button class="primary-action" type="button" data-menu-start>Start</button>
          </div>
          <div class="menu-status" aria-label="Story preview">
          </div>
        </div>
      </section>
    `;

    this.root.querySelector("[data-menu-start]")?.addEventListener("click", onStart, { once: true });
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
      <section class="typing-minigame-layer hidden" data-typing-minigame></section>
      <section class="dialogue-layer hidden" data-dialogue></section>
      <section class="ending-layer hidden" data-ending></section>
      <section class="faint-blackout-overlay hidden" data-faint-blackout-overlay></section>
      <section class="faint-red-overlay hidden" data-faint-red-overlay></section>
    `;
  }

  mountDialogueOnly(): void {
    this.root.innerHTML = `
      <section class="interaction-prompt final-memory-prompt hidden" data-prompt></section>
      <section class="dialogue-layer final-memory-dialogue-layer hidden" data-dialogue></section>
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
        <button class="primary-action play-again-action" type="button">Play Again</button>
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

  showTypingMinigame(minigame: TypingMinigameState): void {
    const layer = this.root.querySelector<HTMLElement>("[data-typing-minigame]");
    if (!layer) {
      return;
    }

    layer.classList.remove("hidden");
    layer.innerHTML = this.typingMinigameMarkup(minigame);
  }

  updateTypingMinigame(minigame: TypingMinigameState): void {
    const layer = this.root.querySelector<HTMLElement>("[data-typing-minigame]");
    if (!layer || layer.classList.contains("hidden")) {
      this.showTypingMinigame(minigame);
      return;
    }

    const progress = layer.querySelector<HTMLElement>("[data-typing-progress]");
    const attempts = layer.querySelector<HTMLElement>("[data-typing-attempts]");
    const loop = layer.querySelector<HTMLElement>("[data-typing-loop]");
    const stageEl = layer.querySelector<HTMLElement>("[data-typing-stage]");
    const wordsEl = layer.querySelector<HTMLElement>("[data-typing-words]");
    const typedEl = layer.querySelector<HTMLElement>("[data-typing-typed]");

    const timeRatio = minigame.timeRemainingMs / minigame.totalTimeMs;

    if (progress) {
      progress.style.width = `${Math.round(timeRatio * 100)}%`;
    }

    if (attempts) {
      attempts.textContent =
        minigame.attempts > 1 ? `Retry ${minigame.attempts}` : "Stay focused";
    }

    if (loop) {
      loop.textContent = `Loop ${Math.min(minigame.loopsCompleted + 1, minigame.loopsRequired)}/${minigame.loopsRequired}`;
    }

    if (stageEl) {
      stageEl.textContent = careerStageLabel[minigame.stageLabel as CareerStage] ?? minigame.stageLabel;
    }

    if (wordsEl) {
      wordsEl.innerHTML = minigame.words
        .map(
          (word, index) =>
            `<span class="typing-word ${index < minigame.currentWordIndex ? "done" : index === minigame.currentWordIndex ? "current" : ""}" data-typing-word-index="${index}">${word}</span>`,
        )
        .join("");
    }

    if (typedEl && minigame.currentWordIndex < minigame.words.length) {
      const currentWord = minigame.words[minigame.currentWordIndex];
      const typed = minigame.typedSoFar;
      const remaining = currentWord.slice(typed.length);
      typedEl.innerHTML = `<span class="typing-correct">${typed}</span><span class="typing-remaining">${remaining}</span>`;
    }
  }

  hideTypingMinigame(): void {
    const layer = this.root.querySelector<HTMLElement>("[data-typing-minigame]");
    if (!layer) {
      return;
    }

    layer.classList.add("hidden");
    layer.innerHTML = "";
  }

  showFaintRedOverlay(holdMs: number, fadeMs: number, alpha: number): void {
    const layer = this.root.querySelector<HTMLElement>("[data-faint-red-overlay]");
    if (!layer) {
      return;
    }

    this.clearFaintOverlayTimer();
    layer.style.setProperty("--faint-red-alpha", String(alpha));
    layer.style.transitionDuration = `${fadeMs}ms`;
    layer.classList.remove("hidden");
    layer.classList.remove("is-visible");

    window.requestAnimationFrame(() => {
      layer.classList.add("is-visible");
    });

    this.faintOverlayTimer = window.setTimeout(() => {
      layer.classList.remove("is-visible");
      this.faintOverlayTimer = window.setTimeout(() => {
        layer.classList.add("hidden");
        this.faintOverlayTimer = null;
      }, fadeMs);
    }, holdMs);
  }

  showFaintBlackout(fadeMs: number, alpha: number): void {
    const layer = this.root.querySelector<HTMLElement>("[data-faint-blackout-overlay]");
    if (!layer) {
      return;
    }

    this.clearFaintBlackoutTimer();
    layer.style.setProperty("--faint-blackout-alpha", String(alpha));
    layer.style.transitionDuration = `${fadeMs}ms`;
    layer.classList.remove("hidden");
    layer.classList.remove("is-visible");

    window.requestAnimationFrame(() => {
      layer.classList.add("is-visible");
    });
  }

  hideFaintBlackout(fadeMs: number): void {
    const layer = this.root.querySelector<HTMLElement>("[data-faint-blackout-overlay]");
    if (!layer) {
      return;
    }

    this.clearFaintBlackoutTimer();
    layer.style.transitionDuration = `${fadeMs}ms`;
    layer.classList.remove("is-visible");
    this.faintBlackoutTimer = window.setTimeout(() => {
      layer.classList.add("hidden");
      this.faintBlackoutTimer = null;
    }, fadeMs);
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
    this.clearFaintOverlayTimer();
    this.clearFaintBlackoutTimer();
    window.removeEventListener("keydown", this.handleEnterKeyDown);
    window.removeEventListener("keyup", this.handleEnterKeyUp);
    this.root.innerHTML = "";
  }

  private clearFaintOverlayTimer(): void {
    if (this.faintOverlayTimer !== null) {
      window.clearTimeout(this.faintOverlayTimer);
      this.faintOverlayTimer = null;
    }
  }

  private clearFaintBlackoutTimer(): void {
    if (this.faintBlackoutTimer !== null) {
      window.clearTimeout(this.faintBlackoutTimer);
      this.faintBlackoutTimer = null;
    }
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
    this.startTypewriter(layer, node.text);

    if (node.choices?.length) {
      const choiceHost = layer.querySelector("[data-choices]");
      for (const choice of node.choices) {
        const button = document.createElement("button");
        button.className = "choice-button";
        button.type = "button";
        button.textContent = choice.label;
        button.addEventListener("click", () => this.chooseDialogueOption(choice));
        choiceHost?.appendChild(button);
      }
      return;
    }

    layer.querySelector("button")?.addEventListener("click", () => this.advanceDialogue(node));
  }

  private advanceDialogue(node: DialogueNode): void {
    if (this.completeTypewriter()) {
      return;
    }

    this.dialogueId = node.next ?? null;
    this.dialogueId ? this.renderDialogue() : this.finishDialogue();
  }

  private chooseDialogueOption(choice: Choice): void {
    if (this.completeTypewriter()) {
      return;
    }

    this.callbacks?.onChoice(choice);
    this.dialogueId = choice.next ?? null;
    this.dialogueId ? this.renderDialogue() : this.finishDialogue();
  }

  private handleDialogueButton(button: HTMLButtonElement): boolean {
    if (!button.closest("[data-dialogue]")) {
      return false;
    }

    button.focus({ preventScroll: true });
    const node = this.getCurrentDialogueNode();
    if (!node) {
      return true;
    }

    if (button.classList.contains("continue-button")) {
      this.advanceDialogue(node);
      return true;
    }

    const choiceButtons = [...(button.parentElement?.children ?? [])];
    const choiceIndex = choiceButtons.indexOf(button);
    const choice = choiceIndex >= 0 ? node.choices?.[choiceIndex] : undefined;
    if (choice) {
      this.chooseDialogueOption(choice);
    }

    return true;
  }

  private getCurrentDialogueNode(): DialogueNode | null {
    if (!this.dialogueId) {
      return null;
    }

    return dialogues[this.dialogueId] ?? null;
  }

  private dialogueMarkup(node: DialogueNode): string {
    return `
      <article class="dialogue-box">
        <div class="portrait ${node.portraitKey ?? "narrator"}"></div>
        <div class="dialogue-content">
          <div class="speaker">${node.speaker}</div>
          <p class="${node.textClass ?? ""}" data-dialogue-text></p>
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

  private typingMinigameMarkup(minigame: TypingMinigameState): string {
    const timeRatio = minigame.timeRemainingMs / minigame.totalTimeMs;
    const stageLabel = careerStageLabel[minigame.stageLabel as CareerStage] ?? minigame.stageLabel;
    const currentWord = minigame.words[minigame.currentWordIndex] ?? "";
    const typed = minigame.typedSoFar;
    const remaining = currentWord.slice(typed.length);

    const wordsHtml = minigame.words
      .map(
        (word, index) =>
          `<span class="typing-word ${index < minigame.currentWordIndex ? "done" : index === minigame.currentWordIndex ? "current" : ""}" data-typing-word-index="${index}">${word}</span>`,
      )
      .join("");

    return `
      <article class="typing-minigame" aria-label="Typing work minigame">
        <div class="typing-stage-label" data-typing-stage>${stageLabel}</div>
        <div class="typing-word-list" data-typing-words>${wordsHtml}</div>
        <div class="typing-input-area">
          <span class="typing-input-display" data-typing-typed>
            <span class="typing-correct">${typed}</span><span class="typing-remaining">${remaining}</span>
          </span>
        </div>
        <div class="typing-meter" aria-hidden="true">
          <div class="typing-meter-fill" data-typing-progress style="width: ${Math.round(timeRatio * 100)}%"></div>
        </div>
        <div class="typing-caption">
          <span data-typing-loop>Loop ${Math.min(minigame.loopsCompleted + 1, minigame.loopsRequired)}/${minigame.loopsRequired}</span>
          <span data-typing-attempts>${minigame.attempts > 1 ? `Retry ${minigame.attempts}` : "Stay focused"}</span>
        </div>
      </article>
    `;
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

  private startTypewriter(layer: HTMLElement, text: string): void {
    const textElement = layer.querySelector<HTMLElement>("[data-dialogue-text]");
    if (!textElement) {
      return;
    }

    textElement.textContent = "";
    textElement.classList.add("typewriter-active");
    this.typewriterText = text;
    this.typewriterElement = textElement;

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

  private completeTypewriter(): boolean {
    if (this.typewriterTimer === null || this.typewriterText === null) {
      return false;
    }

    const text = this.typewriterText;
    const textElement = this.typewriterElement;
    this.clearTypewriter();
    if (textElement) {
      textElement.textContent = text;
      textElement.classList.remove("typewriter-active");
    }
    return true;
  }

  private clearTypewriter(): void {
    if (this.typewriterTimer !== null) {
      window.clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.typewriterText = null;
    this.typewriterElement = null;
  }
}
