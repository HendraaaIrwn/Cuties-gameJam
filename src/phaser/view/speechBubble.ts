import Phaser from "phaser";

export type BubbleTailDirection = "down" | "left" | "right" | "none";

export type BubbleTheme = {
  borderColor: number;
  fillColor: number;
  shadowColor: number;
  textColor: string;
  speakerColor: string;
};

export type SpeechBubbleOptions = {
  x: number;
  y: number;
  text: string;
  speaker?: string;
  maxWidth?: number;
  fixedWidth?: boolean;
  tailDirection?: BubbleTailDirection;
  tailOffsetX?: number;
  theme?: Partial<BubbleTheme>;
  depth?: number;
  typewriterSpeed?: number;
};

const DEFAULT_THEME: BubbleTheme = {
  borderColor: 0x2b2430,
  fillColor: 0xfff6cf,
  shadowColor: 0x15131c,
  textColor: "#1a1d28",
  speakerColor: "#b84f61",
};

const DEFAULT_MAX_WIDTH = 220;
const PADDING_X = 14;
const PADDING_Y = 10;
const BORDER_WIDTH = 3;
const SHADOW_OFFSET = 4;
const TAIL_WIDTH = 16;
const TAIL_HEIGHT = 12;
const SPEAKER_GAP = 4;
const CORNER_RADIUS = 2;

export function createSpeechBubble(
  scene: Phaser.Scene,
  options: SpeechBubbleOptions,
): Phaser.GameObjects.Container {
  const theme = { ...DEFAULT_THEME, ...options.theme };
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const tailDir = options.tailDirection ?? "down";
  const tailOffsetX = options.tailOffsetX ?? 0;
  const typewriterSpeed = options.typewriterSpeed ?? 28;

  const container = scene.add.container(options.x, options.y);
  const graphics = scene.add.graphics();

  const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    fontSize: "13px",
    color: theme.textColor,
    wordWrap: { width: maxWidth - PADDING_X * 2, useAdvancedWrap: true },
    lineSpacing: 4,
  };

  const bodyText = scene.add.text(0, 0, options.text, textStyle).setOrigin(0, 0);
  bodyText.setVisible(false);

  const textWidth = options.fixedWidth
    ? maxWidth - PADDING_X * 2
    : Math.min(bodyText.width, maxWidth - PADDING_X * 2);
  const textHeight = bodyText.height;

  let speakerText: Phaser.GameObjects.Text | null = null;
  let speakerHeight = 0;

  if (options.speaker) {
    speakerText = scene
      .add.text(0, 0, options.speaker, {
        fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
        fontSize: "11px",
        fontStyle: "bold",
        color: theme.speakerColor,
      })
      .setOrigin(0, 0);
    speakerHeight = speakerText.height + SPEAKER_GAP;
  }

  const bubbleWidth = Math.ceil(textWidth + PADDING_X * 2);
  const bubbleHeight = Math.ceil(textHeight + PADDING_Y * 2 + speakerHeight);
  const halfW = bubbleWidth / 2;
  const halfH = bubbleHeight / 2;

  graphics.fillStyle(theme.shadowColor, 0.36);
  graphics.fillRect(
    -halfW + SHADOW_OFFSET,
    -halfH + SHADOW_OFFSET,
    bubbleWidth,
    bubbleHeight,
  );

  if (tailDir === "down") {
    graphics.fillStyle(theme.shadowColor, 0.28);
    graphics.fillTriangle(
      tailOffsetX - TAIL_WIDTH / 2 + SHADOW_OFFSET,
      halfH + SHADOW_OFFSET,
      tailOffsetX + TAIL_WIDTH / 2 + SHADOW_OFFSET,
      halfH + SHADOW_OFFSET,
      tailOffsetX + SHADOW_OFFSET,
      halfH + TAIL_HEIGHT + SHADOW_OFFSET,
    );
  }

  if (tailDir === "down") {
    graphics.fillStyle(theme.borderColor, 1);
    graphics.fillTriangle(
      tailOffsetX - TAIL_WIDTH / 2,
      halfH - 1,
      tailOffsetX + TAIL_WIDTH / 2,
      halfH - 1,
      tailOffsetX,
      halfH + TAIL_HEIGHT,
    );
  }

  graphics.fillStyle(theme.borderColor, 1);
  graphics.fillRoundedRect(-halfW, -halfH, bubbleWidth, bubbleHeight, CORNER_RADIUS);

  graphics.fillStyle(theme.fillColor, 1);
  graphics.fillRoundedRect(
    -halfW + BORDER_WIDTH,
    -halfH + BORDER_WIDTH,
    bubbleWidth - BORDER_WIDTH * 2,
    bubbleHeight - BORDER_WIDTH * 2,
    CORNER_RADIUS,
  );

  if (tailDir === "down") {
    graphics.fillStyle(theme.fillColor, 1);
    graphics.fillTriangle(
      tailOffsetX - TAIL_WIDTH / 2 + BORDER_WIDTH + 1,
      halfH - BORDER_WIDTH,
      tailOffsetX + TAIL_WIDTH / 2 - BORDER_WIDTH - 1,
      halfH - BORDER_WIDTH,
      tailOffsetX,
      halfH + TAIL_HEIGHT - BORDER_WIDTH - 1,
    );
  }

  graphics.lineStyle(1, theme.borderColor, 0.18);
  graphics.strokeRoundedRect(
    -halfW + BORDER_WIDTH + 2,
    -halfH + BORDER_WIDTH + 2,
    bubbleWidth - BORDER_WIDTH * 2 - 4,
    bubbleHeight - BORDER_WIDTH * 2 - 4,
    CORNER_RADIUS,
  );

  const contentX = -halfW + PADDING_X;
  let contentY = -halfH + PADDING_Y;

  if (speakerText) {
    speakerText.setPosition(contentX, contentY);
    contentY += speakerHeight;
  }

  bodyText.setPosition(contentX, contentY);

  container.add(graphics);
  if (speakerText) {
    container.add(speakerText);
  }
  container.add(bodyText);

  bodyText.setWordWrapWidth(textWidth);

  container.setDepth(options.depth ?? 800);
  container.setAlpha(0);

  const fullText = options.text;
  bodyText.setText("");
  bodyText.setVisible(true);

  let charIndex = 0;
  let typewriterTimer: number | null = null;
  let onCompleteCallback: (() => void) | null = null;
  let isDestroyed = false;

  const finishTypewriter = () => {
    if (typewriterTimer !== null) {
      window.clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    bodyText.setText(fullText);
  };

  const startTypewriter = () => {
    charIndex = 0;
    bodyText.setText("");

    typewriterTimer = window.setInterval(() => {
      if (isDestroyed) {
        if (typewriterTimer !== null) window.clearInterval(typewriterTimer);
        return;
      }

      charIndex += 1;
      bodyText.setText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        if (typewriterTimer !== null) {
          window.clearInterval(typewriterTimer);
          typewriterTimer = null;
        }
        onCompleteCallback?.();
      }
    }, typewriterSpeed);
  };

  scene.tweens.add({
    targets: container,
    alpha: 0.96,
    y: options.y - 4,
    duration: 220,
    ease: "Back.easeOut",
    onComplete: () => {
      if (!isDestroyed) {
        startTypewriter();
      }
    },
  });

  const originalDestroy = container.destroy.bind(container);

  const destroyBubble = (callback?: () => void) => {
    if (isDestroyed) return;
    isDestroyed = true;

    if (typewriterTimer !== null) {
      window.clearInterval(typewriterTimer);
      typewriterTimer = null;
    }

    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 6,
      duration: 160,
      ease: "Sine.easeIn",
      onComplete: () => {
        originalDestroy(true);
        callback?.();
      },
    });
  };

  const skipTypewriter = () => {
    finishTypewriter();
  };

  (container as SpeechBubbleContainer).destroyBubble = destroyBubble;
  (container as SpeechBubbleContainer).skipTypewriter = skipTypewriter;
  (container as SpeechBubbleContainer).onTypewriterComplete = (cb: () => void) => {
    onCompleteCallback = cb;
  };

  return container;
}

