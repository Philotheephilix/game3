import * as ex from 'excalibur';

/**
 * Main menu/loading scene
 */
export class MainScene extends ex.Scene {
  private startText!: ex.Text;
  private startButton!: ex.Actor;

  onInitialize(engine: ex.Engine): void {
    console.log('MainScene onInitialize called');

    // Background: harvest-heist looping gif, scaled to cover
    try {
      const bgSource = new ex.ImageSource('/harvest-heist-bg.gif');
      bgSource.load().then(() => {
        const bgSprite = bgSource.toSprite();
        const scaleX = engine.drawWidth / bgSprite.width;
        const scaleY = engine.drawHeight / bgSprite.height;
        const scale = Math.max(scaleX, scaleY);
        bgSprite.scale = ex.vec(scale, scale);

        const bgActor = new ex.Actor({
          pos: new ex.Vector(engine.drawWidth / 2, engine.drawHeight / 2),
          anchor: ex.Vector.Half,
          z: -1000
        });
        bgActor.graphics.use(bgSprite);
        this.add(bgActor);
      }).catch(() => {/* ignore */});
    } catch {}

    // Title text (optional)
    const titleText = new ex.Text({
      text: 'HARVEST HEIST',
      font: new ex.Font({ size: 28, family: 'Press Start 2P, Arial', color: ex.Color.fromHex('#ffffff') })
    });
    const titleActor = new ex.Actor({
      pos: new ex.Vector(engine.drawWidth / 2, engine.drawHeight / 2 - 80),
      anchor: ex.Vector.Half
    });
    titleActor.graphics.add(titleText);
    this.add(titleActor);

    // Start button visuals
    const buttonWidth = Math.min(520, Math.floor(engine.drawWidth * 0.6));
    const buttonHeight = 64;
    this.startButton = new ex.Actor({
      pos: new ex.Vector(engine.drawWidth / 2, engine.drawHeight / 2),
      width: buttonWidth,
      height: buttonHeight,
      anchor: ex.Vector.Half,
      color: ex.Color.Transparent
    });

    // Button background (rounded rect look using a rectangle and shadow layer)
    const bg = new ex.GraphicsGroup({
      members: [
        {
          graphic: new ex.Rectangle({
            width: buttonWidth,
            height: buttonHeight,
            color: ex.Color.fromHex('#1a1a1a')
          }),
          offset: ex.vec(2, 4) // drop shadow
        },
        {
          graphic: new ex.Rectangle({
            width: buttonWidth,
            height: buttonHeight,
            color: ex.Color.fromHex('#d97706') // bottom gradient color approximation
          }),
          offset: ex.vec(0, 0)
        }
      ]
    });
    this.startButton.graphics.add(bg);

    // Button label
    this.startText = new ex.Text({
      text: 'START HEIST',
      font: new ex.Font({ size: 22, family: 'Press Start 2P, Arial', color: ex.Color.White })
    });
    this.startButton.graphics.use(this.startText);
    this.add(this.startButton);

    // Pointer interactions
    this.startButton.on('pointerenter', () => {
      this.startButton.scale = ex.vec(1.04, 1.04);
    });
    this.startButton.on('pointerleave', () => {
      this.startButton.scale = ex.vec(1, 1);
    });
    this.startButton.on('pointerdown', () => {
      this.startButton.scale = ex.vec(0.98, 0.98);
    });
    this.startButton.on('pointerup', () => {
      this.startButton.scale = ex.vec(1, 1);
      engine.goToScene('game');
    });
  }

  onActivate(): void {
    // Called when scene becomes active
    console.log('MainScene activated');
  }

  onDeactivate(): void {
    // Called when scene is deactivated
    console.log('MainScene deactivated');
  }
}
