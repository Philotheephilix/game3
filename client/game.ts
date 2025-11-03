/**
 * Game logic.
 *
 * Updates the UI by parsing Torii responses.
 * Sends transactions to the chain using controller account.
 */

// Starknet types available if needed

interface Manifest {
  contracts: Array<{
    tag: string;
    address: string;
  }>;
  world?: {
    address: string;
  };
}

interface Entity {
  models?: {
    [namespace: string]: {
      [model: string]: any;
    };
  };
}

interface ToriiClient {
  subscribeEntityQuery: (options: {
    query: any;
    callback: (data: { data?: Entity[]; error?: any }) => void;
  }) => Promise<[any, { cancel: () => void }]>;
}

interface Account {
  address: string;
  execute: (tx: any) => Promise<any>;
}

interface GraphQLResponse {
  data?: {
    diWorldRegistryModels?: {
      edges: Array<{
        node: {
          world_id: string;
          game_count?: number;
          creator?: string;
        };
      }>;
    };
    diGameModels?: {
      edges: Array<{
        node: {
          game_id: string;
          status: string;
          world_id: string;
          participant_a: string;
          participant_b: string;
          position_a_x: number;
          position_a_y: number;
          position_b_x: number;
          position_b_y: number;
          hp_a: number;
          hp_b: number;
          alive_a: boolean;
          alive_b: boolean;
        };
      }>;
    };
    diCollectedAssetModels?: {
      edges: Array<{
        node: {
          game_id: string;
          asset_id: string;
          collection_index: number;
          participant: number | string;
        };
      }>;
    };
    diPermanentAssetModels?: {
      edges: Array<{
        node: {
          game_id: string;
          asset_id: string;
          permanent_index: number;
          participant: number | string;
        };
      }>;
    };
    diPlayerAssetModels?: {
      edges: Array<{
        node: {
          player_id: string;
          asset_id: string;
          amount: string;
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

const NAMESPACE = 'di';
const POSITION_MODEL = 'Position';
const MOVES_MODEL = 'Moves';

const ACTIONS_CONTRACT = 'di-actions';
const GAME_SYSTEM_CONTRACT = 'di-game_system';

function updateFromEntitiesData(entities: Entity[]): void {
  entities.forEach((entity) => {
    updateFromEntityData(entity);
  });
}

function updateFromEntityData(entity: Entity): void {
  if (entity.models) {
    if (entity.models[NAMESPACE]?.[POSITION_MODEL]) {
      const position = entity.models[NAMESPACE][POSITION_MODEL];
      updatePositionDisplay(position.x, position.y);
    }

    if (entity.models[NAMESPACE]?.[MOVES_MODEL]) {
      const moves = entity.models[NAMESPACE][MOVES_MODEL];
      updateMovesDisplay(moves.remaining);
    }
  }
}

function updatePositionDisplay(x: number, y: number): void {
  const positionDisplay = document.getElementById('position-display');
  if (positionDisplay) {
    positionDisplay.textContent = `Position: (${x}, ${y})`;
  }
}

function updateMovesDisplay(remaining: number): void {
  const movesDisplay = document.getElementById('moves-display');
  if (movesDisplay) {
    movesDisplay.textContent = `Moves remaining: ${remaining}`;
  }
}

function initGame(account: Account, manifest: Manifest, toriiClient: ToriiClient): void {
  const upButton = document.getElementById('up-button');
  const rightButton = document.getElementById('right-button');
  const downButton = document.getElementById('down-button');
  const leftButton = document.getElementById('left-button');
  const moveRandomButton = document.getElementById('move-random-button');
  const spawnButton = document.getElementById('spawn-button');
  const createWorldButton = document.getElementById('create-world-button');
  const createGameButton = document.getElementById('create-game-button');
  const joinGameButton = document.getElementById('join-game-button');
  const startGameButton = document.getElementById('start-game-button');
  const collectAssetButton = document.getElementById('collect-asset-button');
  const enterSafeAreaButton = document.getElementById('enter-safe-area-button');
  const movePlayerButton = document.getElementById('move-player-button');
  const hitButton = document.getElementById('hit-button');
  const endGameButton = document.getElementById('end-game-button');
  const queryWorldsButton = document.getElementById('query-worlds-button');
  const queryGamesButton = document.getElementById('query-games-button');
  const queryCollectedAssetsButton = document.getElementById('query-collected-assets-button');
  const queryPermanentAssetsButton = document.getElementById('query-permanent-assets-button');
  const queryPlayerAssetsButton = document.getElementById('query-player-assets-button');

  if (upButton) {
    upButton.onclick = async () => {
      await move(account, manifest, 'up');
    };
  }
  if (rightButton) {
    rightButton.onclick = async () => {
      await move(account, manifest, 'right');
    };
  }
  if (downButton) {
    downButton.onclick = async () => {
      await move(account, manifest, 'down');
    };
  }
  if (leftButton) {
    leftButton.onclick = async () => {
      await move(account, manifest, 'left');
    };
  }
  if (moveRandomButton) {
    moveRandomButton.onclick = async () => {
      await moveRandom(account, manifest);
    };
  }

  if (spawnButton) {
    spawnButton.onclick = async () => {
      await spawn(account, manifest);

      if (upButton && upButton instanceof HTMLButtonElement) upButton.disabled = false;
      if (rightButton && rightButton instanceof HTMLButtonElement) rightButton.disabled = false;
      if (downButton && downButton instanceof HTMLButtonElement) downButton.disabled = false;
      if (leftButton && leftButton instanceof HTMLButtonElement) leftButton.disabled = false;
      if (moveRandomButton && moveRandomButton instanceof HTMLButtonElement) moveRandomButton.disabled = false;
    };
  }

  // Game system buttons
  if (createWorldButton) {
    createWorldButton.onclick = async () => {
      const worldIdInput = document.getElementById('create-world-id-input') as HTMLInputElement;
      const worldId = worldIdInput?.value;
      if (worldId) {
        await createWorld(account, manifest, worldId);
      }
    };
  }

  if (createGameButton) {
    createGameButton.onclick = async () => {
      const worldIdInput = document.getElementById('world-id-input') as HTMLInputElement;
      const worldId = worldIdInput?.value;
      if (worldId) {
        await createGame(account, manifest, worldId);
      }
    };
  }

  if (joinGameButton) {
    joinGameButton.onclick = async () => {
      const gameIdInput = document.getElementById('join-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await joinGame(account, manifest, gameId);
      }
    };
  }

  if (startGameButton) {
    startGameButton.onclick = async () => {
      const gameIdInput = document.getElementById('start-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await startGame(account, manifest, gameId);
      }
    };
  }

  if (collectAssetButton) {
    collectAssetButton.onclick = async () => {
      const gameIdInput = document.getElementById('collect-game-id-input') as HTMLInputElement;
      const assetIdInput = document.getElementById('asset-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      const assetId = assetIdInput?.value;
      if (gameId && assetId) {
        await collectAsset(account, manifest, gameId, assetId);
      }
    };
  }

  if (enterSafeAreaButton) {
    enterSafeAreaButton.onclick = async () => {
      const gameIdInput = document.getElementById('safe-area-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await enterSafeArea(account, manifest, gameId);
      }
    };
  }

  if (movePlayerButton) {
    movePlayerButton.onclick = async () => {
      const gameIdInput = document.getElementById('move-game-id-input') as HTMLInputElement;
      const posXInput = document.getElementById('pos-x-input') as HTMLInputElement;
      const posYInput = document.getElementById('pos-y-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      const posX = posXInput?.value;
      const posY = posYInput?.value;
      if (gameId && posX && posY) {
        await movePlayer(account, manifest, gameId, posX, posY);
      }
    };
  }

  if (hitButton) {
    hitButton.onclick = async () => {
      const gameIdInput = document.getElementById('hit-game-id-input') as HTMLInputElement;
      const participantInput = document.getElementById('participant-input') as HTMLInputElement;
      const amountInput = document.getElementById('hit-amount-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      const participant = participantInput?.value;
      const amount = amountInput?.value;
      if (gameId && participant && amount) {
        await hit(account, manifest, gameId, participant, amount);
      }
    };
  }

  if (endGameButton) {
    endGameButton.onclick = async () => {
      const gameIdInput = document.getElementById('end-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await endGame(account, manifest, gameId);
      }
    };
  }

  // Torii query buttons
  if (queryWorldsButton) {
    queryWorldsButton.onclick = async () => {
      await queryWorldRegistries(toriiClient);
    };
  }

  if (queryGamesButton) {
    queryGamesButton.onclick = async () => {
      await queryGames(toriiClient);
    };
  }

  if (queryCollectedAssetsButton) {
    queryCollectedAssetsButton.onclick = async () => {
      const gameIdInput = document.getElementById('query-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await queryCollectedAssets(toriiClient, gameId);
      }
    };
  }

  if (queryPermanentAssetsButton) {
    queryPermanentAssetsButton.onclick = async () => {
      const gameIdInput = document.getElementById('query-permanent-game-id-input') as HTMLInputElement;
      const gameId = gameIdInput?.value;
      if (gameId) {
        await queryPermanentAssets(toriiClient, gameId);
      }
    };
  }

  if (queryPlayerAssetsButton) {
    queryPlayerAssetsButton.onclick = async () => {
      const playerId = account.address;
      await queryPlayerAssets(toriiClient, playerId);
    };
  }
}

// queryWorlds now queries WorldRegistry (backward compatibility)
async function queryWorlds(torii: ToriiClient): Promise<any> {
  return await queryWorldRegistries(torii);
}

function displayQueryResult(data: any, error: string | null = null): void {
  const resultDisplay = document.getElementById('torii-result-display');
  if (!resultDisplay) return;

  if (error) {
    resultDisplay.textContent = `Error: ${error}`;
    resultDisplay.style.color = '#f44336';
    return;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    resultDisplay.textContent = 'No worlds found';
    resultDisplay.style.color = '#666';
    return;
  }

  resultDisplay.style.color = '#000';
  resultDisplay.textContent = JSON.stringify(data, null, 2);
}

async function spawn(account: Account, manifest: Manifest): Promise<void> {
  const actionsContract = manifest.contracts.find((contract) => contract.tag === ACTIONS_CONTRACT);
  if (!actionsContract) {
    throw new Error('Actions contract not found');
  }

  const tx = await account.execute({
    contractAddress: actionsContract.address,
    entrypoint: 'spawn',
    calldata: [],
  });

  console.log('Transaction sent:', tx);
}

type Direction = 'left' | 'right' | 'up' | 'down';

async function move(account: Account, manifest: Manifest, direction: Direction): Promise<void> {
  let calldata: string[];

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

  const actionsContract = manifest.contracts.find((contract) => contract.tag === ACTIONS_CONTRACT);
  if (!actionsContract) {
    throw new Error('Actions contract not found');
  }

  const tx = await account.execute({
    contractAddress: actionsContract.address,
    entrypoint: 'move',
    calldata: calldata,
  });

  console.log('Transaction sent:', tx);
}

const VRF_PROVIDER_ADDRESS = '0x15f542e25a4ce31481f986888c179b6e57412be340b8095f72f75a328fbb27b';

// VRF -> we need to sandwitch the `consume_random` as defined here:
// https://docs.cartridge.gg/vrf/overview#executing-vrf-transactions
async function moveRandom(account: Account, manifest: Manifest): Promise<void> {
  const actionsContract = manifest.contracts.find(
    (contract) => contract.tag === ACTIONS_CONTRACT,
  );
  if (!actionsContract) {
    throw new Error('Actions contract not found');
  }

  const action_addr = actionsContract.address;

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

// Game System Functions
async function createWorld(account: Account, manifest: Manifest, worldId: string): Promise<void> {
  const calldata = [worldId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'create_world',
    calldata: calldata,
  });

  console.log('Create world transaction sent:', tx);
  console.log('⚠️ Note: Torii may take a few seconds to index. Wait 3-5 seconds then query again.');
  
  // Wait a bit for transaction to be included in a block
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function createGame(account: Account, manifest: Manifest, worldId: string): Promise<void> {
  const calldata = [worldId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'create_game',
    calldata: calldata,
  });

  console.log('Create game transaction sent:', tx);
  console.log('⚠️ Note: Torii may take a few seconds to index. Wait 3-5 seconds then query again.');
  
  // Wait a bit for transaction to be included in a block
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Note: In production, you'd parse the transaction receipt to get the game_id
}

async function joinGame(account: Account, manifest: Manifest, gameId: string): Promise<void> {
  const calldata = [gameId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'join_game',
    calldata: calldata,
  });

  console.log('Join game transaction sent:', tx);
}

async function startGame(account: Account, manifest: Manifest, gameId: string): Promise<void> {
  const calldata = [gameId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'start_game',
    calldata: calldata,
  });

  console.log('Start game transaction sent:', tx);
}

async function collectAsset(account: Account, manifest: Manifest, gameId: string, assetId: string): Promise<void> {
  const calldata = [gameId, assetId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'collect_asset',
    calldata: calldata,
  });

  console.log('Collect asset transaction sent:', tx);
  // Small delay to allow block inclusion
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function enterSafeArea(account: Account, manifest: Manifest, gameId: string): Promise<void> {
  const calldata = [gameId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'enter_safe_area',
    calldata: calldata,
  });

  console.log('Enter safe area transaction sent:', tx);
}

async function movePlayer(account: Account, manifest: Manifest, gameId: string, posX: string, posY: string): Promise<void> {
  const calldata = [gameId, posX, posY];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'move_player',
    calldata: calldata,
  });

  console.log('Move player transaction sent:', tx);
}

async function hit(account: Account, manifest: Manifest, gameId: string, participant: string, amount: string): Promise<void> {
  const calldata = [gameId, participant, amount];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }

  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'hit',
    calldata: calldata,
  });

