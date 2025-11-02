use starknet::ContractAddress;
use crate::models::{
    PlayerProfile, PlayerUpgrades
};

#[starknet::interface]
pub trait IShopSystem<T> {
    fn purchase_upgrade(ref self: T, upgrade_type: u8);
    
    fn get_upgrade_cost(
        self: @T,
        player: ContractAddress,
        upgrade_type: u8
    ) -> u64;
    
    fn get_all_upgrade_costs(
        self: @T,
        player: ContractAddress
    ) -> Array<u64>;
}

#[dojo::contract]
pub mod shop_system {
    use super::{IShopSystem, PlayerProfile, PlayerUpgrades};
    use starknet::{ContractAddress, get_caller_address};
    use dojo::model::ModelStorage;

    const SPEED_BASE_COST: u64 = 1000;
    const STEALTH_BASE_COST: u64 = 1500;
    const DETECTOR_BASE_COST: u64 = 2000;
    const HEALTH_BASE_COST: u64 = 800;
    const TIME_EXTENSION_BASE_COST: u64 = 2500;
    const MAX_LEVEL: u8 = 10;

    #[abi(embed_v0)]
    impl ShopSystemImpl of IShopSystem<ContractState> {
        fn purchase_upgrade(ref self: ContractState, upgrade_type: u8) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Get PlayerProfile
            let mut profile: PlayerProfile = world.read_model((caller,));
            assert!(profile.joined_at > 0, "Player profile does not exist");

            // Get PlayerUpgrades (create default if doesn't exist)
            let mut upgrades: PlayerUpgrades = world.read_model((caller,));
            
            // Initialize upgrades if they don't exist (all fields zero)
            // We check if all upgrade levels are 0 - this could mean default or uninitialized
            // If profile exists but all upgrades are 0, we still proceed (level 0 is valid)

            // Get current level
            let current_level = match upgrade_type {
                0 => upgrades.speed_level,
                1 => upgrades.stealth_level,
                2 => upgrades.detector_level,
                3 => upgrades.health_level,
                4 => upgrades.time_extension_level,
                _ => panic!("Invalid upgrade type"),
            };

            assert!(current_level < MAX_LEVEL, "Already at max level");

            // Calculate cost
            let base_cost = match upgrade_type {
                0 => SPEED_BASE_COST,
                1 => STEALTH_BASE_COST,
                2 => DETECTOR_BASE_COST,
                3 => HEALTH_BASE_COST,
                4 => TIME_EXTENSION_BASE_COST,
                _ => panic!("Invalid upgrade type"),
            };

            let next_level_u8 = current_level + 1;
            let next_level: u64 = next_level_u8.into();
            // cost = base_cost * (next_level ^ 1.5)
            // Simplified: use integer math - next_level^1.5 ≈ next_level * sqrt(next_level)
            let level_squared = next_level * next_level;
            let cost = (base_cost * level_squared) / next_level; // Approximation of ^1.5

            // Verify sufficient funds
            assert!(profile.total_banked_loot >= cost, "Insufficient funds");

            // Deduct cost
            profile.total_banked_loot -= cost;

            // Upgrade
            match upgrade_type {
                0 => upgrades.speed_level += 1,
                1 => upgrades.stealth_level += 1,
                2 => upgrades.detector_level += 1,
                3 => upgrades.health_level += 1,
                4 => upgrades.time_extension_level += 1,
                _ => panic!("Invalid upgrade type"),
            }

            world.write_model(@profile);
            world.write_model(@upgrades);
        }

        fn get_upgrade_cost(
            self: @ContractState,
            player: ContractAddress,
            upgrade_type: u8
        ) -> u64 {
            let world = self.world_default();

            // Validate upgrade_type
            if upgrade_type > 4 {
                return 0;
            }

            // Get PlayerUpgrades (may be default/empty)
            let upgrades: PlayerUpgrades = world.read_model((player,));

            // Get current level (defaults to 0 if upgrades don't exist)
            let current_level = match upgrade_type {
                0 => upgrades.speed_level,
                1 => upgrades.stealth_level,
                2 => upgrades.detector_level,
                3 => upgrades.health_level,
                4 => upgrades.time_extension_level,
                _ => MAX_LEVEL, // Should never reach here due to check above
            };

            if current_level >= MAX_LEVEL {
                return 0;
            }

            // Calculate cost
            let base_cost = match upgrade_type {
                0 => SPEED_BASE_COST,
                1 => STEALTH_BASE_COST,
                2 => DETECTOR_BASE_COST,
                3 => HEALTH_BASE_COST,
                4 => TIME_EXTENSION_BASE_COST,
                _ => 0, // Should never reach here
            };

            if base_cost == 0 {
                return 0;
            }

            let next_level_u8 = current_level + 1;
            let next_level: u64 = next_level_u8.into();
            let level_squared = next_level * next_level;
            (base_cost * level_squared) / next_level
        }

        fn get_all_upgrade_costs(
            self: @ContractState,
            player: ContractAddress
        ) -> Array<u64> {
            let mut costs = array![];
            
            let mut upgrade_type: u8 = 0;
            loop {
                if upgrade_type > 4 {
                    break;
                }
                costs.append(self.get_upgrade_cost(player, upgrade_type));
                upgrade_type += 1;
            };

            costs
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }
    }
}

