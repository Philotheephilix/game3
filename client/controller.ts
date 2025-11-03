/**
 * Setups controller options:
 * https://docs.cartridge.gg/controller/getting-started
 *
 * This example uses Katana for local host development.
 */
import manifest from '../contracts/manifest_dev.json' with { type: 'json' };

interface Contract {
  tag: string;
  address: string;
}

interface Manifest {
  contracts: Contract[];
}

interface Method {
  name: string;
  entrypoint: string;
  description: string;
}

interface ContractPolicy {
  name?: string;
  description?: string;
  methods: Array<Method | { entrypoint: string }>;
}

interface ContractPolicies {
  [address: string]: ContractPolicy;
}

interface ControllerOpts {
  chains: Array<{ rpcUrl: string }>;
  defaultChainId: string;
  policies: {
    contracts: ContractPolicies;
  };
}

const actionsContract = (manifest as Manifest).contracts.find((contract) => contract.tag === 'di-actions');
const worldSystemContract = (manifest as Manifest).contracts.find((contract) => contract.tag === 'di-world_system');
const gameSystemContract = (manifest as Manifest).contracts.find((contract) => contract.tag === 'di-game_system');
const VRF_PROVIDER_ADDRESS = '0x15f542e25a4ce31481f986888c179b6e57412be340b8095f72f75a328fbb27b';

// Build contracts object only for contracts that exist
const contractPolicies: ContractPolicies = {};

if (actionsContract && actionsContract.address) {
  contractPolicies[actionsContract.address] = {
    name: 'Actions',
    description: 'Actions contract to control the player movement',
    methods: [
      {
        name: 'Spawn',
        entrypoint: 'spawn',
        description: 'Spawn the player in the game',
      },
      {
        name: 'Move',
        entrypoint: 'move',
        description: 'Move the player in the game',
      },
      {
        name: 'Move Random',
        entrypoint: 'move_random',
        description: 'Move the player in the game',
      },
    ],
  };
}

if (worldSystemContract && worldSystemContract.address) {
  contractPolicies[worldSystemContract.address] = {
    name: 'World System',
    description: 'World system contract',
    methods: [
      {
        name: 'Create World',
        entrypoint: 'create_world',
        description: 'Create a new world',
      },
    ],
  };
}

if (gameSystemContract && gameSystemContract.address) {
  contractPolicies[gameSystemContract.address] = {
    name: 'Game System',
    description: 'Game system contract for game management',
    methods: [
      {
        name: 'Create World',
        entrypoint: 'create_world',
        description: 'Create a new world',
      },
      {
        name: 'Create Game',
        entrypoint: 'create_game',
        description: 'Create a new game in a world',
      },
      {
        name: 'Join Game',
        entrypoint: 'join_game',
        description: 'Join an existing game',
      },
      {
        name: 'Start Game',
        entrypoint: 'start_game',
        description: 'Start a game',
      },
      {
        name: 'Collect Asset',
        entrypoint: 'collect_asset',
        description: 'Collect an asset in the game',
      },
      {
        name: 'Enter Safe Area',
        entrypoint: 'enter_safe_area',
        description: 'Enter safe area to secure collected assets',
      },
      {
        name: 'Move Player',
        entrypoint: 'move_player',
        description: 'Move player to a new position',
      },
      {
        name: 'Hit',
        entrypoint: 'hit',
        description: 'Hit a participant to reduce HP',
      },
      {
        name: 'End Game',
        entrypoint: 'end_game',
        description: 'End the game and transfer assets to players',
      },
    ],
  };
}

contractPolicies[VRF_PROVIDER_ADDRESS] = {
  methods: [{ entrypoint: 'request_random' }],
};

const controllerOpts: ControllerOpts = {
  chains: [{ rpcUrl: 'https://api.cartridge.gg/x/starknet/sepolia' }],
  defaultChainId: '0x534e5f5345504f4c4941',
  policies: {
    contracts: contractPolicies,
  },
};

export default controllerOpts;

