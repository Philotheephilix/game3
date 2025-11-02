use starknet::ContractAddress;
use crate::models::{
    GameSession, WorldAsset, SessionAssetCollection
};

#[starknet::interface]
pub trait ICollectionSystem<T> {
    fn collect_asset(
        ref self: T,
        session_id: u64,
        asset_id: u32
    );
    
    fn batch_collect_assets(
        ref self: T,
        session_id: u64,
        asset_ids: Span<u32>
    );
    
    fn get_collected_assets(
        self: @T,
        player: ContractAddress,
        session_id: u64
    ) -> Array<u32>;
}

#[dojo::contract]
pub mod collection_system {
    use super::{ICollectionSystem, GameSession, WorldAsset, SessionAssetCollection};
    use starknet::{ContractAddress, get_block_number, get_caller_address};
    use dojo::model::ModelStorage;

    #[abi(embed_v0)]
    impl CollectionSystemImpl of ICollectionSystem<ContractState> {
        fn collect_asset(
            ref self: ContractState,
            session_id: u64,
            asset_id: u32
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

            // Get WorldAsset
            let asset: WorldAsset = world.read_model((session.world_id, asset_id));

            // Verify player at asset location
            assert!(session.player_x == asset.position_x, "Player not at asset x position");
            assert!(session.player_y == asset.position_y, "Player not at asset y position");

            // Check if already collected
            // Try to read collection - if it exists with non-zero collected_at_block, it's collected
            let collection: SessionAssetCollection = world.read_model((caller, session_id, asset_id));
            // In Dojo, if model doesn't exist, all fields will be zero/empty
            // collected_at_block = 0 means not collected
            if collection.collected_at_block > 0 {
                panic!("Asset already collected");
            }

            // Create SessionAssetCollection
            let new_collection = SessionAssetCollection {
                player: caller,
                session_id,
                asset_id,
                collected_at_block: current_block,
            };

            // Update GameSession
            session.current_loot_value += asset.value;
            session.collected_asset_count += 1;

            world.write_model(@new_collection);
            world.write_model(@session);
        }

        fn batch_collect_assets(
            ref self: ContractState,
            session_id: u64,
            asset_ids: Span<u32>
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

            let mut total_value: u64 = 0;
            let len = asset_ids.len();
            let mut i: usize = 0;

            loop {
                if i >= len {
                    break;
                }

                let asset_id = *asset_ids.at(i);

                // Get WorldAsset
                let asset: WorldAsset = world.read_model((session.world_id, asset_id));

                // Verify position matches
                assert!(session.player_x == asset.position_x, "Position mismatch");
                assert!(session.player_y == asset.position_y, "Position mismatch");

                // Check not already collected
                let collection: SessionAssetCollection = world.read_model((caller, session_id, asset_id));
                if collection.collected_at_block > 0 {
                    panic!("Already collected");
                }

                // Create SessionAssetCollection
                let new_collection = SessionAssetCollection {
                    player: caller,
                    session_id,
                    asset_id,
                    collected_at_block: current_block,
                };

                total_value += asset.value;
                world.write_model(@new_collection);

                i += 1;
            };

            // Update session once
            session.current_loot_value += total_value;
            let len_u16: u16 = len.try_into().unwrap();
            session.collected_asset_count += len_u16;

            world.write_model(@session);
        }

        fn get_collected_assets(
            self: @ContractState,
            player: ContractAddress,
            session_id: u64
        ) -> Array<u32> {
            // NOTE: For production, use Torii GraphQL queries instead:
            // query GetCollectedAssets($player: String!, $sessionId: String!) {
            //   sessionAssetCollections(
            //     where: { player: $player, session_id: $sessionId }
            //   ) { edges { node { asset_id } } }
            // }
            // This on-chain version is limited and expensive - use Torii for efficient queries
            // Since Dojo doesn't support iteration over models with composite keys efficiently on-chain,
            // we implement a simplified version that checks a reasonable range of asset_ids
            
            let world = self.world_default();
            let mut collected: Array<u32> = array![];
            
            // Get session to find world and asset count
            let session: GameSession = world.read_model((player, session_id));
            if session.session_id == 0 || session.world_id == 0 {
                // Invalid session
                return collected;
            }
            
            // For production, use Torii off-chain query:
            // Query SessionAssetCollection where player=player AND session_id=session_id
            // On-chain iteration is expensive, so we limit to checking first 100 assets
            // In practice, clients should use Torii GraphQL queries
            let max_check: u32 = 100;
            let mut asset_id: u32 = 0;
            
            loop {
                if asset_id >= max_check {
                    break;
                }
                
                let collection: SessionAssetCollection = world.read_model((player, session_id, asset_id));
                if collection.collected_at_block > 0 {
                    collected.append(asset_id);
                }
                
                asset_id += 1;
            };
            
            collected
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"di")
        }
    }
}

