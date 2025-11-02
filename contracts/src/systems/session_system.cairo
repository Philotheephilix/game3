use starknet::ContractAddress;
use crate::models::{
    GameSession, PlayerProfile, PlayerUpgrades, World
};

#[starknet::interface]
pub trait ISessionSystem<T> {
    fn start_game(ref self: T, world_id: u32) -> u64;
    
    fn move_player(
        ref self: T,
        session_id: u64,
        target_x: u16,
        target_y: u16
    );
    
    fn get_active_session(
        self: @T,
        player: ContractAddress
    ) -> GameSession;
    
    fn abandon_session(ref self: T, session_id: u64);
}

#[dojo::contract]
pub mod session_system {
    use super::{ISessionSystem, GameSession, PlayerProfile, PlayerUpgrades, World};
    use starknet::{ContractAddress, get_block_number, get_caller_address};
    use dojo::model::ModelStorage;
    use core::pedersen::pedersen;

    const BLOCKS_PER_LEVEL: u64 = 10;
    const MAX_HEALTH_BASE: u8 = 100;
    const HEALTH_PER_LEVEL: u8 = 20;
    const BASE_SPEED: u8 = 1;

    #[abi(embed_v0)]
    impl SessionSystemImpl of ISessionSystem<ContractState> {
        fn start_game(ref self: ContractState, world_id: u32) -> u64 {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Verify World exists and is active
            let world_model: World = world.read_model((world_id,));
            assert!(world_model.created_at > 0, "World does not exist");
            assert!(world_model.is_active, "World is not active");

            // Check for active session - try common session_ids
            // In production, this would query Torii for active sessions
            // For now, check session_id 0 and also check if any session exists
            let current_block = get_block_number();
            let test_session: GameSession = world.read_model((caller, 0));
            if test_session.is_active && current_block < test_session.end_block {
                panic!("Active session already exists");
            }

            // Generate session_id
            let block_number = get_block_number();
            let session_hash = pedersen(caller.into(), block_number.into());
            let session_id_u256: u256 = session_hash.into();
            let session_id: u64 = session_id_u256.try_into().unwrap();

            // Get current block
            let current_block = get_block_number();

            // Get or create PlayerProfile
            let mut profile: PlayerProfile = world.read_model((caller,));
            if profile.joined_at == 0 {
                profile = PlayerProfile {
                    player: caller,
                    total_banked_loot: 0,
                    lifetime_collected: 0,
                    total_runs: 0,
                    successful_runs: 0,
                    failed_runs: 0,
                    current_streak: 0,
                    best_streak: 0,
                    joined_at: current_block,
                };
            }
            profile.total_runs += 1;

            // Get PlayerUpgrades for time bonus (create default if doesn't exist)
            let upgrades: PlayerUpgrades = world.read_model((caller,));
            let time_extension_level = if upgrades.speed_level == 0 && upgrades.time_extension_level == 0 {
                // Check if upgrades exist by checking if any level is set
                // If all are 0, it might be default, so use 0
                0
            } else {
                upgrades.time_extension_level
            };
            let time_extension_u64: u64 = time_extension_level.into();
            let time_bonus = time_extension_u64 * BLOCKS_PER_LEVEL;
            let end_block = current_block + world_model.time_limit_blocks + time_bonus;

            // Create GameSession with health based on upgrades
            let health_level = if upgrades.speed_level == 0 && upgrades.health_level == 0 {
                0
            } else {
                upgrades.health_level
            };
            let health = MAX_HEALTH_BASE + (health_level * HEALTH_PER_LEVEL);
            let session = GameSession {
                player: caller,
                session_id,
                world_id,
                start_block: current_block,
                end_block,
                current_loot_value: 0,
                collected_asset_count: 0,
                player_x: world_model.safe_zone_x,
                player_y: world_model.safe_zone_y,
                health,
                is_active: true,
                has_returned_safely: false,
                alarm_triggered: false,
            };

            world.write_model(@session);
            world.write_model(@profile);

            session_id
        }

        fn move_player(
            ref self: ContractState,
            session_id: u64,
            target_x: u16,
            target_y: u16
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let current_block = get_block_number();

            // Get GameSession
            let mut session: GameSession = world.read_model((caller, session_id));
            assert!(session.is_active, "Session not active");

            // Check timing
            if current_block >= session.end_block {
                panic!("Time expired");
            }

            // Get PlayerUpgrades for speed (defaults to 0 if doesn't exist)
            let upgrades: PlayerUpgrades = world.read_model((caller,));
            let speed_level_u8 = upgrades.speed_level;
            // Calculate max movement distance: base speed + (speed_level / 2)
            // Speed level 0 = 1 tile, level 2 = 2 tiles, level 4 = 3 tiles, etc.
            let max_distance = BASE_SPEED + (speed_level_u8 / 2);
            if max_distance == 0 {
                panic!("Invalid speed");
            }

            // Validate movement distance
            let dx = if target_x > session.player_x {
                target_x - session.player_x
            } else {
                session.player_x - target_x
            };
            let dy = if target_y > session.player_y {
                target_y - session.player_y
            } else {
                session.player_y - target_y
            };

            let max_distance_u16: u16 = max_distance.into();
            assert!(dx <= max_distance_u16 && dy <= max_distance_u16, "Movement too far");
            assert!(dx > 0 || dy > 0, "No movement");

            // Validate bounds
            let world_model: World = world.read_model((session.world_id,));
            assert!(target_x < world_model.grid_width, "X out of bounds");
            assert!(target_y < world_model.grid_height, "Y out of bounds");

            // Update position
            session.player_x = target_x;
            session.player_y = target_y;

            world.write_model(@session);
        }

        fn get_active_session(
            self: @ContractState,
            player: ContractAddress
        ) -> GameSession {
            let world = self.world_default();
            let current_block = get_block_number();

            // Try to find active session by checking common session_ids
            // In production, use Torii to query active sessions efficiently
            // For now, check session_id 0 as the primary session
            let session: GameSession = world.read_model((player, 0));
            
            // Verify session is active and not expired
            if session.is_active {
                if current_block < session.end_block {
                    return session;
                } else {
                    // Session expired but still marked active - return inactive
                    return GameSession {
                        player,
                        session_id: 0,
                        world_id: 0,
                        start_block: 0,
                        end_block: 0,
                        current_loot_value: 0,
                        collected_asset_count: 0,
                        player_x: 0,
                        player_y: 0,
                        health: 0,
                        is_active: false,
                        has_returned_safely: false,
                        alarm_triggered: false,
                    };
                }
            }
            
            // Return empty session if none found
            GameSession {
                player,
                session_id: 0,
                world_id: 0,
                start_block: 0,
                end_block: 0,
                current_loot_value: 0,
                collected_asset_count: 0,
                player_x: 0,
                player_y: 0,
                health: 0,
                is_active: false,
                has_returned_safely: false,
                alarm_triggered: false,
            }
        }

        fn abandon_session(ref self: ContractState, session_id: u64) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Get GameSession
            let mut session: GameSession = world.read_model((caller, session_id));
            assert!(session.is_active, "Session not active");

            // Update session
            session.is_active = false;
            session.alarm_triggered = true;

            // Update PlayerProfile
            let mut profile: PlayerProfile = world.read_model((caller,));
            profile.failed_runs += 1;
            profile.current_streak = 0;

            world.write_model(@session);
            world.write_model(@profile);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }
    }
}

