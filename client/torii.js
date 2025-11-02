/**
 * Torii GraphQL Client for Dojo Heist Game
 * Provides efficient queries for game data using Torii indexer
 */

const TORII_URL = 'http://localhost:8080/graphql';
const NAMESPACE = 'di';

class ToriiClient {
  constructor(url = TORII_URL) {
    this.url = url;
  }

  /**
   * Execute a GraphQL query
   */
  async query(query, variables = {}) {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result.data;
    } catch (error) {
      console.error('Torii query error:', error);
      throw error;
    }
  }

  /**
   * Get active game session for a player
   */
  async getActiveSession(playerAddress) {
    const query = `
      query GetActiveSession($player: String!) {
        gameSessions(
          where: { player: $player, is_active: true },
          limit: 1
        ) {
          edges {
            node {
              session_id
              world_id
              start_block
              end_block
              current_loot_value
              collected_asset_count
              player_x
              player_y
              health
              is_active
              has_returned_safely
              alarm_triggered
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { player: playerAddress });
    const edges = data?.gameSessions?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Get player profile
   */
  async getPlayerProfile(playerAddress) {
    const query = `
      query GetPlayerProfile($player: String!) {
        playerProfiles(
          where: { player: $player },
          limit: 1
        ) {
          edges {
            node {
              player
              total_banked_loot
              lifetime_collected
              total_runs
              successful_runs
              failed_runs
              current_streak
              best_streak
              joined_at
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { player: playerAddress });
    const edges = data?.playerProfiles?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Get player upgrades
   */
  async getPlayerUpgrades(playerAddress) {
    const query = `
      query GetPlayerUpgrades($player: String!) {
        playerUpgrades(
          where: { player: $player },
          limit: 1
        ) {
          edges {
            node {
              player
              speed_level
              stealth_level
              detector_level
              health_level
              time_extension_level
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { player: playerAddress });
    const edges = data?.playerUpgrades?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Get world details
   */
  async getWorld(worldId) {
    const query = `
      query GetWorld($worldId: Int!) {
        worlds(
          where: { world_id: $worldId },
          limit: 1
        ) {
          edges {
            node {
              world_id
              name
              asset_count
              grid_width
              grid_height
              difficulty
              time_limit_blocks
              safe_zone_x
              safe_zone_y
              is_active
              created_at
              created_by
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { worldId });
    const edges = data?.worlds?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Get all active worlds
   */
  async getActiveWorlds() {
    const query = `
      query GetActiveWorlds {
        worlds(
          where: { is_active: true }
        ) {
          edges {
            node {
              world_id
              name
              asset_count
              grid_width
              grid_height
              difficulty
              time_limit_blocks
              safe_zone_x
              safe_zone_y
            }
          }
        }
      }
    `;
    
    const data = await this.query(query);
    const edges = data?.worlds?.edges || [];
    return edges.map(e => e.node);
  }

  /**
   * Get all assets in a world
   */
  async getWorldAssets(worldId) {
    const query = `
      query GetWorldAssets($worldId: Int!) {
        worldAssets(
          where: { world_id: $worldId }
        ) {
          edges {
            node {
              world_id
              asset_id
              position_x
              position_y
              value
              asset_type
              danger_level
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { worldId });
    const edges = data?.worldAssets?.edges || [];
    return edges.map(e => e.node);
  }

  /**
   * Get asset at specific position
   */
  async getAssetAtPosition(worldId, x, y) {
    const query = `
      query GetAssetAtPosition($worldId: Int!, $positionX: Int!, $positionY: Int!) {
        worldAssets(
          where: {
            world_id: $worldId,
            position_x: $positionX,
            position_y: $positionY
          },
          limit: 1
        ) {
          edges {
            node {
              asset_id
              value
              asset_type
              danger_level
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { 
      worldId, 
      positionX: x, 
      positionY: y 
    });
    const edges = data?.worldAssets?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Get collected assets for a session
   */
  async getCollectedAssets(playerAddress, sessionId) {
    const query = `
      query GetCollectedAssets($player: String!, $sessionId: String!) {
        sessionAssetCollections(
          where: {
            player: $player,
            session_id: $sessionId
          }
        ) {
          edges {
            node {
              player
              session_id
              asset_id
              collected_at_block
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { 
      player: playerAddress, 
      sessionId: sessionId.toString() 
    });
    const edges = data?.sessionAssetCollections?.edges || [];
    return edges.map(e => e.node);
  }

  /**
   * Get all game sessions for a player
   */
  async getPlayerSessions(playerAddress) {
    const query = `
      query GetPlayerSessions($player: String!) {
        gameSessions(
          where: { player: $player },
          order_by: { start_block: DESC }
        ) {
          edges {
            node {
              session_id
              world_id
              start_block
              end_block
              current_loot_value
              collected_asset_count
              is_active
              has_returned_safely
              alarm_triggered
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { player: playerAddress });
    const edges = data?.gameSessions?.edges || [];
    return edges.map(e => e.node);
  }

  /**
   * Get world registry (admin info)
   */
  async getWorldRegistry() {
    const query = `
      query GetWorldRegistry {
        worldRegistries(
          where: { registry_id: 0 },
          limit: 1
        ) {
          edges {
            node {
              registry_id
              total_worlds
              admin
            }
          }
        }
      }
    `;
    
    const data = await this.query(query);
    const edges = data?.worldRegistries?.edges || [];
    return edges.length > 0 ? edges[0].node : null;
  }

  /**
   * Subscribe to active session updates (using GraphQL subscriptions)
   * Note: Requires WebSocket connection
   */
  subscribeActiveSession(playerAddress, callback) {
    // For WebSocket subscriptions, you would use a WebSocket client
    // This is a simplified polling version
    let intervalId;
    
    const poll = async () => {
      try {
        const session = await this.getActiveSession(playerAddress);
        callback(session);
      } catch (error) {
        console.error('Subscription poll error:', error);
      }
    };

    // Poll every 2 seconds
    intervalId = setInterval(poll, 2000);
    poll(); // Initial fetch

    // Return unsubscribe function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }

  /**
   * Subscribe to player profile updates
   */
  subscribePlayerProfile(playerAddress, callback) {
    let intervalId;
    
    const poll = async () => {
      try {
        const profile = await this.getPlayerProfile(playerAddress);
        callback(profile);
      } catch (error) {
        console.error('Subscription poll error:', error);
      }
    };

    intervalId = setInterval(poll, 2000);
    poll();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }
}

// Export singleton instance
const torii = new ToriiClient();

export default torii;
export { ToriiClient };

