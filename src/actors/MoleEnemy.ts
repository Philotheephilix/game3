import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Mole enemy actor
 * Spawns from underground and moves around
 */
export class MoleEnemy extends ex.Actor {
  private enteringAnimation!: ex.Animation;
  private leavingAnimation!: ex.Animation;
  private idleAnimation!: ex.Animation;
  private spittingAnimation!: ex.Animation;
  private damageAnimation!: ex.Animation;
  private deadAnimation!: ex.Animation;
  private state: 'entering' | 'idle' | 'spitting' | 'leaving' | 'damaged' | 'dead' = 'entering';
  private onProjectileFired?: (fromPos: ex.Vector, toPos: ex.Vector) => void;
  private getTargetPosition?: () => ex.Vector;
  private health: number = 3;
  private maxHealth: number = 3;
  private healthBarActor!: ex.Actor;
  private healthBarBackground!: ex.Actor;

  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 32,
      height: 32,
      collisionType: ex.CollisionType.Passive,
      z: Number.MAX_SAFE_INTEGER - 5, // Above coins, below player
    });
  }

  onInitialize(_engine: ex.Engine): void {
    console.log('Mole enemy initializing at', this.pos);
    
    // Set up health bar immediately (scene is available)
    this.setupHealthBar();
    
    // Wait for images to load
    const loadEntering = Images.moleEntering.isLoaded()
      ? Promise.resolve()
      : Images.moleEntering.load();
    const loadLeaving = Images.moleLeaving.isLoaded()
      ? Promise.resolve()
      : Images.moleLeaving.load();
    const loadIdle = Images.moleIdle.isLoaded()
      ? Promise.resolve()
      : Images.moleIdle.load();
    const loadSpitting = Images.moleSpitting.isLoaded()
      ? Promise.resolve()
      : Images.moleSpitting.load();
    const loadDamage = Images.moleDamage.isLoaded()
      ? Promise.resolve()
      : Images.moleDamage.load();
    const loadDead = Images.moleDead.isLoaded()
      ? Promise.resolve()
      : Images.moleDead.load();

    Promise.all([loadEntering, loadLeaving, loadIdle, loadSpitting, loadDamage, loadDead]).then(() => {
      console.log('Mole sprites loaded, setting up animations');
      this.setupAnimations();
      this.startEntering();
    });
  }

  private setupHealthBar(): void {
    // Create health bar background
    this.healthBarBackground = new ex.Actor({
      pos: new ex.Vector(this.pos.x, this.pos.y + 20),
      width: 24, // Smaller width
      height: 2,
      z: Number.MAX_SAFE_INTEGER - 4, // Just below player
    });

    const backgroundRect = new ex.Rectangle({
      width: 24,
      height: 2,
      color: ex.Color.fromHex('#300000'),
    });
    this.healthBarBackground.graphics.add(backgroundRect);

    // Create health bar fill
    this.healthBarActor = new ex.Actor({
      pos: new ex.Vector(this.pos.x, this.pos.y + 20),
      width: 24,
      height: 2,
      z: Number.MAX_SAFE_INTEGER - 4,
    });

    // Update health bar
    this.updateHealthBar();

    // Add to scene if available
    if (this.scene) {
      this.scene.add(this.healthBarBackground);
      this.scene.add(this.healthBarActor);
    }
  }

  private updateHealthBar(): void {
    const healthPercent = this.health / this.maxHealth;
    const currentWidth = 24 * healthPercent;

    const fillRect = new ex.Rectangle({
      width: currentWidth,
      height: 2,
      color: ex.Color.Red,
    });

    this.healthBarActor.graphics.use(fillRect);
  }

  private setupAnimations(): void {
    // Entering animation - 3 rows x 4 columns
    const enteringSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleEntering,
      grid: {
        rows: 3,
        columns: 4,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for entering animation
    this.enteringAnimation = ex.Animation.fromSpriteSheet(
      enteringSheet,
      [0, 1, 2, 3], // Forward order
      150 // Animation speed in ms
    );

    // Leaving animation - 3 rows x 6 columns
    const leavingSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleLeaving,
      grid: {
        rows: 3,
        columns: 6,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for leaving animation
    this.leavingAnimation = ex.Animation.fromSpriteSheet(
      leavingSheet,
      [0, 1, 2, 3, 4, 5], // Order: visible to hidden
      150
    );

    // Idle animation - 3 rows x 4 columns
    const idleSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleIdle,
      grid: {
        rows: 3,
        columns: 4,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for idle animation
    this.idleAnimation = ex.Animation.fromSpriteSheet(
      idleSheet,
      [0, 1, 2, 3], // Idle frames
      200
    );

    // Spitting animation - 3 rows x 5 columns  
    const spittingSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleSpitting,
      grid: {
        rows: 3,
        columns: 5,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for spitting animation
    this.spittingAnimation = ex.Animation.fromSpriteSheet(
      spittingSheet,
      [0, 1, 2, 3, 4], // Spitting frames
      150
    );

    // Damage animation - 64x96 (2 columns x 3 rows)
    const damageSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleDamage,
      grid: {
        rows: 3,
        columns: 2,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for damage animation
    this.damageAnimation = ex.Animation.fromSpriteSheet(
      damageSheet,
      [0, 1], // Damage frames
      100
    );

    // Dead animation - 160x96 (5 columns x 3 rows)
    const deadSheet = ex.SpriteSheet.fromImageSource({
      image: Images.moleDead,
      grid: {
        rows: 3,
        columns: 5,
        spriteWidth: 32,
        spriteHeight: 32,
      },
    });

    // Use first row for dead animation
    this.deadAnimation = ex.Animation.fromSpriteSheet(
      deadSheet,
      [0, 1, 2, 3, 4], // Dead frames
      100
    );
  }

  private startEntering(): void {
    console.log('Starting entering animation');
    this.state = 'entering';
    this.graphics.use(this.enteringAnimation);
    this.enteringAnimation.play();
    
    // After entering completes, stay idle
    setTimeout(() => {
      console.log('Transitioning to idle');
      this.state = 'idle';
      this.graphics.use(this.idleAnimation);
      this.idleAnimation.play();
      this.vel = ex.Vector.Zero; // Don't move
      
      // Wait a bit, then spit
      setTimeout(() => {
        this.startSpitting();
      }, 1000 + Math.random() * 1000);
    }, 600); // 4 frames * 150ms
  }

  private startSpitting(): void {
    console.log('Starting spitting animation');
    this.state = 'spitting';
    this.graphics.use(this.spittingAnimation);
    this.spittingAnimation.play();
    
    // Fire projectile after animation starts
    setTimeout(() => {
      this.fireProjectile();
    }, 300); // Fire after some frames
    
    // After spitting completes, leave
    setTimeout(() => {
      if (this.state !== 'dead') { // Don't leave if dead
        this.startLeaving();
      }
    }, 750); // 5 frames * 150ms
  }

  private fireProjectile(): void {
    if (this.onProjectileFired && this.getTargetPosition) {
      const targetPos = this.getTargetPosition();
      console.log('Firing from', this.pos, 'to', targetPos);
      
      // Calculate spawn position from mole's mouth
      const direction = targetPos.sub(this.pos).normalize();
      const spawnOffset = direction.scale(16); // Offset from mole
      const spawnPos = this.pos.add(spawnOffset);
      
      this.onProjectileFired(spawnPos, targetPos);
    }
  }

  setProjectileCallback(
    callback: (fromPos: ex.Vector, toPos: ex.Vector) => void,
    getTargetCallback?: () => ex.Vector
  ): void {
    this.onProjectileFired = callback;
    this.getTargetPosition = getTargetCallback;
  }

  takeDamage(damage: number): void {
    if (this.state === 'dead') return;
    
    this.health -= damage;
    console.log(`Mole took ${damage} damage. Health: ${this.health}/${this.maxHealth}`);
    
    // Update health bar
    this.updateHealthBar();
    
    if (this.health <= 0) {
      this.die();
    } else {
      this.showDamageAnimation();
    }
  }

  private showDamageAnimation(): void {
    this.state = 'damaged';
    this.graphics.use(this.damageAnimation);
    this.damageAnimation.play();
    
    // Return to idle after damage
    setTimeout(() => {
      if (this.state === 'damaged') {
        this.state = 'idle';
        this.graphics.use(this.idleAnimation);
        this.idleAnimation.play();
      }
    }, 200); // 2 frames * 100ms
  }

  private die(): void {
    console.log('Mole died');
    this.state = 'dead';
    this.vel = ex.Vector.Zero;
    this.graphics.use(this.deadAnimation);
    this.deadAnimation.play();
    
    // Remove health bars
    if (this.healthBarActor) {
      this.healthBarActor.kill();
    }
    if (this.healthBarBackground) {
      this.healthBarBackground.kill();
    }
    
    // Remove after death animation
    setTimeout(() => {
      this.kill();
    }, 500); // 5 frames * 100ms
  }

  isDead(): boolean {
    return this.state === 'dead';
  }

  updateHealthBarPosition(): void {
    if (this.healthBarActor && this.healthBarBackground) {
      this.healthBarActor.pos = new ex.Vector(this.pos.x, this.pos.y + 20);
      this.healthBarBackground.pos = new ex.Vector(this.pos.x, this.pos.y + 20);
    }
  }

  private startLeaving(): void {
    console.log('Starting leaving animation');
    this.state = 'leaving';
    this.graphics.use(this.leavingAnimation);
    this.leavingAnimation.play();
    this.vel = ex.Vector.Zero; // Stop moving
    
    // After leaving completes, remove mole
    setTimeout(() => {
      console.log('Removing mole');
      // Remove health bars before killing mole
      if (this.healthBarActor) {
        this.healthBarActor.kill();
      }
      if (this.healthBarBackground) {
        this.healthBarBackground.kill();
      }
      this.kill();
    }, 900); // 6 frames * 150ms
  }

}

