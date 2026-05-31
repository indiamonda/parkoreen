# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Parkoreen is a multiplayer 2D platformer game with a map editor and level system. It consists of:
- **Frontend**: Static HTML/JS/CSS served from any host (Cloudflare Pages, GitHub Pages, or local file)
- **Backend**: Cloudflare Worker (Workers + KV) for auth, map storage, and WebSocket multiplayer
- **No build step** for the frontend — pure static files
- **Level system**: Player progression stored per account, levels organized in groups with challenge levels

## Running Locally

The frontend is static. Open `index.html` directly or serve the directory. For full multiplayer/admin features, deploy the Cloudflare Worker from `cloudflare-worker/` using `wrangler deploy`.

## Project Structure

```
/                    # Root: static HTML entry points
dashboard/           # User's map management page
host.html             # Map editor + game player (all-in-one)
cloudflare-worker/     # Backend API (auth, maps, WebSocket)
/assets               # CSS, JS, images
  /js
    game.js           # Core engine
    editor.js         # Map editor
    plugins.js        # Plugin system
    spa-router.js     # SPA routing
    exportImport.js   # .pkrn file format
  /pkrn
    /levels/         # Built-in levels (.pkrn files)
  /plugins/          # Gameplay plugins (hp, hk, code)
/wiki                # Documentation site
```

## Key Concepts

### Levels System

**Level Groups**: Levels are organized in groups (0, 1, 2, 3, etc.). Each group contains sequential levels plus optional challenge levels.

**Level Naming**: Levels named `{group}_{level}[_{suffix}`.pkrn (e.g., `0_1.pkrn`, `1_x_challenge_level.pkrn`)

**Unlock Logic**:
- Regular levels unlock when the previous level in sequence is completed
- Challenge levels unlock when ALL non-challenge levels in the group are completed
- Level group 0 (0_1, 0_2, 0_3) is required before unrestricted site access

**Progress Storage**: Level progress stored per account in the backend API (not localStorage)

**Level Completion Flow**:
1. User completes level → `POST /level-progress` with level ID
2. On returning to levels page, progress fetched from API
3. End game modal shows "Exit" for group 0 levels
4. After 0_3, user scrolls to group 2 (special case flag `parkoreen_level_complete_special`)

### Game Engine (`assets/js/game.js`)

- `GameEngine` class drives game loop with fixed 60fps timestep
- `Player` class handles physics (gravity, jumping, coyote time, corner nudging)
- `World` class manages objects with spatial hash for efficient collision queries
- Camera supports smooth follow and zoom (0.5x–4x in editor, locked in test/play)
- Collision uses `groundTouchbox` (lower portion for grounding) and `hurtTouchbox` (inset for damage detection)
- `GameState`: `EDITOR`, `TESTING`, `PLAYING`, `ENDED`

### Spatial Hash (`SpatialHash` class)
- Cell size 128px; objects inserted by grid coverage
- `queryNear(x, y, w, h)` returns objects near a point — used every frame
- Rebuilt lazily when `_spatialDirty` flag set

### Plugin System (`assets/js/plugins.js`)
- `PluginManager` loads plugin scripts in order: globals → inject → script
- Plugins inject via `new Function('ctx', script)` with context object
- Hooks registered via `registerHook(name, callback, pluginId)` and executed via `executeHook(name, data)`
- Available hooks: `player.init`, `player.update`, `player.jump`, `player.damage`, `player.land`, `player.respawn`, `player.checkpoint`, `input.keydown`, `input.keyup`, `button.pressed`, `render.soulStatue`, etc.

### Editor (`host.html + assets/js/editor.js`)
- `Editor` class wraps `GameEngine` with tool state, placement modes, undo/redo
- Undo via world JSON snapshots (max 60 states)
- Tools: `fly`, `move`, `duplicate`, `rotate`, `select`, `erase`
- Placement modes: `BLOCK`, `OBSTACLE`, `SPAWN_END`, `TEXT`, `TELEPORTAL`, `BUTTON`
- Multi-select with `SelectionMode`: `QUOT` (drag rectangle), `MULTI`, `MOUSE`

