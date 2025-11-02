use crate::models::{
    World, WorldAsset, WorldRegistry
};

#[starknet::interface]
pub trait IWorldSystem<T> {
    fn create_world(
        ref self: T,
        name: felt252,
        grid_width: u16,
        grid_height: u16,
        asset_count: u32,
        difficulty: u8,
        time_limit_blocks: u64,
        safe_zone_x: u16,
        safe_zone_y: u16
    ) -> u32;
    
    fn toggle_world_active(ref self: T, world_id: u32, is_active: bool);
    
    fn get_asset_at_position(
        self: @T,
        world_id: u32,
        x: u16,
        y: u16
    ) -> u32;  // Returns asset_id if found, 0xFFFFFFFF if not found
}

#[dojo::contract]
pub mod world_system {
    use super::{IWorldSystem, World, WorldAsset, WorldRegistry};
    use starknet::{get_caller_address, get_block_timestamp};
    use dojo::model::ModelStorage;
    use core::pedersen::pedersen;

    const MAX_GRID_SIZE: u16 = 100;
    const MIN_TIME_LIMIT: u64 = 50;
    const REGISTRY_ID: u8 = 0;

    #[abi(embed_v0)]
    impl WorldSystemImpl of IWorldSystem<ContractState> {
        fn create_world(
            ref self: ContractState,
            name: felt252,
            grid_width: u16,
            grid_height: u16,
            asset_count: u32,
            difficulty: u8,
            time_limit_blocks: u64,
            safe_zone_x: u16,
            safe_zone_y: u16
        ) -> u32 {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Verify caller is admin
            let registry: WorldRegistry = world.read_model((REGISTRY_ID,));
            assert!(caller == registry.admin, "Not authorized admin");

            // Validate parameters
            assert!(grid_width > 0 && grid_width <= MAX_GRID_SIZE, "Invalid grid_width");
            assert!(grid_height > 0 && grid_height <= MAX_GRID_SIZE, "Invalid grid_height");
            let grid_width_u32: u32 = grid_width.into();
            let grid_height_u32: u32 = grid_height.into();
            let max_assets = grid_width_u32 * grid_height_u32;
            assert!(asset_count <= max_assets, "Too many assets");
            assert!(safe_zone_x < grid_width, "Safe zone x out of bounds");
            assert!(safe_zone_y < grid_height, "Safe zone y out of bounds");
            assert!(time_limit_blocks >= MIN_TIME_LIMIT, "Time limit too short");

            // Generate new world_id
            let mut registry: WorldRegistry = world.read_model((REGISTRY_ID,));
            let world_id = registry.total_worlds;
            registry.total_worlds += 1;
            world.write_model(@registry);

            // Create World model
            let new_world = World {
                world_id,
                name,
                asset_count,
                grid_width,
                grid_height,
                difficulty,
                time_limit_blocks,
                safe_zone_x,
                safe_zone_y,
                is_active: true,
                created_at: get_block_timestamp(),
                created_by: caller,
            };

            world.write_model(@new_world);

            // Generate assets
            self._generate_assets(world_id, asset_count, grid_width, grid_height, safe_zone_x, safe_zone_y);

            world_id
        }

        fn toggle_world_active(ref self: ContractState, world_id: u32, is_active: bool) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Verify caller is admin
            let registry: WorldRegistry = world.read_model((REGISTRY_ID,));
            assert!(caller == registry.admin, "Not authorized admin");

            // Get World
            let mut world_model: World = world.read_model((world_id,));
            assert!(world_model.created_at > 0, "World does not exist");

            world_model.is_active = is_active;
            world.write_model(@world_model);
        }

