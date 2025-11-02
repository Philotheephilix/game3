/**
 * Game-specific query helpers using Torii
 * Provides high-level game state queries
 */

import torii from './torii.js';

class GameQueries {
  /**
   * Get complete game state for a player
   */
  async getPlayerGameState(playerAddress) {
    try {
      const [session, profile, upgrades] = await Promise.all([
        torii.getActiveSession(playerAddress),
        torii.getPlayerProfile(playerAddress),
        torii.getPlayerUpgrades(playerAddress),
      ]);

      return {
        session,
        profile,
        upgrades: upgrades || {
          speed_level: 0,
          stealth_level: 0,
          detector_level: 0,
          health_level: 0,
          time_extension_level: 0,
        },
        hasActiveSession: session !== null && session.is_active,
      };
    } catch (error) {
      console.error('Error fetching player game state:', error);
      throw error;
    }
  }

  /**
   * Get world with all assets
   */
  async getWorldWithAssets(worldId) {
    try {
      const [world, assets] = await Promise.all([
        torii.getWorld(worldId),
        torii.getWorldAssets(worldId),
      ]);

      if (!world) {
        return null;
      }

      return {
        ...world,
        assets: assets || [],
      };
    } catch (error) {
      console.error('Error fetching world with assets:', error);
      throw error;
    }
  }

  /**
   * Get session with collected assets
   */
  async getSessionWithCollections(playerAddress, sessionId) {
    try {
      const [session, collected] = await Promise.all([
        torii.getActiveSession(playerAddress),
        torii.getCollectedAssets(playerAddress, sessionId),
      ]);

      if (!session || session.session_id !== sessionId) {
        return null;
      }

      return {
        ...session,
        collectedAssets: collected || [],
        collectedAssetIds: (collected || []).map(c => c.asset_id),
      };
    } catch (error) {
      console.error('Error fetching session with collections:', error);
      throw error;
    }
  }

  /**
   * Get assets at player's current position
   */
  async getAssetsAtPlayerPosition(playerAddress) {
    try {
      const session = await torii.getActiveSession(playerAddress);
      
      if (!session || !session.is_active) {
        return [];
      }

      const asset = await torii.getAssetAtPosition(
        session.world_id,
        session.player_x,
        session.player_y
      );

      return asset ? [asset] : [];
    } catch (error) {
      console.error('Error fetching assets at player position:', error);
      return [];
    }
  }

  /**
   * Check if player can collect asset at current position
   */
  async canCollectAssetAtPosition(playerAddress, assetId) {
    try {
      const session = await torii.getActiveSession(playerAddress);
      
      if (!session || !session.is_active) {
        return false;
      }

      const asset = await torii.getAssetAtPosition(
        session.world_id,
        session.player_x,
        session.player_y
      );

      if (!asset || asset.asset_id !== assetId) {
        return false;
      }

      // Check if already collected
      const collected = await torii.getCollectedAssets(
        playerAddress,
        session.session_id
      );

      const isCollected = collected.some(c => c.asset_id === assetId);
      return !isCollected;
    } catch (error) {
      console.error('Error checking if can collect asset:', error);
      return false;
    }
  }

  /**
   * Get leaderboard data (top players by total_banked_loot)
   */
  async getLeaderboard(limit = 10) {
    try {
      // Note: Torii doesn't support ordering by fields directly in all cases
      // This would require a custom query or post-processing
      const query = `
        query GetLeaderboard {
          playerProfiles(
            order_by: { total_banked_loot: DESC }
            limit: ${limit}
          ) {
            edges {
              node {
                player
                total_banked_loot
                successful_runs
                failed_runs
                current_streak
                best_streak
              }
            }
          }
        }
      `;

      const data = await torii.query(query);
      const edges = data?.playerProfiles?.edges || [];
      return edges.map(e => e.node);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Get game statistics
   */
  async getGameStats() {
    try {
      const [registry, worlds] = await Promise.all([
        torii.getWorldRegistry(),
        torii.getActiveWorlds(),
      ]);

      return {
        totalWorlds: registry?.total_worlds || 0,
        activeWorlds: worlds.length,
        worlds: worlds.map(w => ({
          id: w.world_id,
          name: w.name,
          difficulty: w.difficulty,
          assetCount: w.asset_count,
        })),
      };
    } catch (error) {
      console.error('Error fetching game stats:', error);
      throw error;
    }
  }

  /**
   * Calculate time remaining for active session
   */
  async getSessionTimeRemaining(playerAddress) {
    try {
      const session = await torii.getActiveSession(playerAddress);
      
      if (!session || !session.is_active) {
        return null;
      }

      // Get current block (this would typically come from RPC)
      // For now, estimate based on timestamp difference
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(session.start_block) || currentTime;
      const timeLimit = parseInt(session.time_limit_blocks) || 0;
      
      // Assuming ~1 block per second (adjust based on network)
      const blocksPerSecond = 1;
      const elapsedBlocks = Math.floor((currentTime - startTime) * blocksPerSecond);
      const remainingBlocks = Math.max(0, timeLimit - elapsedBlocks);
      
      return {
        remainingBlocks,
        remainingSeconds: Math.floor(remainingBlocks / blocksPerSecond),
        isExpired: remainingBlocks === 0,
      };
    } catch (error) {
      console.error('Error calculating time remaining:', error);
      return null;
    }
  }
}

export default new GameQueries();

