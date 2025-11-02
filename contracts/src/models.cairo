use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct World {
    #[key]
    pub world_id: u32,
    pub name: felt252,
    pub asset_count: u32,
    pub grid_width: u16,
    pub grid_height: u16,
    pub difficulty: u8,
    pub time_limit_blocks: u64,
    pub safe_zone_x: u16,
    pub safe_zone_y: u16,
    pub is_active: bool,
    pub created_at: u64,
    pub created_by: ContractAddress,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldAsset {
    #[key]
    pub world_id: u32,
    #[key]
    pub asset_id: u32,
    pub position_x: u16,
    pub position_y: u16,
    pub value: u64,
    pub asset_type: u8,  // 0=coin, 1=jewel, 2=artifact, 3=vault_key
    pub danger_level: u8,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct GameSession {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub session_id: u64,
    pub world_id: u32,
    pub start_block: u64,
    pub end_block: u64,
    pub current_loot_value: u64,
    pub collected_asset_count: u16,
    pub player_x: u16,
    pub player_y: u16,
    pub health: u8,
    pub is_active: bool,
    pub has_returned_safely: bool,
    pub alarm_triggered: bool,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct SessionAssetCollection {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub session_id: u64,
    #[key]
    pub asset_id: u32,
    pub collected_at_block: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerProfile {
    #[key]
    pub player: ContractAddress,
    pub total_banked_loot: u64,
    pub lifetime_collected: u64,
    pub total_runs: u32,
    pub successful_runs: u32,
    pub failed_runs: u32,
    pub current_streak: u16,
    pub best_streak: u16,
    pub joined_at: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerUpgrades {
    #[key]
    pub player: ContractAddress,
    pub speed_level: u8,
    pub stealth_level: u8,
    pub detector_level: u8,
    pub health_level: u8,
    pub time_extension_level: u8,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldRegistry {
    #[key]
    pub registry_id: u8,  // Singleton, always 0
    pub total_worlds: u32,
    pub admin: ContractAddress,
}