        fn get_asset_at_position(
            self: @ContractState,
            world_id: u32,
            x: u16,
            y: u16
        ) -> u32 {
            let world = self.world_default();

            // Verify world exists
            let world_model: World = world.read_model((world_id,));
            assert!(world_model.created_at > 0, "World does not exist");

            // Search for asset at position
            let asset_count = world_model.asset_count;
            let mut asset_id: u32 = 0;
            loop {
                if asset_id >= asset_count {
                    break;
                }

                let asset: WorldAsset = world.read_model((world_id, asset_id));
                if asset.position_x == x && asset.position_y == y {
                    return asset_id; // Return actual asset_id (found)
                }

                asset_id += 1;
            };

            0xFFFFFFFF // Not found
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }

        fn _generate_assets(
            ref self: ContractState,
            world_id: u32,
            asset_count: u32,
            grid_width: u16,
            grid_height: u16,
            safe_zone_x: u16,
            safe_zone_y: u16
        ) {
            let mut world = self.world_default();
            let timestamp = get_block_timestamp();
            
            // Get world to access difficulty
            let world_model: World = world.read_model((world_id,));
            let difficulty = world_model.difficulty;

            // Initialize seed
            let seed = pedersen(world_id.into(), timestamp.into());

            let mut asset_id: u32 = 0;
            let mut used_positions: Array<(u16, u16)> = array![];
            let mut retry_count: u32 = 0;
            const MAX_RETRIES: u32 = 1000; // Prevent infinite loops

            loop {
                if asset_id >= asset_count {
                    break;
                }

                // Generate random position using asset_id + retry_count to ensure uniqueness
                let position_seed = asset_id * 1000 + retry_count;
                let hash_x = pedersen(seed, (position_seed * 2).into());
                let hash_y = pedersen(seed, (position_seed * 2 + 1).into());

                // Convert felt252 to u256 then to u16
                let hash_x_u256: u256 = hash_x.into();
                let hash_y_u256: u256 = hash_y.into();
                let x_u256 = hash_x_u256 % grid_width.into();
                let y_u256 = hash_y_u256 % grid_height.into();
                let x: u16 = x_u256.try_into().unwrap();
                let y: u16 = y_u256.try_into().unwrap();

                // Check if position is safe zone or occupied
                let mut is_valid = true;
                if x == safe_zone_x && y == safe_zone_y {
                    is_valid = false;
                }

                let mut i: usize = 0;
                loop {
                    if i >= used_positions.len() {
                        break;
                    }
                    let (used_x, used_y) = *used_positions.at(i);
                    if used_x == x && used_y == y {
                        is_valid = false;
                        break;
                    }
                    i += 1;
                };

                if !is_valid {
                    retry_count += 1;
                    if retry_count >= MAX_RETRIES {
                        panic!("Failed to generate valid asset positions after max retries");
                    }
                    // Retry with different seed
                    continue;
                }

                // Valid position found - reset retry count
                retry_count = 0;

                // Add to used positions
                used_positions.append((x, y));

                // Generate asset properties
                let value_hash = pedersen(hash_x, hash_y);
                let value_hash_u256: u256 = value_hash.into();
                let value_multiplier_u256 = value_hash_u256 % 100.into();
                let value_multiplier: u64 = value_multiplier_u256.try_into().unwrap() + 50; // 50-150%
                let base_value: u64 = 100;
                let difficulty_u64: u64 = difficulty.into();
                let difficulty_multiplier: u64 = 1 + (difficulty_u64 * 50 / 100);
                let value = base_value * difficulty_multiplier * value_multiplier / 100;

                let asset_type_u256 = value_hash_u256 % 4.into();
                let asset_type: u8 = asset_type_u256.try_into().unwrap();
                let danger_level_u256 = value_hash_u256 % 3.into();
                let danger_level_add: u8 = danger_level_u256.try_into().unwrap();
                let danger_level = difficulty + danger_level_add;

                // Create WorldAsset
                let asset = WorldAsset {
                    world_id,
                    asset_id,
                    position_x: x,
                    position_y: y,
                    value,
                    asset_type,
                    danger_level,
                };

                world.write_model(@asset);
                asset_id += 1;
            };
        }
    }
}

