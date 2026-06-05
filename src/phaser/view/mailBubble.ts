import Phaser from "phaser";

type MailBubbleOptions = {
  x: number;
  y: number;
  textureKey: string;
};

export function createMailBubble(
  scene: Phaser.Scene,
  options: MailBubbleOptions,
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
  const mail = scene.add.image(0, 0, options.textureKey);
  const pingBorder = scene.add.rectangle(28, -21, 14, 14, borderColor, 1);
  const ping = scene.add.rectangle(28, -21, 8, 8, accentColor, 1);

  mail.setDisplaySize(35, 24);
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
    mail,
    pingBorder,
    ping,
  ]);
  bubble.setDepth(760);
  bubble.setSize(96, 96);
  bubble.setAlpha(0.94);

  return bubble;
}

export function setMailBubbleHighlighted(
  container: Phaser.GameObjects.Container,
  highlighted: boolean,
): void {
  container.setScale(highlighted ? 1.06 : 1);
  container.setAlpha(highlighted ? 1 : 0.94);
}
