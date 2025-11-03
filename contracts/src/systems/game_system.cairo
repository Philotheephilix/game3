use crate::models::{
    CollectedAsset, Game, PermanentAsset, PlayerAsset, WorldRegistry,
};
use dojo::model::ModelStorage;

#[starknet::interface]
pub trait IGameSystem<T> {
    fn create_world(ref self: T, world_id: u32);
    fn create_game(ref self: T, world_id: u32) -> u64;
    fn join_game(ref self: T, game_id: u64);
    fn start_game(ref self: T, game_id: u64);
    fn collect_asset(ref self: T, game_id: u64, asset_id: u32);
    fn enter_safe_area(ref self: T, game_id: u64);
    fn move_player(ref self: T, game_id: u64, pos_x: u32, pos_y: u32);
    fn hit(ref self: T, game_id: u64, participant: u8, amount: u32);
    fn end_game(ref self: T, game_id: u64);
}

#[dojo::contract]
pub mod game_system {
    use super::IGameSystem;
    use crate::models::{
        AssetCounter, CollectedAsset, Game, PermanentAsset, PlayerAsset, WorldRegistry,
    };
    use core::num::traits::SaturatingSub;
    use dojo::model::ModelStorage;
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        next_game_id: u64,
    }

    // Initialize next_game_id
    #[constructor]
    fn constructor(ref self: ContractState) {
        self.next_game_id.write(1);
    }

    // Helper function to generate a unique storage key for collection counter
    // Key: game_id * 1000000 + participant * 10000 + asset_id
    fn get_collection_counter_key(game_id: u64, participant: u8, asset_id: u32) -> felt252 {
        let game_felt: felt252 = game_id.try_into().unwrap();
        let participant_u32: u32 = participant.into();
        let participant_felt: felt252 = participant_u32.try_into().unwrap();
        let asset_felt: felt252 = asset_id.try_into().unwrap();
        let mul_const_1: felt252 = 1000000;
        let mul_const_2: felt252 = 10000;
        let game_part = game_felt * mul_const_1;
        let participant_part = participant_felt * mul_const_2;
        game_part + participant_part + asset_felt
    }
    
    // Helper function to generate a unique storage key for permanent asset counter
    // Key: game_id * 1000000 + participant * 10000 + asset_id + 10000000 (offset to separate from collection)
    fn get_permanent_counter_key(game_id: u64, participant: u8, asset_id: u32) -> felt252 {
        let base_key = get_collection_counter_key(game_id, participant, asset_id);
        base_key + 10000000
    }
    
    // Get or create counter from Dojo model
    fn get_or_create_counter(ref world: dojo::world::WorldStorage, key: felt252) -> AssetCounter {
        let mut counter = AssetCounter {
            counter_key: key,
            collection_count: 0,
            permanent_count: 0,
        };
        // Try to read existing counter, if it doesn't exist, return default
        let existing: AssetCounter = world.read_model(key);
        counter.collection_count = existing.collection_count;
        counter.permanent_count = existing.permanent_count;
        counter
    }
    
    // Increment collection counter and return new value
    fn increment_collection_counter(ref self: ContractState, ref world: dojo::world::WorldStorage, key: felt252) -> u32 {
        let mut counter = get_or_create_counter(ref world, key);
        counter.collection_count += 1;
        world.write_model(@counter);
        counter.collection_count
    }
    
    // Increment permanent counter and return new value
    fn increment_permanent_counter(ref self: ContractState, ref world: dojo::world::WorldStorage, key: felt252) -> u32 {
        let mut counter = get_or_create_counter(ref world, key);
        counter.permanent_count += 1;
        world.write_model(@counter);
        counter.permanent_count
    }
    
    // Get collection counter value
    fn get_collection_counter(ref world: dojo::world::WorldStorage, key: felt252) -> u32 {
        let counter = get_or_create_counter(ref world, key);
        counter.collection_count
    }
    
    // Get permanent counter value
    fn get_permanent_counter(ref world: dojo::world::WorldStorage, key: felt252) -> u32 {
        let counter = get_or_create_counter(ref world, key);
        counter.permanent_count
    }
    
    // Helper function to remove all collected assets of a participant
    // Note: In Dojo, we iterate through known indices and skip dead participant assets
    // The assets remain in storage but are effectively ignored
    fn remove_collected_assets(
        ref world: dojo::world::WorldStorage, game_id: u64, participant: u8
    ) {
        // Optimized: Only iterate through a reasonable range of assets
        // In practice, games won't have thousands of unique asset types
        let mut asset_id: u32 = 1;
        loop {
            if asset_id > 100 {  // Reduced from 10000
                break;
            }

            // Get collection counter for this asset to know the max index
            let collection_counter_key = get_collection_counter_key(game_id, participant, asset_id);
            let max_collection_index = get_collection_counter(ref world, collection_counter_key);
            
            // Only iterate through actual collections, not up to 10000
            let mut collection_index: u32 = 1;
            loop {
                if collection_index > max_collection_index {
                    break;
                }
                
                let collected_key = (game_id, asset_id, collection_index);
                
                // Try to read - if it fails, skip
                let collected: CollectedAsset = world.read_model(collected_key);
                
                // Only process assets collected by this participant
                if collected.participant == participant {
                    // Mark as deleted by writing a zero model
                    let deleted = CollectedAsset {
                        game_id,
                        asset_id,
                        collection_index,
                        participant: 255, // Invalid marker
                    };
                    world.write_model(@deleted);
                }

                collection_index += 1;
            }

            asset_id += 1;
        }
    }

    // Helper function to move permanent assets to player registry
    // This function accumulates permanent assets into PlayerAsset with correct amounts
    fn move_permanent_assets_to_players(
        ref self: ContractState, ref world: dojo::world::WorldStorage, game: Game
    ) {
        // Iterate through both participants
        let mut participant: u8 = 0;
        loop {
            if participant > 1 {
                break;
            }
            
            let player_id: ContractAddress = if participant == 0 {
                game.participant_a
            } else {
                game.participant_b
            };
            
            // Count permanent assets per asset_id for this participant
            let mut asset_id: u32 = 1;
            loop {
                if asset_id > 100 {  // Reduced limit to avoid resource exhaustion
                    break;
                }
                
                // Get permanent counter for this participant and asset
                let permanent_counter_key = get_permanent_counter_key(game.game_id, participant, asset_id);
                let max_permanent_index = get_permanent_counter(ref world, permanent_counter_key);
                
                // Count how many permanent assets exist (not deleted)
                let mut count: u32 = 0;
                let mut permanent_index: u32 = 1;
                loop {
                    if permanent_index > max_permanent_index {
                        break;
                    }
                    
                    let permanent_key = (game.game_id, asset_id, permanent_index);
                    // Try to read permanent asset
                    let permanent: PermanentAsset = world.read_model(permanent_key);
                    
                    // Count only assets for this participant that aren't deleted
                    if permanent.participant == participant && permanent.participant != 255 {
                        count += 1;
                    }
                    
                    permanent_index += 1;
                }
                
                // If count > 0, update PlayerAsset
                if count > 0 {
                    let player_asset_key = (player_id, asset_id);
                    // Read existing or create new
                    let mut player_asset = PlayerAsset {
                        player_id,
                        asset_id,
                        amount: 0,
                    };
                    
                    // Try to read existing amount, if it doesn't exist, start from 0
                    // Note: This assumes PlayerAsset exists or we create it with amount=0
                    // The actual amount will be set to count below
                    player_asset.amount = count;
                    world.write_model(@player_asset);
                }
                
                asset_id += 1;
            }
            
            participant += 1;
        }
    }

    #[abi(embed_v0)]
    impl GameSystemImpl of IGameSystem<ContractState> {
        // Create a new world
        fn create_world(ref self: ContractState, world_id: u32) {
            let mut world = self.world_default();
            let creator = starknet::get_caller_address();

            let registry = WorldRegistry {
                world_id,
                game_count: 0,
                creator,
            };

            world.write_model(@registry);
        }

        // Create a new game in a world (sender becomes participant_a)
        fn create_game(ref self: ContractState, world_id: u32) -> u64 {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            // Get next game ID
            let game_id = self.next_game_id.read();
            self.next_game_id.write(game_id + 1);

            // Verify world exists
            let registry: WorldRegistry = world.read_model(world_id);
            assert(registry.world_id == world_id, 'World not exist');

            // Create game with caller as participant_a
            let zero_address: ContractAddress = starknet::contract_address_const::<0x0>().try_into().unwrap();
            let game = Game {
                game_id,
                status: 0, // waiting
                world_id,
                participant_a: caller,
                participant_b: zero_address,
                position_a_x: 0,
                position_a_y: 0,
                position_b_x: 0,
                position_b_y: 0,
                hp_a: 0,
                hp_b: 0,
                alive_a: true,
                alive_b: true,
            };

            world.write_model(@game);

            // Increment game count in world registry
            let mut registry: WorldRegistry = world.read_model(world_id);
            registry.game_count += 1;
            world.write_model(@registry);

            game_id
        }

        // Join a game as participant_b
        fn join_game(ref self: ContractState, game_id: u64) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let mut game: Game = world.read_model(game_id);
            let zero_address: ContractAddress = starknet::contract_address_const::<0x0>().try_into().unwrap();
            assert(game.status == 0, 'Game not waiting');
            assert(game.participant_b == zero_address, 'Game has two players');
            assert(game.participant_a != caller, 'Cannot join own game');

            game.participant_b = caller;
            world.write_model(@game);
        }

        // Start the game (set status=1, hp_a=100, hp_b=100)
        fn start_game(ref self: ContractState, game_id: u64) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let mut game: Game = world.read_model(game_id);
            let zero_address: ContractAddress = starknet::contract_address_const::<0x0>().try_into().unwrap();
            assert(game.status == 0, 'Game not waiting');
            assert(
                game.participant_a == caller || game.participant_b == caller,
                'Only participants start',
            );
            assert(
                game.participant_b != zero_address,
                'Need two participants',
            );

            game.status = 1; // started
            game.hp_a = 100;
            game.hp_b = 100;
            game.alive_a = true;
            game.alive_b = true;
            world.write_model(@game);
        }

        // Collect an asset in the game
        fn collect_asset(ref self: ContractState, game_id: u64, asset_id: u32) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let game: Game = world.read_model(game_id);
            assert(game.status == 1, 'Game not started');

            // Determine participant (0 for a, 1 for b)
            let participant: u8 = if game.participant_a == caller {
                0
            } else if game.participant_b == caller {
                1
            } else {
                panic!("Caller is not a participant")
            };

            // Check if participant is alive
            let is_alive = if participant == 0 { game.alive_a } else { game.alive_b };
            assert(is_alive, 'Participant dead');

            // Get and increment the counter for this (game_id, participant, asset_id) combination
            let counter_key = get_collection_counter_key(game_id, participant, asset_id);
            let collection_index = increment_collection_counter(ref self, ref world, counter_key);

            // Create collected asset entry
            let collected = CollectedAsset {
                game_id,
                asset_id,
                collection_index,
                participant,
            };

            world.write_model(@collected);
        }

        // Enter safe area - move all collected assets to permanent assets
        fn enter_safe_area(ref self: ContractState, game_id: u64) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let game: Game = world.read_model(game_id);
            assert(game.status == 1, 'Game not started');

            // Determine participant
            let participant: u8 = if game.participant_a == caller {
                0
            } else if game.participant_b == caller {
                1
            } else {
                panic!("Caller is not a participant")
            };

            // Check if participant is alive
            let is_alive = if participant == 0 { game.alive_a } else { game.alive_b };
            assert(is_alive, 'Participant dead');

            // Move all collected assets to permanent assets for this participant
            // We iterate through asset_ids and use counters to track indices
            let mut asset_id: u32 = 1;
            loop {
                if asset_id > 100 {  // Reduced limit to avoid resource exhaustion
                    break;
                }

                // Get collection counter for this asset
                let collection_counter_key = get_collection_counter_key(game_id, participant, asset_id);
                let max_collection_index = get_collection_counter(ref world, collection_counter_key);
                
                // Iterate through collected assets
                let mut collection_index: u32 = 1;
                loop {
                    if collection_index > max_collection_index {
                        break;
                    }
                    
                    let collected_key = (game_id, asset_id, collection_index);
                    // Try to read collected asset - if it doesn't exist, skip
                    let collected: CollectedAsset = world.read_model(collected_key);
                    
                    // Skip deleted markers and assets from other participants
                    if collected.participant == 255 || collected.participant != participant {
                        collection_index += 1;
                        continue;
                    }

                    // Get and increment permanent counter for this asset
                    let permanent_counter_key = get_permanent_counter_key(game_id, participant, asset_id);
                    let permanent_index = increment_permanent_counter(ref self, ref world, permanent_counter_key);

                    // Create permanent asset
                    let permanent = PermanentAsset {
                        game_id,
                        asset_id,
                        permanent_index,
                        participant,
                    };
                    world.write_model(@permanent);

                    // Mark collected asset as deleted
                    let deleted = CollectedAsset {
                        game_id,
                        asset_id,
                        collection_index,
                        participant: 255, // Deleted marker
                    };
                    world.write_model(@deleted);

                    collection_index += 1;
                }

                asset_id += 1;
            }
        }

        // Move player to a new position
        fn move_player(ref self: ContractState, game_id: u64, pos_x: u32, pos_y: u32) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let mut game: Game = world.read_model(game_id);
            assert(game.status == 1, 'Game not started');

            // Determine participant and check if alive
            if game.participant_a == caller {
                assert(game.alive_a, 'Participant A dead');
                game.position_a_x = pos_x;
                game.position_a_y = pos_y;
            } else if game.participant_b == caller {
                assert(game.alive_b, 'Participant B dead');
                game.position_b_x = pos_x;
                game.position_b_y = pos_y;
            } else {
                panic!("Caller is not a participant");
            }

            world.write_model(@game);
        }

        // Hit a participant (reduce HP)
        fn hit(ref self: ContractState, game_id: u64, participant: u8, amount: u32) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let mut game: Game = world.read_model(game_id);
            assert(game.status == 1, 'Game not started');
            assert(
                game.participant_a == caller || game.participant_b == caller,
                'Only participants hit',
            );
            assert(participant < 2, 'Invalid participant');

            // Check if caller (the attacker) is alive
            let attacker_participant: u8 = if game.participant_a == caller {
                0
            } else {
                1
            };
            let attacker_alive = if attacker_participant == 0 { game.alive_a } else { game.alive_b };
            assert(attacker_alive, 'Attacker dead');

            // Check if target participant is alive (can't hit dead players)
            let target_alive = if participant == 0 { game.alive_a } else { game.alive_b };
            assert(target_alive, 'Cannot hit dead');

            // Apply damage using saturating_sub to prevent underflow
            let was_alive_before_a = game.alive_a;
            let was_alive_before_b = game.alive_b;

            if participant == 0 {
                // Hit participant A
                game.hp_a = game.hp_a.saturating_sub(amount);
                if game.hp_a == 0 {
                    game.alive_a = false;
                }
            } else {
                // Hit participant B
                game.hp_b = game.hp_b.saturating_sub(amount);
                if game.hp_b == 0 {
                    game.alive_b = false;
                }
            }

            // Check if participant just died (hp reached 0 or negative)
            let just_died_a = was_alive_before_a && !game.alive_a;
            let just_died_b = was_alive_before_b && !game.alive_b;

            // If participant A just died, remove all their collected assets
            if just_died_a {
                remove_collected_assets(ref world, game_id, 0);
            }

            // If participant B just died, remove all their collected assets
            if just_died_b {
                remove_collected_assets(ref world, game_id, 1);
            }

            // Check if both players died
            if !game.alive_a && !game.alive_b {
                // Move only permanent assets to player registry (collected assets already removed)
                move_permanent_assets_to_players(ref self, ref world, game);
                
                // End the game
                game.status = 2; // ended
            }

            world.write_model(@game);
        }

        // End game - move permanent assets to player registry
        fn end_game(ref self: ContractState, game_id: u64) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            let mut game: Game = world.read_model(game_id);
            assert(game.status == 1, 'Game not started');
            assert(
                game.participant_a == caller || game.participant_b == caller,
                'Only participants end',
            );

            game.status = 2; // ended
            world.write_model(@game);

            // Move permanent assets to player registry
            move_permanent_assets_to_players(ref self, ref world, game);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }
    }
}
