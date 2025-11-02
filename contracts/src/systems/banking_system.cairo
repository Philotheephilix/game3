use starknet::ContractAddress;
use crate::models::{
    GameSession, PlayerProfile, World
};

#[starknet::interface]
pub trait IBankingSystem<T> {
    fn return_to_safe_zone(ref self: T, session_id: u64);
    
    fn trigger_alarm(
        ref self: T,
        player: ContractAddress,
        session_id: u64
    );
    
    fn check_timeout_and_alarm(
        ref self: T,
        player: ContractAddress,
        session_id: u64
    ) -> bool;
}

#[dojo::contract]
pub mod banking_system {
    use super::{IBankingSystem, GameSession, PlayerProfile, World};
    use starknet::{ContractAddress, get_block_number, get_caller_address};
    use dojo::model::ModelStorage;

    #[abi(embed_v0)]
    impl BankingSystemImpl of IBankingSystem<ContractState> {
        fn return_to_safe_zone(ref self: ContractState, session_id: u64) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let current_block = get_block_number();

            // Get GameSession
            let mut session: GameSession = world.read_model((caller, session_id));
            assert!(session.is_active, "Session not active");

            // Check timing
            if current_block >= session.end_block {
                self.trigger_alarm(caller, session_id);
                panic!("Time expired - alarm triggered");
            }

            // Get World
            let world_model: World = world.read_model((session.world_id,));

            // Verify at safe zone
            assert!(session.player_x == world_model.safe_zone_x, "Not at safe zone x");
            assert!(session.player_y == world_model.safe_zone_y, "Not at safe zone y");
            assert!(!session.has_returned_safely, "Already returned safely");

            // Bank loot
            self._bank_loot_internal(world_model, session);

            // Update session
            session.has_returned_safely = true;
            session.is_active = false;

            world.write_model(@session);
        }

        fn trigger_alarm(
            ref self: ContractState,
            player: ContractAddress,
            session_id: u64
        ) {
            let mut world = self.world_default();
            let current_block = get_block_number();

            // Get GameSession
            let mut session: GameSession = world.read_model((player, session_id));
            assert!(session.is_active || current_block >= session.end_block, "Cannot trigger alarm");
            assert!(!session.alarm_triggered, "Alarm already triggered");

            // Store loot lost (for potential future use)
            let _loot_lost = session.current_loot_value;

            // Update session
            session.is_active = false;
            session.alarm_triggered = true;
            session.current_loot_value = 0;

            // Update PlayerProfile
            let mut profile: PlayerProfile = world.read_model((player,));
            profile.failed_runs += 1;
            profile.current_streak = 0;

            world.write_model(@session);
            world.write_model(@profile);
        }

        fn check_timeout_and_alarm(
            ref self: ContractState,
            player: ContractAddress,
            session_id: u64
        ) -> bool {
            let mut world = self.world_default();
            let current_block = get_block_number();

            // Get GameSession
            let session: GameSession = world.read_model((player, session_id));
            
            if !session.is_active {
                return false;
            }

            if current_block >= session.end_block {
                self.trigger_alarm(player, session_id);
                return true;
            }

            false
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }

        fn _bank_loot_internal(
            ref self: ContractState,
            world: World,
            session: GameSession
        ) {
            let mut world_storage = self.world_default();
            let current_block = get_block_number();

            // Calculate time bonus multiplier
            let blocks_remaining = session.end_block - current_block;
            let time_threshold = world.time_limit_blocks / 4; // 25%
            let mut time_bonus_multiplier: u64 = 100; // 1.0 as basis points

            if blocks_remaining > time_threshold {
                let bonus_percent = (blocks_remaining * 100) / world.time_limit_blocks;
                time_bonus_multiplier = 100 + bonus_percent;
            }

            let final_value = (session.current_loot_value * time_bonus_multiplier) / 100;

            // Get and Update PlayerProfile
            let mut profile: PlayerProfile = world_storage.read_model((session.player,));
            profile.total_banked_loot += final_value;
            profile.lifetime_collected += session.current_loot_value;
            profile.successful_runs += 1;
            profile.current_streak += 1;

            if profile.current_streak > profile.best_streak {
                profile.best_streak = profile.current_streak;
            }

            world_storage.write_model(@profile);
        }
    }
}

