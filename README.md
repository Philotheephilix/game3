# HarvestHeist — Roguelike Heist Adventure

A monorepo containing:
- `contracts`: Dojo (Cairo) smart contracts and scripts for running a local Starknet stack (Katana + Torii)
- `client`: A Vite + TypeScript game client built with Excalibur that integrates with the Dojo stack


## What is the game?
HarvestHeist is a roguelike stealth/action heist game. You infiltrate procedurally generated banks, steal loot, avoid traps and enemies, and race a timer. The twist: you must return to a safe area before time runs out to permanently bank your loot. If you fail the escape, you lose the run’s loot.

Core loop: Enter → Loot → Escape → Secure → Upgrade → Repeat

- Enter the Bank: Randomized layouts, loot, enemies, and traps each run
- Explore & Collect: Loot fills a temporary stash during the run
- Risk Escalation: Alarms and danger increase over time; deeper rooms pay more
- Return to Safe Area: Navigate back under time pressure; failure wipes loot
- Secure & Upgrade: Banked loot becomes permanent; buy upgrades and gadgets

Progression highlights:
- Permanent upgrades: speed, stealth radius, trap disabling, larger bag, timer extender
- Consumables: smoke bombs, decoys, EMP pulses (per-run)

Design pillars: Tension (timer), Strategy (how deep to go), Replayability (procedural gen + upgrades), Reward loop (secure → upgrade → attempt harder runs)


## Repository structure
```
.
├── client/                   # Vite + TypeScript game client (Excalibur)
│   ├── src/                  # Game code, scenes, actors, assets
│   ├── index.html            # Vite entry
│   ├── package.json          # Dev/build scripts
│   └── vite.config.ts        # Vite config (port 3000)
└── contracts/                # Dojo (Cairo) smart contracts and tooling
    ├── Scarb.toml            # Scarb project + scripts
    ├── src/                  # Cairo contracts
    ├── dojo_dev.toml         # Dojo world config (sample)
    ├── katana.toml           # Local Katana config
    ├── torii.config.toml     # Torii config (if used)
    ├── dev.sh                # Start full local stack: Katana + sozo migrate + Torii
    ├── start-torii.sh        # Start Torii only (requires running Katana + manifest)
    └── stop-torii.sh         # Stop Torii processes
```


## Prerequisites
- Node.js ≥ 18.0 (recommended LTS)
- A package manager: pnpm (recommended), npm, or yarn
- Dojo toolchain (includes `sozo`, `katana`, `torii`) and Scarb
  - Quick installer:
    ```bash
    curl -L https://install.dojoengine.org | bash
    ```
  - Or via asdf (if you use it):
    ```bash
    asdf install
    ```

Verify tools:
```bash
node -v
pnpm -v         # or npm -v / yarn -v
sozo --version
katana --version
torii --version
scarb --version
```


## Quick start (local development)
Open two terminals: one for the blockchain stack, one for the game client.

### 1) Start the contracts stack (Katana + World + Torii)
From the repository root:
```bash
cd contracts
scarb run dev
```
What this does:
- Starts Katana (local Starknet RPC) using `katana.toml` on `http://localhost:5050`
- Builds the contracts (`sozo build`) and migrates the world (`sozo migrate --profile dev`)
- Starts Torii indexer on `http://localhost:8080` against the deployed world
- Prints the World address and log locations

Keep this terminal running.

Troubleshooting:
- If `katana` or `torii` are not found, (re)install Dojo tools and ensure they’re on your PATH
- If ports are busy: free 5050 (Katana) or 8080 (Torii) or adjust configs
- If migration fails: rerun `sozo build` then `sozo migrate --profile dev`

Useful scripts:
```bash
# Start only Torii (requires an existing manifest_dev.json and running Katana)
scarb run start-torii

# Stop Torii processes
scarb run stop-torii
```

### 2) Start the client
In a new terminal from the repository root:
```bash
cd client
pnpm install
pnpm run dev
# Alternatives:
# npm install && npm run dev
# yarn install && yarn run dev
```
Then open `http://localhost:3000` in your browser.

Notes:
- The client uses Vite dev server on port 3000.
- Some wallet/controller features work best in Chrome.


## Environment details
- RPC: Katana at `http://localhost:5050`
- Indexer: Torii at `http://localhost:8080`
- World address: Emitted during `scarb run dev` (derived from `manifest_dev.json`)
- Contracts build/migration: Managed by `sozo build` and `sozo migrate --profile dev`

The client integrates with Dojo via `@dojoengine/*` packages and reads game state via Torii.


## Common issues & fixes
- Ports in use (5050/8080):
  - Kill blocking processes or change the port in `katana.toml` / Torii args
- `manifest_dev.json` missing:
  - Run the full stack once via `scarb run dev` to generate it
- Dojo tools not found:
  - Re-run the installer and reload your shell: `curl -L https://install.dojoengine.org | bash`
- SSL for controller:
  - If you need HTTPS locally, configure Vite HTTPS using a cert plugin (e.g., `vite-plugin-mkcert`) and update `vite.config.ts` accordingly


## Build for production
Client build:
```bash
cd client
pnpm run build
# Output in client/dist
```

