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

  constructor(rootId = "ui-root") {
    const root = document.getElementById(rootId);
    if (!root) {
      throw new Error(`Missing #${rootId}`);
    }

    this.root = root;
  }

  showTitle(onStart: () => void): void {
    this.root.innerHTML = `
      <section class="title-screen">
        <div class="title-copy">
          <p class="eyebrow">Walking Sim / Visual Novel</p>
          <h1>Chained by People's Shadow</h1>
          <p class="tagline">Toxic productivity, takut tertinggal, dan hidup yang baru terasa berarti saat sudah menjadi rekaman.</p>
          <button class="primary-action" type="button">Mulai</button>
        </div>
      </section>
    `;

    this.root.querySelector("button")?.addEventListener("click", onStart, { once: true });
  }

  mountHud(): void {
    this.root.innerHTML = `
      <section class="hud" aria-live="polite">
        <div class="hud-chip" data-hud-room></div>
        <div class="hud-chip regret" data-hud-regret></div>
      </section>
      <section class="interaction-prompt hidden" data-prompt></section>
      <section class="arrow-minigame-layer hidden" data-arrow-minigame></section>
      <section class="dialogue-layer hidden" data-dialogue></section>
      <section class="ending-layer hidden" data-ending></section>
    `;
  }

  updateHud(state: GameState, roomTitle: string): void {
    const phaseLabel: Record<GameState["phase"], string> = {
      buildUp: "Fase I - Dorongan",
      actions: "Fase II - Penolakan",
      regret: "Fase III - Replay",
      ending: "Akhir",
    };

    this.setText("[data-hud-room]", `${phaseLabel[state.phase]} / ${roomTitle}`);
    this.setText("[data-hud-regret]", `Regret ${state.regretScore}`);
  }

  setPrompt(label: string | null): void {
    const prompt = this.root.querySelector<HTMLElement>("[data-prompt]");
    if (!prompt) {
      return;
    }

    prompt.textContent = label ? `E / Klik - ${label}` : "";
    prompt.classList.toggle("hidden", !label);
  }

  showDialogue(dialogueId: string, callbacks: DialogueCallbacks): void {
    this.dialogueId = dialogueId;
    this.callbacks = callbacks;
    this.renderDialogue();
  }

  showEnding(regretScore: number, onRestart: () => void): void {
    const ending = this.root.querySelector<HTMLElement>("[data-ending]");
    if (!ending) {
      return;
    }

    ending.classList.remove("hidden");
    ending.innerHTML = `
      <article class="ending-card">
        <p class="eyebrow">Rekaman selesai</p>
        <h2>Hidup cuma sekali.</h2>
        <p>Apa yang sebenarnya kamu kejar?</p>
        <p class="ending-score">Regret score: ${regretScore}</p>
        <button class="primary-action" type="button">Main Lagi</button>
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
    const timer = layer.querySelector<HTMLElement>("[data-arrow-time]");
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
      progress.style.width = `${Math.round(progressRatio * 100)}%`;
    }

    if (timer) {
      timer.style.width = `${Math.round(timeRatio * 100)}%`;
    }

    if (attempts) {
      attempts.textContent =
        minigame.attempts > 1 ? `Ulang ${minigame.attempts}` : "Tetap fokus";
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

  destroy(): void {
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

    layer.classList.remove("hidden");
    layer.innerHTML = this.dialogueMarkup(node);

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

    layer.querySelector("button")?.addEventListener("click", () => {
      this.dialogueId = node.next ?? null;
      this.dialogueId ? this.renderDialogue() : this.finishDialogue();
    });
  }

  private dialogueMarkup(node: DialogueNode): string {
    return `
      <article class="dialogue-box">
        <div class="portrait ${node.portraitKey ?? "narrator"}"></div>
        <div class="dialogue-content">
          <div class="speaker">${node.speaker}</div>
          <p>${node.text}</p>
          <div class="dialogue-actions" data-choices>
            ${node.choices?.length ? "" : '<button class="continue-button" type="button">Lanjut</button>'}
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
        <div class="arrow-work-icon">⌨</div>
        <div class="arrow-sequence" data-arrow-sequence="${this.arrowSignature(minigame)}">${arrows}</div>
        <div class="arrow-meter" aria-hidden="true">
          <div class="arrow-meter-fill" data-arrow-progress style="width: ${Math.round(progressRatio * 100)}%"></div>
        </div>
        <div class="arrow-timer" aria-hidden="true">
          <div class="arrow-timer-fill" data-arrow-time style="width: ${Math.round(timeRatio * 100)}%"></div>
        </div>
        <div class="arrow-caption">
          <span>Tekan panah sesuai urutan</span>
          <span data-arrow-loop>Loop ${Math.min(minigame.loopsCompleted + 1, minigame.loopsRequired)}/${minigame.loopsRequired}</span>
          <span data-arrow-attempts>${minigame.attempts > 1 ? `Ulang ${minigame.attempts}` : "Tetap fokus"}</span>
        </div>
      </article>
    `;
  }

  private arrowSignature(minigame: ArrowMinigameState): string {
    return `${minigame.loopsCompleted}:${minigame.sequence.join("-")}`;
  }

  private finishDialogue(): void {
    const layer = this.root.querySelector<HTMLElement>("[data-dialogue]");
    layer?.classList.add("hidden");
    if (layer) {
      layer.innerHTML = "";
    }

    this.callbacks?.onComplete();
    this.dialogueId = null;
    this.callbacks = null;
  }

  private setText(selector: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (element) {
      element.textContent = text;
    }
  }
}
