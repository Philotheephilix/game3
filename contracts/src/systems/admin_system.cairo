use starknet::ContractAddress;
use dojo::model::ModelStorage;
use crate::models::WorldRegistry;

#[starknet::interface]
pub trait IAdminSystem<T> {
    fn initialize_registry(ref self: T, admin: ContractAddress);
    
    fn transfer_admin(ref self: T, new_admin: ContractAddress);
    
    fn emergency_pause_world(ref self: T, world_id: u32);
}

#[dojo::contract]
pub mod admin_system {
    use super::{IAdminSystem, WorldRegistry};
    use starknet::ContractAddress;
    use dojo::model::ModelStorage;
    use crate::models::World;

    const REGISTRY_ID: u8 = 0;

    #[abi(embed_v0)]
    impl AdminSystemImpl of IAdminSystem<ContractState> {
        fn initialize_registry(ref self: ContractState, admin: ContractAddress) {
            let mut world = self.world_default();

            // Check if registry exists
            let registry_key: (u8,) = (REGISTRY_ID,);
            let existing_registry: WorldRegistry = world.read_model(registry_key);
            let zero_address: ContractAddress = starknet::contract_address_const::<0x0>();
            assert!(existing_registry.admin == zero_address, "Registry already initialized");

            // Create WorldRegistry
            let registry = WorldRegistry {
                registry_id: REGISTRY_ID,
                total_worlds: 0,
                admin,
            };

            world.write_model(@registry);
        }

        fn transfer_admin(ref self: ContractState, new_admin: ContractAddress) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            // Get WorldRegistry
            let registry_key: (u8,) = (REGISTRY_ID,);
            let mut registry: WorldRegistry = world.read_model(registry_key);
            assert!(caller == registry.admin, "Not authorized admin");
            let zero_address: ContractAddress = starknet::contract_address_const::<0x0>();
            assert!(new_admin != zero_address, "Invalid admin address");

            // Update admin
            registry.admin = new_admin;

            world.write_model(@registry);
        }

        fn emergency_pause_world(ref self: ContractState, world_id: u32) {
            let mut world = self.world_default();
            let caller = starknet::get_caller_address();

            // Verify caller is admin
            let registry_key: (u8,) = (REGISTRY_ID,);
            let registry: WorldRegistry = world.read_model(registry_key);
            assert!(caller == registry.admin, "Not authorized admin");

            // Get World
            let world_model: World = world.read_model((world_id,));
            let mut updated_world = world_model;
            updated_world.is_active = false;

            world.write_model(@updated_world);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }
    }
}

