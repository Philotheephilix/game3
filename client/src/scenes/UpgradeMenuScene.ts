import * as ex from 'excalibur';
import { Images } from '../resources';
import { SimpleInventoryHUD } from '../ui/SimpleInventoryHUD';

// Store game engine reference for scene transitions
let gameEngine: ex.Engine | null = null;

export function setGameEngine(engine: ex.Engine) {
  gameEngine = engine;
}

// Store player stats and coin count
let playerCoinCount: number = 0;
let playerMaxHealth: number = 200;
let playerAttack: number = 1;
let playerStamina: number = 100;
let playerTimeLimit: number = 20; // Base time limit (can be upgraded)
let inventoryHUD: SimpleInventoryHUD | null = null;

export function setPlayerStats(coins: number, maxHealth: number, attack: number, stamina: number, hud: SimpleInventoryHUD, timeLimit?: number) {
  playerCoinCount = coins;
  playerMaxHealth = maxHealth;
  playerAttack = attack;
  playerStamina = stamina;
  inventoryHUD = hud;
  if (timeLimit !== undefined) {
    playerTimeLimit = timeLimit;
  }
}

export function getPlayerStats() {
  return {
    coins: playerCoinCount,
    maxHealth: playerMaxHealth,
    attack: playerAttack,
    stamina: playerStamina,
    timeLimit: playerTimeLimit,
    inventoryHUD
  };
}

export function getTimeLimit(): number {
  return playerTimeLimit;
}

export function setTimeLimit(timeLimit: number): void {
  playerTimeLimit = timeLimit;
}

export function applyUpgrades(player: any): void {
  if (player) {
    if (typeof player.setMaxHealth === 'function') {
      player.setMaxHealth(playerMaxHealth);
    }
    if (typeof player.setAttack === 'function') {
      player.setAttack(playerAttack);
    }
    if (typeof player.setStamina === 'function') {
      player.setStamina(playerStamina);
    }
  }
}

/**
 * Upgrade Menu Scene - Shows when entering door
 */
export class UpgradeMenuScene extends ex.Scene {
  private manuActor!: ex.Actor;
  private manuAnimations: ex.Animation[] = [];
  private currentAnimationIndex: number = 0;
  private upgradeLevels: { health: number; attack: number; stamina: number; timeLimit: number } = {
    health: 0,
    attack: 0,
    stamina: 0,
    timeLimit: 0
  };
  private selectedOption: number = 0; // 0: health, 1: attack, 2: stamina, 3: exit
  private coins: number = 0;
  private titleActor!: ex.Actor;
  private coinCountActor!: ex.Actor;
  private optionActors: ex.Actor[] = [];
  private instructionActor!: ex.Actor;

  onInitialize(_engine: ex.Engine): void {
    console.log('UpgradeMenuScene initializing...');
    console.log('UpgradeMenuScene engine:', _engine);
    console.log('UpgradeMenuScene this.engine:', this.engine);
    
    // Get player stats
    const stats = getPlayerStats();
    console.log('UpgradeMenuScene player stats:', stats);
    this.coins = stats.coins;
    
    // Load Manu.png if not already loaded
    const manuImage = Images.manuPortrait;
    
    if (!manuImage.isLoaded()) {
      manuImage.load().then(() => {
        this.setupManuAnimations(manuImage);
        // Setup menu after a small delay to ensure engine is ready
        setTimeout(() => this.setupMenu(), 100);
      });
    } else {
      this.setupManuAnimations(manuImage);
      // Setup menu after a small delay to ensure engine is ready
      setTimeout(() => this.setupMenu(), 100);
    }

    // Set up keyboard controls - use onPreUpdate instead for better responsiveness
    // Store engine reference for input handling
    if (!this.engine) {
      this.engine = _engine;
    }
  }

