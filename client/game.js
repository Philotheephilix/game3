/**
 * Game logic.
 *
 * Updates the UI by parsing Torii responses.
 * Sends transactions to the chain using controller account.
 */

import { shortString } from 'starknet';

const NAMESPACE = 'di';
const POSITION_MODEL = 'Position';
const MOVES_MODEL = 'Moves';

const ACTIONS_CONTRACT = 'di-actions';
const WORLD_SYSTEM_CONTRACT = 'di-world_system';
const GAME_SYSTEM_CONTRACT = 'di-game_system';

function updateFromEntitiesData(entities) {
  entities.forEach((entity) => {
    updateFromEntityData(entity);
  });
}

function updateFromEntityData(entity) {
  if (entity.models) {
    if (entity.models[NAMESPACE][POSITION_MODEL]) {
      const position = entity.models[NAMESPACE][POSITION_MODEL];
      updatePositionDisplay(position.x, position.y);
    }

    if (entity.models[NAMESPACE][MOVES_MODEL]) {
      const moves = entity.models[NAMESPACE][MOVES_MODEL];
      updateMovesDisplay(moves.remaining);
    }
  }
}

function updatePositionDisplay(x, y) {
  const positionDisplay = document.getElementById('position-display');
  if (positionDisplay) {
    positionDisplay.textContent = `Position: (${x}, ${y})`;
  }
}

function updateMovesDisplay(remaining) {
  const movesDisplay = document.getElementById('moves-display');
  if (movesDisplay) {
    movesDisplay.textContent = `Moves remaining: ${remaining}`;
  }
}

function initGame(account, manifest, toriiClient) {
  document.getElementById('up-button').onclick = async () => {
    await move(account, manifest, 'up');
  };
  document.getElementById('right-button').onclick = async () => {
    await move(account, manifest, 'right');
  };
  document.getElementById('down-button').onclick = async () => {
    await move(account, manifest, 'down');
  };
  document.getElementById('left-button').onclick = async () => {
    await move(account, manifest, 'left');
  };
  document.getElementById('move-random-button').onclick = async () => {
    await moveRandom(account, manifest);
  };

  document.getElementById('spawn-button').onclick = async () => {
    await spawn(account, manifest);

    document.getElementById('up-button').disabled = false;
    document.getElementById('right-button').disabled = false;
    document.getElementById('down-button').disabled = false;
    document.getElementById('left-button').disabled = false;
    document.getElementById('move-random-button').disabled = false;
  };

  // Game system buttons
  document.getElementById('create-world-button').onclick = async () => {
    const worldId = document.getElementById('create-world-id-input').value;
    await createWorld(account, manifest, worldId);
  };

  document.getElementById('create-game-button').onclick = async () => {
    const worldId = document.getElementById('world-id-input').value;
    await createGame(account, manifest, worldId);
  };

  document.getElementById('join-game-button').onclick = async () => {
    const gameId = document.getElementById('join-game-id-input').value;
    await joinGame(account, manifest, gameId);
  };

  document.getElementById('start-game-button').onclick = async () => {
    const gameId = document.getElementById('start-game-id-input').value;
    await startGame(account, manifest, gameId);
  };

  document.getElementById('collect-asset-button').onclick = async () => {
    const gameId = document.getElementById('collect-game-id-input').value;
    const assetId = document.getElementById('asset-id-input').value;
    await collectAsset(account, manifest, gameId, assetId);
  };

  document.getElementById('enter-safe-area-button').onclick = async () => {
    const gameId = document.getElementById('safe-area-game-id-input').value;
    await enterSafeArea(account, manifest, gameId);
  };

  document.getElementById('move-player-button').onclick = async () => {
    const gameId = document.getElementById('move-game-id-input').value;
    const posX = document.getElementById('pos-x-input').value;
    const posY = document.getElementById('pos-y-input').value;
    await movePlayer(account, manifest, gameId, posX, posY);
  };

  document.getElementById('hit-button').onclick = async () => {
    const gameId = document.getElementById('hit-game-id-input').value;
    const participant = document.getElementById('participant-input').value;
    const amount = document.getElementById('hit-amount-input').value;
    await hit(account, manifest, gameId, participant, amount);
  };

  document.getElementById('end-game-button').onclick = async () => {
    const gameId = document.getElementById('end-game-id-input').value;
    await endGame(account, manifest, gameId);
  };

  // Torii query buttons
  document.getElementById('query-worlds-button').onclick = async () => {
    await queryWorldRegistries(toriiClient);
  };

  document.getElementById('query-games-button').onclick = async () => {
    await queryGames(toriiClient);
  };

  document.getElementById('query-collected-assets-button').onclick = async () => {
    const gameId = document.getElementById('query-game-id-input').value;
    await queryCollectedAssets(toriiClient, gameId);
  };

  document.getElementById('query-permanent-assets-button').onclick = async () => {
    const gameId = document.getElementById('query-permanent-game-id-input').value;
    await queryPermanentAssets(toriiClient, gameId);
  };

  document.getElementById('query-player-assets-button').onclick = async () => {
    const playerId = account.address;
    await queryPlayerAssets(toriiClient, playerId);
  };
}