  console.log('Hit transaction sent:', tx);
}

async function endGame(account: Account, manifest: Manifest, gameId: string): Promise<void> {
  const calldata = [gameId];

  const gameSystemContract = manifest.contracts.find(
    (contract) => contract.tag === GAME_SYSTEM_CONTRACT,
  );
  if (!gameSystemContract) {
    throw new Error('Game system contract not found');
  }
  console.log(calldata)
  const tx = await account.execute({
    contractAddress: gameSystemContract.address,
    entrypoint: 'end_game',
    calldata: calldata,
  });

  console.log('End game transaction sent:', tx);
}

// Torii Query Functions
async function queryWorldRegistries(_torii: ToriiClient): Promise<any> {
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

    const response = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result: GraphQLResponse = await response.json();
    
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    displayQueryResult(null, errorMessage);
    throw error;
  }
}

async function queryGames(_torii: ToriiClient): Promise<any> {
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

    const response = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result: GraphQLResponse = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data || !result.data.diGameModels) {
      throw new Error('Invalid response structure from Torii');
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    displayQueryResult(null, errorMessage);
    throw error;
  }
}

async function queryCollectedAssets(_torii: ToriiClient, gameId: string): Promise<any> {
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

    const response = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result: GraphQLResponse = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data || !result.data.diCollectedAssetModels) {
      throw new Error('Invalid response structure from Torii');
    }

    // Filter by game_id and exclude deleted markers (participant == 255)
    const gameIdStr = String(gameId);
    const allAssets = result.data.diCollectedAssetModels.edges.map(edge => edge.node);
    const assets = allAssets.filter(asset => 
      String(asset.game_id) === gameIdStr && asset.participant !== 255
    );
    
    // Group by asset_id and count
    interface AssetCount {
      asset_id: string;
      participant_0: number;
      participant_1: number;
    }
    
    const assetCounts: Record<string, AssetCount> = {};
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    displayQueryResult(null, errorMessage);
    throw error;
  }
}

async function queryPermanentAssets(_torii: ToriiClient, gameId: string): Promise<any> {
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

    const response = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result: GraphQLResponse = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data || !result.data.diPermanentAssetModels) {
      throw new Error('Invalid response structure from Torii');
    }

    // Filter by game_id
    const gameIdStr = String(gameId);
    const allAssets = result.data.diPermanentAssetModels.edges.map(edge => edge.node);
    const assets = allAssets.filter(asset => String(asset.game_id) === gameIdStr);
    
    // Group by asset_id and count
    interface AssetCount {
      asset_id: string;
      participant_0: number;
      participant_1: number;
    }
    
    const assetCounts: Record<string, AssetCount> = {};
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    displayQueryResult(null, errorMessage);
    throw error;
  }
}

async function queryPlayerAssets(_torii: ToriiClient, playerId: string): Promise<any> {
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

    const response = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        variables: { playerId }
      }),
    });

    const result: GraphQLResponse = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data || !result.data.diPlayerAssetModels) {
      throw new Error('Invalid response structure from Torii');
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    displayQueryResult(null, errorMessage);
    throw error;
  }
}

export { initGame, updateFromEntitiesData, queryWorlds };

