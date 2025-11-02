/**
 * Game State Manager
 * Manages game state using Torii queries and provides reactive updates
 */

import gameQueries from './gameQueries.js';
import torii from './torii.js';

class GameStateManager {
  constructor() {
    this.state = {
      player: null,
      session: null,
      profile: null,
      upgrades: null,
      world: null,
      assets: [],
      collectedAssets: [],
      subscriptions: [],
    };
    this.listeners = [];
  }

  /**
   * Initialize game state for a player
   */
  async initialize(playerAddress) {
    this.state.player = playerAddress;
    
    try {
      const gameState = await gameQueries.getPlayerGameState(playerAddress);
      
      this.state.session = gameState.session;
      this.state.profile = gameState.profile;
      this.state.upgrades = gameState.upgrades;

      if (gameState.hasActiveSession && gameState.session) {
        await this.loadSessionData(gameState.session);
      }

      this.notifyListeners();
      return this.state;
    } catch (error) {
      console.error('Error initializing game state:', error);
      throw error;
    }
  }

  /**
   * Load session-related data
   */
  async loadSessionData(session) {
    if (!session || !session.world_id) {
      return;
    }

    try {
      const [worldData, collected] = await Promise.all([
        gameQueries.getWorldWithAssets(session.world_id),
        torii.getCollectedAssets(this.state.player, session.session_id),
      ]);

      if (worldData) {
        this.state.world = worldData;
        this.state.assets = worldData.assets || [];
      }

      this.state.collectedAssets = collected || [];
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading session data:', error);
    }
  }

  /**
   * Start subscriptions for real-time updates
   */
  startSubscriptions() {
    if (!this.state.player) {
      return;
    }

    // Subscribe to active session updates
    const sessionUnsubscribe = torii.subscribeActiveSession(
      this.state.player,
      (session) => {
        this.state.session = session;
        if (session) {
          this.loadSessionData(session);
        }
        this.notifyListeners();
      }
    );

    // Subscribe to player profile updates
    const profileUnsubscribe = torii.subscribePlayerProfile(
      this.state.player,
      (profile) => {
        this.state.profile = profile;
        this.notifyListeners();
      }
    );

    this.state.subscriptions = [sessionUnsubscribe, profileUnsubscribe];
  }

  /**
   * Stop all subscriptions
   */
  stopSubscriptions() {
    this.state.subscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.state.subscriptions = [];
  }

  /**
   * Refresh game state
   */
  async refresh() {
    if (!this.state.player) {
      return;
    }

    await this.initialize(this.state.player);
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Add state change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Get assets at current player position
   */
  async getAssetsAtCurrentPosition() {
    if (!this.state.session || !this.state.session.is_active) {
      return [];
    }

    return await gameQueries.getAssetsAtPlayerPosition(this.state.player);
  }

  /**
   * Check if asset can be collected
   */
  async canCollectAsset(assetId) {
    return await gameQueries.canCollectAssetAtPosition(
      this.state.player,
      assetId
    );
  }

  /**
   * Get session time remaining
   */
  async getTimeRemaining() {
    return await gameQueries.getSessionTimeRemaining(this.state.player);
  }
}

// Export singleton instance
export default new GameStateManager();