// queryWorlds now queries WorldRegistry (backward compatibility)
async function queryWorlds(torii) {
  return await queryWorldRegistries(torii);
}

function displayQueryResult(data, error = null) {
  const resultDisplay = document.getElementById('torii-result-display');
  if (!resultDisplay) return;

  if (error) {
    resultDisplay.textContent = `Error: ${error}`;
    resultDisplay.style.color = '#f44336';
    return;
  }

  if (!data || data.length === 0) {
    resultDisplay.textContent = 'No worlds found';
    resultDisplay.style.color = '#666';
    return;
  }

  resultDisplay.style.color = '#000';
  resultDisplay.textContent = JSON.stringify(data, null, 2);
}

async function spawn(account, manifest) {
  const tx = await account.execute({
    contractAddress: manifest.contracts.find((contract) => contract.tag === ACTIONS_CONTRACT)
      .address,
    entrypoint: 'spawn',
    calldata: [],
  });

  console.log('Transaction sent:', tx);
}

async function move(account, manifest, direction) {
  let calldata;

  // Cairo serialization uses the variant index to determine the direction.
  // Refer to models.cairo in contracts folder.
  switch (direction) {
    case 'left':
      calldata = ['0'];
      break;
    case 'right':
      calldata = ['1'];
      break;
    case 'up':
      calldata = ['2'];
      break;
    case 'down':
      calldata = ['3'];
      break;
  }

  const tx = await account.execute({
    contractAddress: manifest.contracts.find((contract) => contract.tag === ACTIONS_CONTRACT)
      .address,
    entrypoint: 'move',
    calldata: calldata,
  });

  console.log('Transaction sent:', tx);
}

const VRF_PROVIDER_ADDRESS = '0x15f542e25a4ce31481f986888c179b6e57412be340b8095f72f75a328fbb27b';

// VRF -> we need to sandwitch the `consume_random` as defined here:
// https://docs.cartridge.gg/vrf/overview#executing-vrf-transactions
async function moveRandom(account, manifest) {
  let action_addr = manifest.contracts.find(
    (contract) => contract.tag === ACTIONS_CONTRACT,
  ).address;

  const tx = await account.execute([
    {
      contractAddress: VRF_PROVIDER_ADDRESS,
      entrypoint: 'request_random',
      calldata: [action_addr, '0', account.address],
    },
    {
      contractAddress: action_addr,
      entrypoint: 'move_random',
      calldata: [],
    },
  ]);

  console.log('Transaction sent:', tx);
}

// Helper function to wait for Torii sync
async function waitForToriiSync(maxRetries = 10, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:8080/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: '{ diWorldRegistryModels { edges { node { world_id } } } }' 
        }),
      });
      const result = await response.json();
      // If we get a valid response (even if empty), Torii is responding
      if (result.data !== undefined) {
        return true;
      }
    } catch (e) {
      // Torii not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

// Game System Functions
async function createWorld(account, manifest, worldId) {
  const calldata = [worldId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'create_world',
    calldata: calldata,
  });

  console.log('Create world transaction sent:', tx);
  console.log('⚠️ Note: Torii may take a few seconds to index. Wait 3-5 seconds then query again.');
  
  // Wait a bit for transaction to be included in a block
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function createGame(account, manifest, worldId) {
  const calldata = [worldId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'create_game',
    calldata: calldata,
  });

  console.log('Create game transaction sent:', tx);
  console.log('⚠️ Note: Torii may take a few seconds to index. Wait 3-5 seconds then query again.');
  
  // Wait a bit for transaction to be included in a block
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Note: In production, you'd parse the transaction receipt to get the game_id
}