export interface SpeechBubbleContainer extends Phaser.GameObjects.Container {
  destroyBubble: (callback?: () => void) => void;
  skipTypewriter: () => void;
  onTypewriterComplete: (cb: () => void) => void;
}

export function isSpeechBubble(obj: unknown): obj is SpeechBubbleContainer {
  return (
    obj != null &&
    typeof (obj as SpeechBubbleContainer).destroyBubble === "function"
  );
}

export const BUBBLE_THEMES = {
  player: {
    borderColor: 0x2b2430,
    fillColor: 0xfff6cf,
    shadowColor: 0x15131c,
    textColor: "#1a1d28",
    speakerColor: "#b84f61",
  } satisfies BubbleTheme,

  shadow: {
    borderColor: 0x1a1d28,
    fillColor: 0x21242f,
    shadowColor: 0x0a0b10,
    textColor: "#c8cad8",
    speakerColor: "#7a6f92",
  } satisfies BubbleTheme,

  friend: {
    borderColor: 0x3d2028,
    fillColor: 0xfde8e0,
    shadowColor: 0x15131c,
    textColor: "#2a1820",
    speakerColor: "#b84f61",
  } satisfies BubbleTheme,

  parent: {
    borderColor: 0x1e3028,
    fillColor: 0xe4f0e8,
    shadowColor: 0x0a1510,
    textColor: "#1a2820",
    speakerColor: "#477060",
  } satisfies BubbleTheme,

  narration: {
    borderColor: 0x1a1d28,
    fillColor: 0x1a1e2a,
    shadowColor: 0x080910,
    textColor: "#d9dac9",
    speakerColor: "#f0c36b",
  } satisfies BubbleTheme,
} as const;