Contracts are compiled with `sozo build`. Deployment beyond local is environment-specific (e.g., using Sepolia with proper accounts/keys). See `contracts/dojo_dev.toml` for a sample remote config scaffold.


## Scripts reference
Contracts (run from `contracts/`):
- `scarb run dev` — start Katana, build + migrate world, start Torii
- `scarb run start-torii` — start Torii for the current world (requires `manifest_dev.json`)
- `scarb run stop-torii` — stop Torii processes

Client (run from `client/`):
- `pnpm run dev` — Vite dev server at `http://localhost:3000`
- `pnpm run build` — TypeScript compile + Vite production build
- `pnpm run preview` — Preview the production build locally


## Tech stack
- Client: TypeScript, Vite, Excalibur
- Engine/On-chain: Dojo (`sozo`, `katana`, `torii`), Cairo 2, Scarb


## License
This project includes game assets under their respective licenses. Review the assets folders before redistribution.


## Game assets and locations

### Runtime-loaded assets (from `client/src/resources.ts`)
These assets are registered in the loader and must exist at the listed paths:

| Asset key | Purpose | File path |
|-----------|---------|-----------|
| `playerIdle` | Player idle spritesheet | `client/src/assets/character/Idle.png` |
| `playerRun` | Player run spritesheet | `client/src/assets/character/Run.png` |
| `playerDamage` | Player taking damage | `client/src/assets/character/Damage.png` |
| `playerDead` | Player death | `client/src/assets/character/Dead.png` |
| `inventorySlots` | Inventory slots UI | `client/src/assets/character/Slots.png` |
| `inventoryBar` | Inventory bar UI | `client/src/assets/character/invimage.png` |
| `money` | Coin/loot sprite | `client/src/assets/Money.png` |
| `moleEntering` | Mole enemy entering | `client/src/assets/sprites/entering.png` |
| `moleLeaving` | Mole enemy leaving | `client/src/assets/sprites/leaving.png` |
| `moleIdle` | Mole enemy idle | `client/src/assets/sprites/idle.png` |
| `moleSpitting` | Mole enemy attack | `client/src/assets/sprites/spitting.png` |
| `moleDamage` | Mole enemy hurt | `client/src/assets/sprites/damage.png` |
| `moleDead` | Mole enemy death | `client/src/assets/sprites/dead.png` |
| `projectileGreen` | Generic projectile | `client/src/assets/sprites/projectile/Green.png` |
| `playerBowAttack` | Player bow attack | `client/src/assets/character/Bow and Arrow.png` |
| `arrowProjectile` | Arrow projectile | `client/src/assets/character/Arrow.png` |
| `playerSickle` | Player sickle (melee) | `client/src/assets/Manu/Sickle.png` |
| `fallCrops` | Crop spritesheet | `client/src/assets/Farm Crops - Tiny Asset Pack/Fall Crops.png` |
| `healthBars` | Health bars UI | `client/src/assets/Bars.png` |
| `manuPortrait` | Character portrait (UI) | `client/src/Farm RPG - Tiny Asset Pack - (All in One) (1)/Character and Portrait - Tiny Asset Pack/Portrait/Pre-made/Manu with contour.png` |
| `clock` | UI clock icon | `client/src/Farm RPG - Tiny Asset Pack - (All in One) (1)/UI - Tiny Asset Pack/Clock/Clock.png` |

Maps loaded at runtime:

| Map key | Type | File path |
|---------|------|-----------|
| `mineMap` | Tiled (tmj) | `client/src/assets/mine.tmj` |
| `roomMap` | Tiled (tmx) | `client/src/assets/maps/gamemaplvl.tmx` |


### Asset pack directories (overview)
Aside from the individual files above, the repo ships larger packs for art/UI:

- `client/src/assets/` — Core art used by the game (characters, UI, sprites, maps)
  - `character/` — Player spritesheets (Idle, Run, Damage, Dead, Bow and Arrow, Arrow, Slots, invimage)
  - `sprites/` — Enemy and projectile sprites (mole animations, projectile variants)
  - `maps/` — Tiled map assets (e.g., `gamemaplvl.tmx` and related tilesets)
  - Root files include UI and general art like `Bars.png`, `Money.png`, `mine.tmj`

- `client/src/Farm RPG - Tiny Asset Pack - (All in One) (1)/` — Third-party pack with subfolders:
  - `Character and Portrait - Tiny Asset Pack/Portrait/Pre-made/` — Portraits (e.g., Manu)
  - `UI - Tiny Asset Pack/Clock/` — UI clock and related UI sprites
  - Additional subfolders (Characters, Enemies, Exterior/Interior, Farm, Animals, Icons, etc.) for future content

- `client/src/assets/Farm Crops - Tiny Asset Pack/` — Crop sprites (e.g., `Fall Crops.png`)


### Adding new assets
1. Place the file under `client/src/assets/` (or the appropriate pack directory).
2. Reference it in `client/src/resources.ts` by creating a new `ex.ImageSource` or Tiled resource.
3. Ensure it’s included in the `Resources` object so the Loader preloads it at startup.