async function joinGame(account, manifest, gameId) {
  const calldata = [gameId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'join_game',
    calldata: calldata,
  });

  console.log('Join game transaction sent:', tx);
}

async function startGame(account, manifest, gameId) {
  const calldata = [gameId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'start_game',
    calldata: calldata,
  });

  console.log('Start game transaction sent:', tx);
}

async function collectAsset(account, manifest, gameId, assetId) {
  const calldata = [gameId, assetId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'collect_asset',
    calldata: calldata,
  });

  console.log('Collect asset transaction sent:', tx);
  // Small delay to allow block inclusion
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function enterSafeArea(account, manifest, gameId) {
  const calldata = [gameId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'enter_safe_area',
    calldata: calldata,
  });

  console.log('Enter safe area transaction sent:', tx);
}

async function movePlayer(account, manifest, gameId, posX, posY) {
  const calldata = [gameId, posX, posY];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'move_player',
    calldata: calldata,
  });

  console.log('Move player transaction sent:', tx);
}

async function hit(account, manifest, gameId, participant, amount) {
  const calldata = [gameId, participant, amount];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'hit',
    calldata: calldata,
  });

  console.log('Hit transaction sent:', tx);
}

async function endGame(account, manifest, gameId) {
  const calldata = [gameId];

  const tx = await account.execute({
    contractAddress: manifest.contracts.find(
      (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
    ).address,
    entrypoint: 'end_game',
    calldata: calldata,
  });

  console.log('End game transaction sent:', tx);
}

// Torii Query Functions
async function queryWorldRegistries(torii) {
  try {
    const query = `
      query GetWorldRegistries {
        diWorldRegistryModels {
          edges {
            node {
              world_id
              game_count
              creator
            }
          }
        }
      }
    `;

    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data || !result.data.diWorldRegistryModels) {
      console.error('Unexpected response structure:', result);
      throw new Error('Invalid response structure from Torii');
    }

    const worlds = result.data.diWorldRegistryModels.edges.map(edge => edge.node);
    
    if (worlds.length === 0) {
      console.warn('⚠️ No worlds found in Torii. This could mean:');
      console.warn('  1. Torii hasn\'t synced yet - wait 3-5 seconds after creating worlds');
      console.warn('  2. Torii needs restart after contract changes:');
      console.warn('     cd contracts && ./stop-torii.sh && ./start-torii.sh');
      console.warn('  3. Contracts need redeployment: cd contracts && sozo build && sozo migrate');
    }
    
    displayQueryResult(worlds);
    
    console.log('World registries queried:', worlds);
    console.log('Total worlds found:', worlds.length);
    return worlds;
  } catch (error) {
    console.error('Query error:', error);
    displayQueryResult(null, error.message);
    throw error;
  }
}

async function queryGames(torii) {
  try {
    const query = `
      query GetGames {
        diGameModels {
          edges {
            node {
              game_id
              status
              world_id
              participant_a
              participant_b
              position_a_x
              position_a_y
              position_b_x
              position_b_y
              hp_a
              hp_b
              alive_a
              alive_b
            }
          }
        }
      }
    `;

    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    const games = result.data.diGameModels.edges.map(edge => edge.node);
    
    if (games.length === 0) {
      console.warn('⚠️ No games found in Torii. This could mean:');
      console.warn('  1. Torii hasn\'t synced yet - wait 3-5 seconds after creating games');
      console.warn('  2. Torii needs restart: cd contracts && ./stop-torii.sh && ./start-torii.sh');
    }
    
    displayQueryResult(games);
    
    console.log('Games queried:', games);
    console.log('Total games found:', games.length);
    return games;
  } catch (error) {
    console.error('Query error:', error);
    displayQueryResult(null, error.message);
    throw error;
  }
}

