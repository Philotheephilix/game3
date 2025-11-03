import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Player actor class
 */
export class Player extends ex.Actor {
  private speed: number = 100;
  private idleAnimations: { [key: string]: ex.Animation } = {};
  private runAnimations: { [key: string]: ex.Animation } = {};
  private bowAttackAnimations: { [key: string]: ex.Animation } = {};
  private sickleAttackAnimations: { [key: string]: ex.Animation } = {};
  private damageAnimations: { [key: string]: ex.Animation } = {};
  private deadAnimations: { [key: string]: ex.Animation } = {};
  private lastFacingDirection: string = 'down'; // Track last facing direction for idle
  private isAttacking: boolean = false;
  private isDamaged: boolean = false;
  private isDead: boolean = false;
  private onArrowShot?: (fromPos: ex.Vector, direction: ex.Vector) => void;
  private onSickleHit?: (position: ex.Vector) => void;
  private health: number = 200;
  private maxHealth: number = 200;

  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 16,  // Set explicit size for collision
      height: 16,
      collisionType: ex.CollisionType.Active,
    });
  }

  onInitialize(engine: ex.Engine): void {
    // Wait for all images to be loaded before creating sprite sheets
    const loadIdle = Images.playerIdle.isLoaded() 
      ? Promise.resolve() 
      : Images.playerIdle.load();
    const loadRun = Images.playerRun.isLoaded() 
      ? Promise.resolve() 
      : Images.playerRun.load();
    const loadBowAttack = Images.playerBowAttack.isLoaded() 
      ? Promise.resolve() 
      : Images.playerBowAttack.load();
    const loadSickle = Images.playerSickle.isLoaded() 
      ? Promise.resolve() 
      : Images.playerSickle.load();
    const loadDamage = Images.playerDamage.isLoaded() 
      ? Promise.resolve() 
      : Images.playerDamage.load();
    const loadDead = Images.playerDead.isLoaded() 
      ? Promise.resolve() 
      : Images.playerDead.load();
    
    Promise.all([loadIdle, loadRun, loadBowAttack, loadSickle, loadDamage, loadDead]).then(() => {
      this.setupSpriteSheet();
    });

    // Set up keyboard input
    engine.input.keyboard.on('press', (evt) => {
      this.handleInput(evt.key);
    });
    
    // Debug: Log collision info (safely)
    console.log('Player initialized - Collision Type:', this.body?.collisionType);
  }

  private setupSpriteSheet(): void {
    // Setup idle sprite sheet
    const idleImage = Images.playerIdle;
    const idleRows = 3;
    const idleColumns = 4;
    
    // Try to get dimensions from a test sprite
    let spriteWidth = 32;  // Default - common sprite size
    let spriteHeight = 32;
    
    try {
      const testSprite = idleImage.toSprite();
      if (testSprite) {
        spriteWidth = testSprite.width / idleColumns;
        spriteHeight = testSprite.height / idleRows;
        console.log('Idle image dimensions:', testSprite.width, 'x', testSprite.height);
        console.log('Calculated sprite dimensions:', spriteWidth, 'x', spriteHeight);
      }
    } catch (e) {
      console.log('Could not get idle image dimensions, using default 32x32');
    }
    
    const idleSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: idleImage,
      grid: {
        rows: idleRows,
        columns: idleColumns,
        spriteWidth: spriteWidth,
        spriteHeight: spriteHeight,
      },
    });

    // Create idle animations for each direction
    // Row 1 (frames 0-3): Facing down
    this.idleAnimations['down'] = ex.Animation.fromSpriteSheet(
      idleSpriteSheet,
      [0, 1, 2, 3],
      200
    );

    // Row 2 (frames 4-7): Facing up
    this.idleAnimations['up'] = ex.Animation.fromSpriteSheet(
      idleSpriteSheet,
      [4, 5, 6, 7],
      200
    );

    // Row 3 (frames 8-11): Facing right (mirror for left)
    this.idleAnimations['right'] = ex.Animation.fromSpriteSheet(
      idleSpriteSheet,
      [8, 9, 10, 11],
      200
    );

    // Left: same as right but flipped
    this.idleAnimations['left'] = ex.Animation.fromSpriteSheet(
      idleSpriteSheet,
      [8, 9, 10, 11],
      200
    );
    this.idleAnimations['left'].flipHorizontal = true;

    // Setup run sprite sheet
    const runImage = Images.playerRun;
    const runRows = 3;
    const runColumns = 8;
    
    // Use same sprite dimensions as idle
    const runSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: runImage,
      grid: {
        rows: runRows,
        columns: runColumns,
        spriteWidth: spriteWidth,
        spriteHeight: spriteHeight,
      },
    });

    // Create run animations for each direction
    // Row 1 (frames 0-7): Running down
    this.runAnimations['down'] = ex.Animation.fromSpriteSheet(
      runSpriteSheet,
      [0, 1, 2, 3, 4, 5, 6, 7],
      100  // Faster animation speed for running
    );

    // Row 2 (frames 8-15): Running up
    this.runAnimations['up'] = ex.Animation.fromSpriteSheet(
      runSpriteSheet,
      [8, 9, 10, 11, 12, 13, 14, 15],
      100
    );

    // Row 3 (frames 16-23): Running right (mirror for left)
    this.runAnimations['right'] = ex.Animation.fromSpriteSheet(
      runSpriteSheet,
      [16, 17, 18, 19, 20, 21, 22, 23],
      100
    );

    // Left: same as right but flipped
    this.runAnimations['left'] = ex.Animation.fromSpriteSheet(
      runSpriteSheet,
      [16, 17, 18, 19, 20, 21, 22, 23],
      100
    );
    this.runAnimations['left'].flipHorizontal = true;

    // Setup bow attack sprite sheet
    const bowImage = Images.playerBowAttack;
    const bowRows = 3;
    const bowColumns = 6; // Per description: 6 frames per row
    // Calculate sprite width: 224/6 = ~37px per frame, but let's use 32
    const bowSpriteWidth = 37; // 224/6 = 37.33
    
    const bowSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: bowImage,
      grid: {
        rows: bowRows,
        columns: bowColumns,
        spriteWidth: bowSpriteWidth,
        spriteHeight: spriteHeight,
      },
    });

    // Create bow attack animations for each direction
    // Row 1 (frame 5): Last frame for attacking down
    this.bowAttackAnimations['down'] = ex.Animation.fromSpriteSheet(
      bowSpriteSheet,
      [5],
      100
    );

    // Row 2 (frame 11): Last frame for attacking up
    this.bowAttackAnimations['up'] = ex.Animation.fromSpriteSheet(
      bowSpriteSheet,
      [11],
      100
    );

    // Row 3 (frame 17): Last frame for attacking right
    this.bowAttackAnimations['right'] = ex.Animation.fromSpriteSheet(
      bowSpriteSheet,
      [17],
      100
    );

    // Left: same as right but flipped
    this.bowAttackAnimations['left'] = ex.Animation.fromSpriteSheet(
      bowSpriteSheet,
      [17],
      100
    );
    this.bowAttackAnimations['left'].flipHorizontal = true;

    // Setup sickle attack sprite sheet
    const sickleImage = Images.playerSickle;
    const sickleRows = 3;
    const sickleColumns = 6;
    
    const sickleSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: sickleImage,
      grid: {
        rows: sickleRows,
        columns: sickleColumns,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Create sickle attack animations for each direction
    // Row 1 (frames 0-5): Facing down - sickle attack animation
    this.sickleAttackAnimations['down'] = ex.Animation.fromSpriteSheet(
      sickleSpriteSheet,
      [0, 1, 2, 3, 4, 5],
      100
    );

    // Row 2 (frames 6-11): Facing up - sickle attack animation
    this.sickleAttackAnimations['up'] = ex.Animation.fromSpriteSheet(
      sickleSpriteSheet,
      [6, 7, 8, 9, 10, 11],
      100
    );

    // Row 3 (frames 12-17): Facing right - sickle attack animation
    this.sickleAttackAnimations['right'] = ex.Animation.fromSpriteSheet(
      sickleSpriteSheet,
      [12, 13, 14, 15, 16, 17],
      100
    );

    // Left: same as right but flipped
    this.sickleAttackAnimations['left'] = ex.Animation.fromSpriteSheet(
      sickleSpriteSheet,
      [12, 13, 14, 15, 16, 17],
      100
    );
    this.sickleAttackAnimations['left'].flipHorizontal = true;

    // Setup damage sprite sheet
    const damageImage = Images.playerDamage;
    const damageRows = 3;
    const damageColumns = 4;
    
    const damageSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: damageImage,
      grid: {
        rows: damageRows,
        columns: damageColumns,
        spriteWidth: spriteWidth,
        spriteHeight: spriteHeight,
      },
    });

    // Create damage animations for each direction
    // Row 1 (frames 0-3): Facing down - damage animation
    this.damageAnimations['down'] = ex.Animation.fromSpriteSheet(
      damageSpriteSheet,
      [0, 1, 2, 3],
      150 // Fast animation for damage flash
    );

    // Row 2 (frames 4-7): Facing up - damage animation
    this.damageAnimations['up'] = ex.Animation.fromSpriteSheet(
      damageSpriteSheet,
      [4, 5, 6, 7],
      150
    );

    // Row 3 (frames 8-11): Facing right - damage animation
    this.damageAnimations['right'] = ex.Animation.fromSpriteSheet(
      damageSpriteSheet,
      [8, 9, 10, 11],
      150
    );

    // Left: same as right but flipped
    this.damageAnimations['left'] = ex.Animation.fromSpriteSheet(
      damageSpriteSheet,
      [8, 9, 10, 11],
      150
    );
    this.damageAnimations['left'].flipHorizontal = true;

    // Setup dead sprite sheet
    const deadImage = Images.playerDead;
    const deadRows = 3;
    const deadColumns = 4;
    
    const deadSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: deadImage,
      grid: {
        rows: deadRows,
        columns: deadColumns,
        spriteWidth: spriteWidth,
        spriteHeight: spriteHeight,
      },
    });

    // Create dead animations for each direction
    // Row 1 (frames 0-3): Facing down - dead animation
    this.deadAnimations['down'] = ex.Animation.fromSpriteSheet(
      deadSpriteSheet,
      [0, 1, 2, 3],
      200,
      ex.AnimationStrategy.Freeze // Stop at last frame
    );

    // Row 2 (frames 4-7): Facing up - dead animation
    this.deadAnimations['up'] = ex.Animation.fromSpriteSheet(
      deadSpriteSheet,
      [4, 5, 6, 7],
      200,
      ex.AnimationStrategy.Freeze // Stop at last frame
    );

    // Row 3 (frames 8-11): Facing right - dead animation
    this.deadAnimations['right'] = ex.Animation.fromSpriteSheet(
      deadSpriteSheet,
      [8, 9, 10, 11],
      200,
      ex.AnimationStrategy.Freeze // Stop at last frame
    );

    // Left: same as right but flipped
    this.deadAnimations['left'] = ex.Animation.fromSpriteSheet(
      deadSpriteSheet,
      [8, 9, 10, 11],
      200,
      ex.AnimationStrategy.Freeze // Stop at last frame
    );
    this.deadAnimations['left'].flipHorizontal = true;

    // Start with down-facing idle animation
    this.graphics.use(this.idleAnimations['down']);
  }

  onPreUpdate(engine: ex.Engine, _delta: number): void {
    const leftRight = engine.input.keyboard.isHeld(ex.Keys.A) || engine.input.keyboard.isHeld(ex.Keys.ArrowLeft)
      ? -1
      : engine.input.keyboard.isHeld(ex.Keys.D) || engine.input.keyboard.isHeld(ex.Keys.ArrowRight)
      ? 1
      : 0;

    const upDown = engine.input.keyboard.isHeld(ex.Keys.W) || engine.input.keyboard.isHeld(ex.Keys.ArrowUp)
      ? -1
      : engine.input.keyboard.isHeld(ex.Keys.S) || engine.input.keyboard.isHeld(ex.Keys.ArrowDown)
      ? 1
      : 0;

    // Determine facing direction for animation
    let facingDirection = '';
    if (upDown > 0) {
      facingDirection = 'down';
    } else if (upDown < 0) {
      facingDirection = 'up';
    } else if (leftRight > 0) {
      facingDirection = 'right';
    } else if (leftRight < 0) {
      facingDirection = 'left';
    }

    // Update last facing direction if we have a new one
    if (facingDirection) {
      this.lastFacingDirection = facingDirection;
    } else {
      // Use last facing direction when no keys are pressed
      facingDirection = this.lastFacingDirection;
    }

    // Check if player is moving
    const isMoving = leftRight !== 0 || upDown !== 0;

    // Update animation based on direction and movement state
    // Don't override animation if currently attacking, damaged, or dead
    if (!this.isAttacking && !this.isDamaged && !this.isDead) {
      if (isMoving && this.runAnimations[facingDirection]) {
        // Use run animation when moving
        this.graphics.use(this.runAnimations[facingDirection]);
      } else if (!isMoving && this.idleAnimations[facingDirection]) {
        // Use idle animation when not moving
        this.graphics.use(this.idleAnimations[facingDirection]);
      }
    }

    // Don't move while attacking or dead
    if (!this.isAttacking && !this.isDead) {
      // Normalize diagonal movement
      const direction = new ex.Vector(leftRight, upDown);
      if (direction.size > 0) {
        direction.normalize();
      }

      this.vel = direction.scale(this.speed);
    } else {
      // Stop movement during attack
      this.vel = ex.Vector.Zero;
    }
  }

  private handleInput(key: ex.Keys): void {
    // Don't handle input if dead
    if (this.isDead) return;
    
    // Handle key 2 for bow attack
    if (key === ex.Keys.Digit2 && !this.isAttacking) {
      this.performBowAttack();
    }
    
    // Handle key 3 for sickle attack
    if (key === ex.Keys.Digit3 && !this.isAttacking) {
      this.performSickleAttack();
    }
  }

  private performBowAttack(): void {
    if (this.isAttacking || this.isDead) return;
    
    this.isAttacking = true;
    const direction = this.lastFacingDirection;
    
    // Play bow attack animation
    if (this.bowAttackAnimations[direction]) {
      this.graphics.use(this.bowAttackAnimations[direction]);
    }
    
    // Get direction vector
    const directionVector = this.getDirectionVector(direction);
    
    // Fire arrow immediately and return to idle after brief delay
    setTimeout(() => {
      this.fireArrow(directionVector);
      // Return to idle after brief delay
      setTimeout(() => {
        this.isAttacking = false;
        if (this.idleAnimations[direction]) {
          this.graphics.use(this.idleAnimations[direction]);
        }
      }, 100); // Brief delay before returning to idle
    }, 50); // Small delay for visual feedback
  }

  private getDirectionVector(direction: string): ex.Vector {
    switch (direction) {
      case 'up':
        return new ex.Vector(0, -1);
      case 'down':
        return new ex.Vector(0, 1);
      case 'left':
        return new ex.Vector(-1, 0);
      case 'right':
        return new ex.Vector(1, 0);
      default:
        return new ex.Vector(0, 1);
    }
  }

  private performSickleAttack(): void {
    if (this.isAttacking || this.isDead) return;
    
    this.isAttacking = true;
    const direction = this.lastFacingDirection;
    
    // Play sickle attack animation
    if (this.sickleAttackAnimations[direction]) {
      this.graphics.use(this.sickleAttackAnimations[direction]);
      this.sickleAttackAnimations[direction].play();
    }
    
    // Trigger sickle hit callback for crop harvesting
    if (this.onSickleHit) {
      this.onSickleHit(this.pos);
    }
    
    // Return to idle after animation completes (6 frames * 100ms = 600ms)
    setTimeout(() => {
      this.isAttacking = false;
      if (this.idleAnimations[direction]) {
        this.graphics.use(this.idleAnimations[direction]);
      }
    }, 600);
  }

  private fireArrow(direction: ex.Vector): void {
    if (this.onArrowShot) {
      // Offset spawn position slightly forward from player
      const spawnOffset = direction.scale(8);
      const spawnPos = this.pos.add(spawnOffset);
      this.onArrowShot(spawnPos, direction);
    }
  }

  setArrowCallback(callback: (fromPos: ex.Vector, direction: ex.Vector) => void): void {
    this.onArrowShot = callback;
  }

  setSickleCallback(callback: (position: ex.Vector) => void): void {
    this.onSickleHit = callback;
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
    }
    console.log(`Player took ${amount} damage. Health: ${this.health}/${this.maxHealth}`);
    
    // Check if player is dead
    if (this.health === 0) {
      this.isDead = true;
      const facingDirection = this.lastFacingDirection;
      
      if (this.deadAnimations[facingDirection]) {
        this.graphics.use(this.deadAnimations[facingDirection]);
        this.deadAnimations[facingDirection].play();
      }
      return; // Exit early, don't show damage animation when dead
    }
    
    // Show damage animation based on facing direction
    this.isDamaged = true;
    const facingDirection = this.lastFacingDirection;
    
    if (this.damageAnimations[facingDirection]) {
      this.graphics.use(this.damageAnimations[facingDirection]);
      this.damageAnimations[facingDirection].play();
    }
    
    // Return to idle after damage animation
    setTimeout(() => {
      this.isDamaged = false;
      // Don't change animation if still attacking
      if (!this.isAttacking) {
        if (this.idleAnimations[facingDirection]) {
          this.graphics.use(this.idleAnimations[facingDirection]);
        }
      }
    }, 600); // 4 frames * 150ms
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  isPlayerDead(): boolean {
    return this.isDead;
  }
}