### Export/Import Format (`.pkrn`)
- ZIP archive containing `data.json` or `data.dat` (RLE-compressed JSON)
- RLE encoding: `0xFF, count, byte` for runs ≥4 identical bytes; `0xFF, 0x00` to escape literal `0xFF`
- Short field names in serialization (`x`, `y`, `w`, `h`, `t`, `at`, `act`, `col`, `c`, `o`, `l`, `r`, `fh`, `n`, `tex`)

### SPA Router (`assets/js/spa-router.js`)
- Routes: `/dashboard/`, `/mails/`, `/settings/`, `/admin/`, `/howtoplay/`
- Fetches HTML with `?spa=1` query param, injects into `#spa-content`
- Animations: bounce-in/out, staggered item transitions
- `window.Navigation` patched to use `navigateSpa()` for internal links

### Backend (`cloudflare-worker/worker.js`)
- Auth: signup/login with bcrypt-style hash (`SHA-256(password + SECRET)`)
- Map CRUD via KV: `map:{id}`, `user:{userId}:maps`
- Level progress: `level_progress:{userId}` (JSON: `{ completed: ["0_1", "0_2", ...]`)
- WebSocket multiplayer via `GameRoom` class (Durable Object pattern): room code → sessions map
- Player colors generated via HSL to maximize hue distance from existing players
- Admin routes checked against `ADMIN_USERNAMES` env var + `roleMode: 'admin'` in user settings

### Service Worker (`sw.js`)
- Caches assets in `parkoreen-v25`; skips `/admin/` and `/mails/` (stale HTML causes bugs)
- Background refresh: returns cached, updates cache in background

## Key Patterns

**Collision modes**: Spike touchbox modes (`full`, `normal`, `tip`, `ground`, `flag`, `air`, `all-spike`) control which parts of a spike are solid vs damaging. `dropHurtOnly` adds direction check for "drop hurt" spikes.

**Corner nudging**: When player's edge barely clips a block vertically/horizontally, `_tryCornerNudgeVertical/Horizontal` attempts to slide into adjacent gaps before stopping.

**Teleportal connections**: A valid two-way connection requires A's `sendTo` to include B AND B's `receiveFrom` to include A. Invalid connections render as animated red arrows in the editor.

**Bouncer spring animation**: Uses damped oscillation `A * exp(-5t) * sin(18t)` with intensity ramping on rapid re-trigger (max 3.5×).

**Checkpoint jump reset**: When player on checkpoint rapidly changes direction (left→right or right→left) within 500ms, jumps are reset. Tracked via `directionChangeCount` and `directionChangeWindowStart`.

**Walking particles**: Dust particles spawn when player walks on ground, colored to match the block below player.

## File Locations

| File | Purpose |
|------|---------|
| `index.html` | Level selection page (entry point) |
| `host.html` | Map editor + game player (all-in-one) |
| `runtime.js` | Auth, MapManager, MultiplayerManager, JimmyQrgManager, Settings |
| `assets/js/game.js` | Core engine: physics, collision, player, camera, world |
| `assets/js/editor.js` | Map editor UI, tools, undo/redo |
| `assets/js/plugins.js` | Plugin manager and hook system |
| `assets/js/spa-router.js` | SPA routing for dashboard/admin pages |
| `assets/js/exportImport.js` | `.pkrn` export/import, `ExportManager`, `ImportManager` |
| `assets/js/style.js` | UI components (ToastManager, ModalManager, LoadingManager) |
| `sw.js` | Service worker caching |
| `cloudflare-worker/worker.js` | Backend API, WebSocket multiplayer |
| `dashboard/` | User's map management page |
| `assets/pkrn/levels/` | Built-in level files (`.pkrn` format) |

## Cloudflare Worker Deployment

```bash
cd cloudflare-worker
wrangler deploy
```

Required KV namespaces: `USERS`, `MAPS`, `SESSIONS`. Optional: `GAME_ROOMS` (Durable Object for WebSocket).

## Level Progression

Level completion is stored per user in the Cloudflare Worker KV store (not localStorage). Progress is fetched on page load and updated on level completion via `POST /level-progress` API endpoint.