  private setupManuAnimations(manuImage: ex.ImageSource): void {
    // Manu with contour.png is 3 columns x 9 rows = 27 frames
    // Each frame is approximately 64x64 pixels
    const manuSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: manuImage,
      grid: {
        rows: 9,
        columns: 3,
        spriteWidth: 64,
        spriteHeight: 64,
      },
    });

    // Create animations for different expressions
    // Row 0 (frames 0-2): Neutral/Happy - IDLE ANIMATION (loop this)
    const idleAnim = ex.Animation.fromSpriteSheet(manuSpriteSheet, [0, 1, 2], 600);
    idleAnim.loop = true;
    this.manuAnimations.push(idleAnim);
    
    // Row 1 (frames 3-5): Happy/Sparkling - SUCCESS
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [3, 4, 5, 4, 3], 300));
    // Row 2 (frames 6-8): Concerned
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [6, 7, 8], 500));
    // Row 3 (frames 9-11): Eyes closed happy
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [9, 10, 11], 400));
    // Row 4 (frames 12-14): Eyes closed neutral
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [12, 13, 14], 500));
    // Row 5 (frames 15-17): Angry
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [15, 16, 17], 300));
    // Row 6 (frames 18-20): Angry variant
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [18, 19, 20], 300));
    // Row 7 (frames 21-23): Sad - FAILURE
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [21, 22, 23], 400));
    // Row 8 (frames 24-26): Sad variant
    this.manuAnimations.push(ex.Animation.fromSpriteSheet(manuSpriteSheet, [24, 25, 26], 400));

    // Create Manu actor - position on left side of screen for portrait display
    if (!this.engine) return;
    
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    
    // Position Manu portrait on the left side of the menu area - properly aligned
    const portraitSize = 192; // Larger size for better visibility (3x original 64px)
    const menuCenterX = screenWidth / 2;
    const menuCenterY = screenHeight / 2;
    
    this.manuActor = new ex.Actor({
      pos: new ex.Vector(menuCenterX - 320, menuCenterY - 10), // Left side of menu, vertically centered
      width: portraitSize,
      height: portraitSize,
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER - 3, // Above menu background
    });

    // Start with idle animation (index 0) - make sure it loops and animates continuously
    if (this.manuAnimations[0]) {
      this.currentAnimationIndex = 0;
      const scaleFactor = portraitSize / 64; // Scale from 64px to portraitSize (3x)
      this.manuAnimations[0].scale = new ex.Vector(scaleFactor, scaleFactor);
      this.manuAnimations[0].loop = true; // Ensure looping is enabled
      this.manuActor.graphics.use(this.manuAnimations[0]);
      this.manuAnimations[0].play();
      
      console.log('Manu portrait animation started, looping:', this.manuAnimations[0].loop);
    }

    this.add(this.manuActor);
  }


  private selectOption(): void {
    if (this.selectedOption === 0) {
      this.upgradeHealth();
    } else if (this.selectedOption === 1) {
      this.upgradeAttack();
    } else if (this.selectedOption === 2) {
      this.upgradeStamina();
    } else if (this.selectedOption === 3) {
      this.upgradeTimeLimit();
    } else if (this.selectedOption === 4) {
      this.exitMenu();
    }
  }

  private upgradeHealth(): void {
    const cost = 10 + (this.upgradeLevels.health * 10);
    if (this.coins >= cost) {
      this.coins -= cost;
      this.upgradeLevels.health++;
      playerMaxHealth += 20; // Increase max health by 20
      playerCoinCount = this.coins;
      // Update inventory coin count
      if (inventoryHUD) {
        this.updateCoinCount();
      }
      // Update menu display immediately
      this.updateMenuDisplay();
      // Play happy animation
      this.playAnimation(1); // Sparkling happy
      console.log(`Health upgraded! New max health: ${playerMaxHealth}, Cost: ${cost}, Remaining coins: ${this.coins}`);
    } else {
      // Play sad animation
      this.playAnimation(7); // Sad
      console.log(`Not enough coins! Need ${cost}, have ${this.coins}`);
    }
  }

  private upgradeAttack(): void {
    const cost = 10 + (this.upgradeLevels.attack * 10);
    if (this.coins >= cost) {
      this.coins -= cost;
      this.upgradeLevels.attack++;
      playerAttack += 10; // Increase attack by 10
      playerCoinCount = this.coins;
      // Update inventory coin count
      if (inventoryHUD) {
        this.updateCoinCount();
      }
      // Update menu display immediately
      this.updateMenuDisplay();
      // Play happy animation
      this.playAnimation(1); // Sparkling happy
      console.log(`Attack upgraded! New attack: ${playerAttack}, Cost: ${cost}, Remaining coins: ${this.coins}`);
    } else {
      // Play sad animation
      this.playAnimation(7); // Sad
      console.log(`Not enough coins! Need ${cost}, have ${this.coins}`);
    }
  }

  private upgradeStamina(): void {
    const cost = 10 + (this.upgradeLevels.stamina * 10);
    if (this.coins >= cost) {
      this.coins -= cost;
      this.upgradeLevels.stamina++;
      playerStamina += 20; // Increase stamina by 20
      playerCoinCount = this.coins;
      // Update inventory coin count
      if (inventoryHUD) {
        this.updateCoinCount();
      }
      // Update menu display immediately
      this.updateMenuDisplay();
      // Play happy animation
      this.playAnimation(1); // Sparkling happy
      console.log(`Stamina upgraded! New stamina: ${playerStamina}, Cost: ${cost}, Remaining coins: ${this.coins}`);
    } else {
      // Play sad animation
      this.playAnimation(7); // Sad
      console.log(`Not enough coins! Need ${cost}, have ${this.coins}`);
    }
  }

  private upgradeTimeLimit(): void {
    const cost = 50; // Fixed cost of 50 coins
    if (this.coins >= cost) {
      this.coins -= cost;
      this.upgradeLevels.timeLimit++;
      playerTimeLimit += 10; // Increase time limit by 10 seconds
      setTimeLimit(playerTimeLimit);
      playerCoinCount = this.coins;
      // Update inventory coin count
      if (inventoryHUD) {
        this.updateCoinCount();
      }
      // Update menu display immediately
      this.updateMenuDisplay();
      // Play happy animation
      this.playAnimation(1); // Sparkling happy
      console.log(`Time Limit upgraded! New time limit: ${playerTimeLimit}s, Cost: ${cost}, Remaining coins: ${this.coins}`);
    } else {
      // Play sad animation
      this.playAnimation(7); // Sad
      console.log(`Not enough coins! Need ${cost}, have ${this.coins}`);
    }
  }

  private updateCoinCount(): void {
    if (!inventoryHUD) return;
    
    // Remove all coins from inventory
    for (let i = 0; i < 8; i++) {
      const item = inventoryHUD['inventory'][i];
      if (item && item.type === 'coin') {
        inventoryHUD['inventory'][i] = null;
        inventoryHUD['updateSlotDisplay'](i);
      }
    }
    
    // Add remaining coins back
    let remainingCoins = this.coins;
    for (let i = 0; i < 8 && remainingCoins > 0; i++) {
      if (inventoryHUD['inventory'][i] === null) {
        const coinSprite = this.createCoinSprite();
        if (coinSprite) {
          inventoryHUD.addItem({
            type: 'coin',
            sprite: coinSprite,
            count: Math.min(remainingCoins, 99),
          });
          remainingCoins -= Math.min(remainingCoins, 99);
        }
      }
    }
    
    playerCoinCount = this.coins;
  }

  private createCoinSprite(): ex.Sprite | null {
    const moneyImage = Images.money;
    if (!moneyImage.isLoaded()) return null;
    
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: moneyImage,
      grid: {
        rows: 1,
        columns: 6,
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });
    
    const coinAnimation = ex.Animation.fromSpriteSheet(spriteSheet, [0], 100);
    return coinAnimation.frames[0]?.graphic as ex.Sprite || null;
  }

  private playAnimation(index: number): void {
    if (index >= 0 && index < this.manuAnimations.length && this.manuActor) {
      this.currentAnimationIndex = index;
      const anim = this.manuAnimations[index];
      anim.loop = false;
      // Preserve scale when switching animations
      const currentScale = this.manuAnimations[0]?.scale || new ex.Vector(2.5, 2.5);
      anim.scale = currentScale;
      this.manuActor.graphics.use(anim);
      anim.play();
      
      // Return to neutral after animation
      setTimeout(() => {
        if (this.manuAnimations[0] && this.manuActor) {
          this.currentAnimationIndex = 0;
          this.manuAnimations[0].loop = true;
          this.manuAnimations[0].scale = currentScale;
          this.manuActor.graphics.use(this.manuAnimations[0]);
          this.manuAnimations[0].play();
        }
      }, 2000);
    }
  }

  private exitMenu(): void {
    const engine = gameEngine || this.engine;
    if (engine) {
      // Go back to home screen instead of game
      // Hide the game and show the homepage
      const container = document.querySelector('.container');
      const background = document.querySelector('.background');
      
      if (container && background) {
        container.style.display = 'flex';
        background.style.display = 'block';
      }
      
      // Stop the game engine
      if (engine) {
        engine.stop();
      }
      
      // Reset game state - remove the game canvas
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.remove();
      }
      
      // Reset the gameStarted flag so the game can be restarted
      // Access the global gameStarted variable in index.html
      if (typeof window !== 'undefined') {
        (window as any).gameStarted = false;
        (window as any).gameInstance = null;
        
        // Also reset the module-level variables if accessible
        // The handlePlayGame function will check these and restart properly
        console.log('[EXIT] Reset gameStarted flag - game can be restarted');
      }
    }
  }

  private setupMenu(): void {
    if (!this.engine) return;
    
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    
    // Create dark blue background overlay
    const overlayColor = new ex.Color(0, 0, 50, 0.9); // Dark blue
    const overlayActor = new ex.Actor({
      pos: new ex.Vector(screenWidth / 2, screenHeight / 2),
      width: screenWidth,
      height: screenHeight,
      z: Number.MAX_SAFE_INTEGER - 10,
    });
    const overlayRect = new ex.Rectangle({
      width: screenWidth,
      height: screenHeight,
      color: overlayColor,
    });
    overlayActor.graphics.add(overlayRect);
    this.add(overlayActor);
    
    // Menu background (brown rectangle with orange contour) - properly centered
    const menuX = screenWidth / 2;
    const menuY = screenHeight / 2;
    const menuWidth = 700;
    const menuHeight = 450;
    
    const menuBg = new ex.Actor({
      pos: new ex.Vector(menuX, menuY),
      width: menuWidth,
      height: menuHeight,
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER - 5,
    });
    const menuBgRect = new ex.Rectangle({
      width: menuWidth,
      height: menuHeight,
      color: ex.Color.fromHex('#3D2817'), // Dark brown
      strokeColor: ex.Color.fromHex('#FF8C00'), // Orange contour
    });
    menuBg.graphics.add(menuBgRect);
    this.add(menuBg);
    
    // Create title - centered
    const titleText = new ex.Text({
      text: 'UPGRADE SHOP',
      font: new ex.Font({
        size: 36,
        family: 'Arial',
        color: ex.Color.fromHex('#FFD700'),
        bold: true,
      }),
    });
    this.titleActor = new ex.Actor({
      pos: new ex.Vector(menuX, menuY - 180),
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER,
    });
    this.titleActor.graphics.add(titleText);
    this.add(this.titleActor);
    
    // Create coin count actor - centered below title
    const coinText = new ex.Text({
      text: `Coins: ${this.coins}`,
      font: new ex.Font({
        size: 24,
        family: 'Arial',
        color: ex.Color.White,
        bold: true,
      }),
    });
    this.coinCountActor = new ex.Actor({
      pos: new ex.Vector(menuX, menuY - 130),
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER,
    });
    this.coinCountActor.graphics.add(coinText);
    this.add(this.coinCountActor);
    
    // Create upgrade option actors - properly aligned in a column
    this.optionActors = [];
    const options = [
      { name: 'Health', level: this.upgradeLevels.health, cost: 10 + (this.upgradeLevels.health * 10) },
      { name: 'Attack', level: this.upgradeLevels.attack, cost: 10 + (this.upgradeLevels.attack * 10) },
      { name: 'Stamina', level: this.upgradeLevels.stamina, cost: 10 + (this.upgradeLevels.stamina * 10) },
      { name: 'Time Limit', level: this.upgradeLevels.timeLimit, cost: 50 }, // Fixed cost of 50 coins
      { name: 'Exit', level: -1, cost: 0 },
    ];
    
    // Align options properly - centered in menu area, accounting for portrait on left
    const startX = menuX + 80; // Right side of menu (portrait on left takes space)
    const startY = menuY - 50;
    const lineHeight = 55; // Increased spacing for better readability
    
    options.forEach((option, index) => {
      // Format text properly
      let displayText = '';
      if (index === 4) {
        // Exit option
        displayText = index === this.selectedOption ? '> Exit' : '  Exit';
      } else if (index === 3) {
        // Time Limit option
        const prefix = index === this.selectedOption ? '> ' : '  ';
        const currentTime = getTimeLimit();
        displayText = `${prefix}${option.name} (${currentTime}s) - ${option.cost} coins`;
      } else {
        // Other upgrade options
        const prefix = index === this.selectedOption ? '> ' : '  ';
        displayText = `${prefix}${option.name} (Level ${option.level + 1}) - ${option.cost} coins`;
      }
      
      const optionText = new ex.Text({
        text: displayText,
        font: new ex.Font({
          size: index === this.selectedOption ? 22 : 20,
          family: 'Arial',
          color: index === this.selectedOption ? ex.Color.fromHex('#FFD700') : ex.Color.White,
          bold: index === this.selectedOption,
        }),
      });
      
      const optionActor = new ex.Actor({
        pos: new ex.Vector(startX, startY + (index * lineHeight)),
        anchor: new ex.Vector(0, 0.5), // Left-center anchor for proper alignment
        z: Number.MAX_SAFE_INTEGER,
      });
      optionActor.graphics.add(optionText);
      this.optionActors.push(optionActor);
      this.add(optionActor);
    });
    
    // Create instruction text - centered at bottom
    const instructionText = new ex.Text({
      text: 'Arrow Keys: Navigate | Enter: Select | ESC/6: Exit',
      font: new ex.Font({
        size: 16,
        family: 'Arial',
        color: ex.Color.fromHex('#CCCCCC'),
      }),
    });
    this.instructionActor = new ex.Actor({
      pos: new ex.Vector(menuX, menuY + 190),
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER,
    });
    this.instructionActor.graphics.add(instructionText);
    this.add(this.instructionActor);
  }

  private updateMenuDisplay(): void {
    // Update coin count
    if (this.coinCountActor) {
      const coinText = this.coinCountActor.graphics.current[0] as ex.Text;
      if (coinText) {
        coinText.text = `Coins: ${this.coins}`;
      }
    }
    
    // Update upgrade options
    const options = [
      { name: 'Health', level: this.upgradeLevels.health, cost: 10 + (this.upgradeLevels.health * 10) },
      { name: 'Attack', level: this.upgradeLevels.attack, cost: 10 + (this.upgradeLevels.attack * 10) },
      { name: 'Stamina', level: this.upgradeLevels.stamina, cost: 10 + (this.upgradeLevels.stamina * 10) },
      { name: 'Time Limit', level: this.upgradeLevels.timeLimit, cost: 50 },
      { name: 'Exit', level: -1, cost: 0 },
    ];
    
    this.optionActors.forEach((actor, index) => {
      const option = options[index];
      // Format text properly with consistent alignment
      let displayText = '';
      if (index === 4) {
        // Exit option
        displayText = index === this.selectedOption ? '> Exit' : '  Exit';
      } else if (index === 3) {
        // Time Limit option
        const prefix = index === this.selectedOption ? '> ' : '  ';
        const currentTime = getTimeLimit();
        displayText = `${prefix}${option.name} (${currentTime}s) - ${option.cost} coins`;
      } else {
        // Other upgrade options
        const prefix = index === this.selectedOption ? '> ' : '  ';
        displayText = `${prefix}${option.name} (Level ${option.level + 1}) - ${option.cost} coins`;
      }
      
      // Create a new Font object to ensure visual updates
      const isSelected = index === this.selectedOption;
      
      const newFont = new ex.Font({
        size: isSelected ? 22 : 20,
        family: 'Arial',
        color: isSelected ? ex.Color.fromHex('#FFD700') : ex.Color.White,
        bold: isSelected,
      });
      
      // Create a new Text object with the updated content and font
      const newText = new ex.Text({
        text: displayText,
        font: newFont,
      });
      
      // Replace graphics using 'use' method to force visual update
      actor.graphics.use(newText);
    });
  }

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    // Handle keyboard input
    const keyboard = _engine.input.keyboard;
    
    // Arrow keys for navigation
    if (keyboard.wasPressed(ex.Keys.ArrowUp)) {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
      this.updateMenuDisplay();
      console.log('[MENU] Arrow Up pressed, selected option:', this.selectedOption);
    }
    
    if (keyboard.wasPressed(ex.Keys.ArrowDown)) {
      this.selectedOption = Math.min(4, this.selectedOption + 1);
      this.updateMenuDisplay();
      console.log('[MENU] Arrow Down pressed, selected option:', this.selectedOption);
    }
    
    // Enter/Space to select
    if (keyboard.wasPressed(ex.Keys.Enter) || keyboard.wasPressed(ex.Keys.Space)) {
      console.log('[MENU] Enter/Space pressed, selecting option:', this.selectedOption);
      this.selectOption();
    }
    
    // ESC/6 to exit
    if (keyboard.wasPressed(ex.Keys.Escape) || keyboard.wasPressed(ex.Keys.Digit6)) {
      console.log('[MENU] Exit key pressed');
      this.exitMenu();
    }
    
    // Update menu display
    this.updateMenuDisplay();
    
    // Ensure idle animation keeps playing if it's the current animation
    // (The animation will loop automatically if loop is set to true)
  }

  onPostDraw(_ctx: ex.ExcaliburGraphicsContext, _delta: number): void {
    // Visual updates only - display is handled by Actors
  }
}

