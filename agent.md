# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parkoreen is a multiplayer 2D platformer game with a map editor. It consists of:
- **Frontend**: Static HTML/JS/CSS served from any host (designed for Cloudflare Pages or GitHub Pages)
- **Backend**: Cloudflare Worker (Workers + KV) for auth, map storage, and WebSocket multiplayer
- **No build step** for the frontend — pure static files

## Running Locally

The frontend is static and runs directly in a browser. Open `index.html` (or serve the directory). For full multiplayer/admin features, deploy the Cloudflare Worker from `cloudflare-worker/` using `wrangler deploy`.

## Architecture

### Core Engine (`assets/js/game.js`)
- `GameEngine` class drives the game loop with fixed 60fps timestep
- `Player` class handles physics (gravity, jumping with coyote time, corner-nudging)
- `World` class manages objects with a spatial hash for efficient collision queries
- `Camera` supports smooth follow and zoom (0.5x–4x in editor, locked in test/play)
- Collision uses `groundTouchbox` (lower portion for ground) and `hurtTouchbox` (inset for damage)
- `GameState.EDITOR / TESTING / PLAYING / ENDED` controls mode-specific behavior

### Spatial Hash (`SpatialHash` class in game.js)
- Cell size 128px; objects inserted by grid coverage
- `query(x, y, w, h)` returns objects near a point — used every frame for collision
- Rebuilt lazily when `_spatialDirty` flag set

### Plugin System (`assets/js/plugins.js`)
- `PluginManager` loads plugin scripts (globals → inject → script order)
- Plugins inject via `new Function('ctx', script)` with a context object containing `pluginManager`, `world`, `hooks`, `sounds`
- Hooks are registered via `registerHook(name, callback, pluginId, priority)` and executed via `executeHook(name, data)`
- Available hooks: `player.init`, `player.update`, `player.jump`, `player.damage`, `player.land`, `player.respawn`, `player.checkpoint`, `input.keydown`, `input.keyup`, `button.pressed`, `render.soulStatue`, etc.

### Editor (`assets/js/editor.js`)
- `Editor` class wraps `GameEngine` with tool state, placement modes, undo/redo
- Undo via world JSON snapshots (max 60 states); wraps `world.addObject`/`world.removeObject`
- Tools: `fly` (free camera + test player), `move`, `duplicate`, `rotate`, `select`, `erase`
- Placement modes via `PlacementMode` enum: `BLOCK`, `OBSTACLE`, `KOREEN`, `SPAWN_END`, `TEXT`, `TELEPORTAL`, `BUTTON`
- Multi-select with `SelectionMode`: `QUOT` (drag rectangle), `MULTI`, `MOUSE`

### Export Format (`.pkrn`)
- ZIP archive containing `data.json` or `data.dat` (RLE-compressed JSON) plus uploaded media
- Binary encoding uses RLE: `0xFF, count, byte` for runs ≥4 bytes; `0xFF, 0x00` to escape literal `0xFF`
- Serialization uses short field names (`x`, `y`, `w`, `h`, `t`, `at`, `act`, `col`, `c`, `o`, `l`, `r`, `fh`, `n`, `tex`)

### SPA Router (`assets/js/spa-router.js`)
- Routes: `/dashboard/`, `/mails/`, `/settings/`, `/admin/`, `/howtoplay/`
- Fetches HTML with `?spa=1` query param, injects into `#spa-content`
- Animations: bounce-in/out, staggered item transitions
- `window.Navigation` patched to use `navigateSpa()` for internal links

### Backend (`cloudflare-worker/worker.js`)
- Auth: signup/login with bcrypt-style hash (`SHA-256(password + SECRET)`)
- Map CRUD via KV: `map:{id}`, `user:{userId}:maps`
- WebSocket via `GameRoom` class (Durable Object pattern): room code → sessions map
- Player colors generated via HSL to maximize hue distance from existing players
- Admin routes use `ADMIN_USERNAMES` env var (comma-separated) in addition to defaults

### Service Worker (`sw.js`)
- Caches assets in `parkoreen-v25`; skips `/admin/` and `/mails/` (stale HTML causes bugs)
- Background refresh: returns cached, updates cache in background

## Key Patterns

**Collision modes**: Spike touchbox modes (`full`, `normal`, `tip`, `ground`, `flag`, `air`, `all-spike`) control which parts of a spike are solid vs damaging. `dropHurtOnly` adds direction check.

**Corner nudging**: When player's edge barely clips a block vertically/horizontally, `_tryCornerNudgeVertical/Horizontal` attempts to slide into adjacent gaps before stopping.

**Teleportal connections**: A two-way connection requires A's `sendTo` to include B AND B's `receiveFrom` to include A. Invalid connections render as animated red arrows in the editor.

**Bouncer spring animation**: Uses damped oscillation `A * exp(-5t) * sin(18t)` with intensity ramping on rapid re-trigger (max 3.5×).

**Checkpoint jump reset**: When player on checkpoint rapidly changes direction (left→right or right→left) within 500ms, jumps are reset. Tracked via `directionChangeCount` and `directionChangeWindowStart`.

## File Locations

| File | Purpose |
|------|---------|
| `assets/js/game.js` | Core engine: physics, collision, player, camera, world |
| `assets/js/editor.js` | Map editor UI, tools, undo/redo |
| `assets/js/plugins.js` | Plugin manager and hook system |
| `assets/js/spa-router.js` | SPA routing for dashboard/admin pages |
| `assets/js/exportImport.js` | `.pkrn` export/import, `ExportManager`, `ImportManager` |
| `runtime.js` | Auth, MapManager, MultiplayerManager, JimmyQrgManager, Settings |
| `sw.js` | Service worker caching |
| `cloudflare-worker/worker.js` | Backend API, WebSocket multiplayer |
| `host.html` | Host game (multiplayer runtime) |

## Cloudflare Worker Deployment

```bash
cd cloudflare-worker
wrangler deploy
```

Required KV namespaces: `USERS`, `MAPS`, `SESSIONS`. Optional: `GAME_ROOMS` (Durable Object for WebSocket).