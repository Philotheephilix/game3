import * as ex from 'excalibur';

/**
 * Base game entity class
 * Extend this for different types of game objects
 */
export class GameEntity extends ex.Actor {
  protected health: number = 100;
  protected maxHealth: number = 100;

  constructor(config: ex.ActorArgs) {
    super(config);
  }

  onInitialize(engine: ex.Engine): void {
    // Override in subclasses
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  die(): void {
    this.kill();
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }
}