async function queryCollectedAssets(torii, gameId) {
  try {
    // Query all collected assets, then filter client-side
    // Torii where clauses can be finicky, so we fetch all and filter
    const query = `
      query GetCollectedAssets {
        diCollectedAssetModels {
          edges {
            node {
              game_id
              asset_id
              collection_index
              participant
            }
          }
        }
      }
    `;

    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    // Filter by game_id and exclude deleted markers (participant == 255)
    const gameIdStr = String(gameId);
    const allAssets = result.data.diCollectedAssetModels.edges.map(edge => edge.node);
    const assets = allAssets.filter(asset => 
      String(asset.game_id) === gameIdStr && asset.participant !== 255
    );
    
    // Group by asset_id and count
    const assetCounts = {};
    assets.forEach(asset => {
      if (!assetCounts[asset.asset_id]) {
        assetCounts[asset.asset_id] = { asset_id: asset.asset_id, participant_0: 0, participant_1: 0 };
      }
      if (asset.participant === 0 || asset.participant === '0') {
        assetCounts[asset.asset_id].participant_0++;
      } else if (asset.participant === 1 || asset.participant === '1') {
        assetCounts[asset.asset_id].participant_1++;
      }
    });

    const summary = {
      total: assets.length,
      by_asset: Object.values(assetCounts),
      all_assets: assets // Include raw data for debugging
    };

    displayQueryResult(summary);
    
    console.log('Collected assets queried:', summary);
    console.log('All collected assets (before filter):', allAssets.length);
    
    if (allAssets.length === 0) {
      console.warn('⚠️ Torii returned no collected assets. This could mean:');
      console.warn('  1. Torii hasn\'t indexed the transactions yet - wait 3-5 seconds');
      console.warn('  2. Torii needs restart: cd contracts && ./stop-torii.sh && ./start-torii.sh');
      console.warn('  3. Check if collect_asset was called with valid game_id');
    } else if (assets.length === 0 && allAssets.length > 0) {
      console.warn('⚠️ Assets found but filtered out - check game_id:', gameId);
    }
    
    return assets;
  } catch (error) {
    console.error('Query error:', error);
    displayQueryResult(null, error.message);
    throw error;
  }
}

async function queryPermanentAssets(torii, gameId) {
  try {
    // Query all permanent assets, then filter client-side
    const query = `
      query GetPermanentAssets {
        diPermanentAssetModels {
          edges {
            node {
              game_id
              asset_id
              permanent_index
              participant
            }
          }
        }
      }
    `;

    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    // Filter by game_id
    const gameIdStr = String(gameId);
    const allAssets = result.data.diPermanentAssetModels.edges.map(edge => edge.node);
    const assets = allAssets.filter(asset => String(asset.game_id) === gameIdStr);
    
    // Group by asset_id and count
    const assetCounts = {};
    assets.forEach(asset => {
      if (!assetCounts[asset.asset_id]) {
        assetCounts[asset.asset_id] = { asset_id: asset.asset_id, participant_0: 0, participant_1: 0 };
      }
      if (asset.participant === 0 || asset.participant === '0') {
        assetCounts[asset.asset_id].participant_0++;
      } else if (asset.participant === 1 || asset.participant === '1') {
        assetCounts[asset.asset_id].participant_1++;
      }
    });

    const summary = {
      total: assets.length,
      by_asset: Object.values(assetCounts),
      all_assets: assets // Include raw data for debugging
    };

    displayQueryResult(summary);
    
    console.log('Permanent assets queried:', summary);
    console.log('All permanent assets (before filter):', allAssets.length);
    return assets;
  } catch (error) {
    console.error('Query error:', error);
    displayQueryResult(null, error.message);
    throw error;
  }
}

async function queryPlayerAssets(torii, playerId) {
  try {
    const query = `
      query GetPlayerAssets($playerId: String!) {
        diPlayerAssetModels(where: { player_id: $playerId }) {
          edges {
            node {
              player_id
              asset_id
              amount
            }
          }
        }
      }
    `;

    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        variables: { playerId }
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    const assets = result.data.diPlayerAssetModels.edges.map(edge => edge.node);
    
    const totalValue = assets.reduce((sum, asset) => sum + parseInt(asset.amount), 0);
    const summary = {
      player_id: playerId,
      total_assets: assets.length,
      total_amount: totalValue,
      assets: assets
    };

    displayQueryResult(summary);
    
    console.log('Player assets queried:', summary);
    return assets;
  } catch (error) {
    console.error('Query error:', error);
    displayQueryResult(null, error.message);
    throw error;
  }
}

export { initGame, updateFromEntitiesData, queryWorlds };
