import Phaser from "phaser";

type IconNotificationBubbleOptions = {
  x: number;
  y: number;
  textureKey: string;
};

export function createIconNotificationBubble(
  scene: Phaser.Scene,
  options: IconNotificationBubbleOptions,
): Phaser.GameObjects.Container {
  const bubble = scene.add.container(options.x, options.y);
  const borderColor = 0x2b2430;
  const fillColor = 0xfff6cf;
  const shadowColor = 0x15131c;
  const accentColor = 0xf0c36b;

  const shadow = scene.add.rectangle(4, 7, 76, 54, shadowColor, 0.34);
  const tailShadow = scene.add.rectangle(-27, 42, 26, 18, shadowColor, 0.28);

  const tailBorderA = scene.add.rectangle(-19, 29, 24, 18, borderColor, 1);
  const tailBorderB = scene.add.rectangle(-31, 42, 18, 14, borderColor, 1);
  const tailFillA = scene.add.rectangle(-17, 27, 16, 10, fillColor, 1);
  const tailFillB = scene.add.rectangle(-29, 39, 10, 8, fillColor, 1);

  const outerWide = scene.add.rectangle(0, 0, 78, 42, borderColor, 1);
  const outerTall = scene.add.rectangle(0, 0, 62, 58, borderColor, 1);
  const innerWide = scene.add.rectangle(0, 0, 68, 34, fillColor, 1);
  const innerTall = scene.add.rectangle(0, 0, 52, 48, fillColor, 1);
  const icon = scene.add.image(0, 1, options.textureKey);
  const pingBorder = scene.add.rectangle(28, -21, 14, 14, borderColor, 1);
  const ping = scene.add.rectangle(28, -21, 8, 8, accentColor, 1);

  icon.setDisplaySize(34, 34);
  icon.setTexture(options.textureKey);
  icon.setOrigin(0.5);
  bubble.add([
    tailShadow,
    shadow,
    tailBorderA,
    tailBorderB,
    outerWide,
    outerTall,
    tailFillA,
    tailFillB,
    innerWide,
    innerTall,
    icon,
    pingBorder,
    ping,
  ]);
  bubble.setDepth(760);
  bubble.setSize(96, 96);
  bubble.setAlpha(0.94);

  return bubble;
}

export function setIconNotificationBubbleHighlighted(
  container: Phaser.GameObjects.Container,
  highlighted: boolean,
): void {
  container.setScale(highlighted ? 1.06 : 1);
  container.setAlpha(highlighted ? 1 : 0.94);
}
