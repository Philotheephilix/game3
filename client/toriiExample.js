/**
 * Example: Using Torii for Game Queries
 * This demonstrates how to integrate Torii queries into your game client
 */

import torii from './torii.js';
import gameQueries from './gameQueries.js';
import gameState from './gameState.js';

// Example 1: Basic Torii Query
async function example1_BasicQuery() {
  const playerAddress = '0x123...'; // Replace with actual address
  
  // Get active session
  const session = await torii.getActiveSession(playerAddress);
  console.log('Active session:', session);
  
  // Get player profile
  const profile = await torii.getPlayerProfile(playerAddress);
  console.log('Player profile:', profile);
  
  // Get upgrades
  const upgrades = await torii.getPlayerUpgrades(playerAddress);
  console.log('Player upgrades:', upgrades);
}

// Example 2: Get World and Assets
async function example2_GetWorld() {
  const worldId = 1;
  
  const world = await torii.getWorld(worldId);
  console.log('World:', world);
  
  const assets = await torii.getWorldAssets(worldId);
  console.log('World assets:', assets);
  
  // Get asset at specific position
  const asset = await torii.getAssetAtPosition(worldId, 5, 5);
  console.log('Asset at (5,5):', asset);
}

// Example 3: Game State Manager
async function example3_GameStateManager() {
  const playerAddress = '0x123...';
  
  // Initialize game state
  await gameState.initialize(playerAddress);
  
  // Get current state
  const state = gameState.getState();
  console.log('Current game state:', state);
  
  // Listen to state changes
  const unsubscribe = gameState.addListener((newState) => {
    console.log('State updated:', newState);
    updateUI(newState);
  });
  
  // Start real-time subscriptions
  gameState.startSubscriptions();
  
  // Later, stop subscriptions
  // gameState.stopSubscriptions();
  // unsubscribe();
}

// Example 4: High-Level Game Queries
async function example4_GameQueries() {
  const playerAddress = '0x123...';
  
  // Get complete game state
  const gameState = await gameQueries.getPlayerGameState(playerAddress);
  console.log('Complete game state:', gameState);
  
  // Get world with assets
  const worldWithAssets = await gameQueries.getWorldWithAssets(1);
  console.log('World with assets:', worldWithAssets);
  
  // Check if can collect asset
  const canCollect = await gameQueries.canCollectAssetAtPosition(
    playerAddress,
    5 // asset_id
  );
  console.log('Can collect asset:', canCollect);
  
  // Get time remaining
  const timeRemaining = await gameQueries.getSessionTimeRemaining(playerAddress);
  console.log('Time remaining:', timeRemaining);
}

// Example 5: Real-time Updates
async function example5_RealTimeUpdates() {
  const playerAddress = '0x123...';
  
  // Subscribe to session updates
  const unsubscribeSession = torii.subscribeActiveSession(
    playerAddress,
    (session) => {
      if (session) {
        console.log('Session updated:', session);
        updateSessionUI(session);
      } else {
        console.log('No active session');
      }
    }
  );
  
  // Subscribe to profile updates
  const unsubscribeProfile = torii.subscribePlayerProfile(
    playerAddress,
    (profile) => {
      if (profile) {
        console.log('Profile updated:', profile);
        updateProfileUI(profile);
      }
    }
  );
  
  // Later, unsubscribe
  // unsubscribeSession();
  // unsubscribeProfile();
}

// Example 6: Batch Queries
async function example6_BatchQueries() {
  const playerAddress = '0x123...';
  
  // Fetch multiple things in parallel
  const [session, profile, upgrades, worlds] = await Promise.all([
    torii.getActiveSession(playerAddress),
    torii.getPlayerProfile(playerAddress),
    torii.getPlayerUpgrades(playerAddress),
    torii.getActiveWorlds(),
  ]);
  
  console.log('Session:', session);
  console.log('Profile:', profile);
  console.log('Upgrades:', upgrades);
  console.log('Active worlds:', worlds);
}

// Example 7: Custom GraphQL Query
async function example7_CustomQuery() {
  const query = `
    query GetPlayerStats($player: String!) {
      playerProfiles(where: { player: $player }, limit: 1) {
        edges {
          node {
            total_banked_loot
            successful_runs
            failed_runs
            current_streak
            best_streak
          }
        }
      }
      gameSessions(
        where: { player: $player, is_active: false }
        order_by: { start_block: DESC }
        limit: 10
      ) {
        edges {
          node {
            session_id
            world_id
            current_loot_value
            collected_asset_count
            has_returned_safely
            alarm_triggered
          }
        }
      }
    }
  `;
  
  const data = await torii.query(query, {
    player: '0x123...',
  });
  
  console.log('Player stats:', data);
}

// Example UI update functions (mock implementations)
function updateUI(state) {
  // Update your game UI with new state
  if (state.session) {
    document.getElementById('session-info').textContent = 
      `Session: ${state.session.session_id}`;
  }
  if (state.profile) {
    document.getElementById('loot-display').textContent = 
      `Total Loot: ${state.profile.total_banked_loot}`;
  }
}

function updateSessionUI(session) {
  // Update session-specific UI elements
  console.log('Updating session UI:', session);
}

function updateProfileUI(profile) {
  // Update profile-specific UI elements
  console.log('Updating profile UI:', profile);
}

// Export examples
export {
  example1_BasicQuery,
  example2_GetWorld,
  example3_GameStateManager,
  example4_GameQueries,
  example5_RealTimeUpdates,
  example6_BatchQueries,
  example7_CustomQuery,
};

