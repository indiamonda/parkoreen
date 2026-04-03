# Parkoreen

**A multiplayer 2D parkour game where you build maps and race friends.**

Build parkour courses in the editor, test them locally, then host a real-time multiplayer game and share the room code with anyone.

![License](https://img.shields.io/badge/license-Proprietary-red)

---

## Table of Contents

- [Features](#features)
- [Pages & Navigation](#pages--navigation)
- [Editor Guide](#editor-guide)
- [Game Objects](#game-objects)
- [Map Config](#map-config)
- [Playing the Game](#playing-the-game)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Multiplayer](#multiplayer)
- [Plugins](#plugins)
- [File Format](#file-format)
- [Cloudflare Worker](#cloudflare-worker)
- [Resources](#resources)
- [License](#license)

---

## Features

- **2D platformer physics** — smooth movement, jumping, variable gravity
- **Full map editor** — place, move, rotate, resize, multi-select, undo/redo
- **Real-time multiplayer** — live position sync across all players in a room
- **Cloud map storage** — maps saved to the server; download as `.pkrn` files
- **Export / Import** — `.pkrn` files are ZIP archives (JSON or compressed binary)
- **Plugin system** — Hollow Knight–style ability plugins (HP bar, attacks, wall-cling, etc.)
- **Touchscreen support** — virtual joystick and buttons for mobile play
- **Admin tools** — drag players, quick kill, maps/rooms/users management panel

---

## Pages & Navigation

| Path | Purpose |
|------|---------|
| `/` → redirects to `/dashboard/` | Entry point |
| `/dashboard/` | Map list, create/edit/host maps |
| `/login/` `/signup/` | Authentication |
| `/settings/` | Volume, font size, touchscreen, keyboard layout |
| `/join/` | Join a room by code |
| `/mails/` | In-app mail / notifications |
| `/admin/` | Admin panel (role-gated) |
| `/wiki/` | Game wiki (offline-first HTML) |
| `/changelog/` | Version history |
| `/howtoplay/` | New-player tutorial |
| `host.html` | Host game runtime (opened by editor) |

The **Dashboard hamburger menu** links to Mails, Settings, Wiki, Changelog, and Admin (role-gated).

---

## Editor Guide

### Opening the editor

From the Dashboard, click **Edit** on any map card, or click **New Map** to create one.

### Toolbar (bottom of screen)

| Button / Key | Action |
|---|---|
| **Fly** · `G` | Pan the camera freely; hold to fly the test player |
| **Move** · `M` | Click an object to drag it |
| **Duplicate** · `C` | Click an object to clone it |
| **Rotate** · `R` | Click an object to rotate it 90° clockwise |
| **Select** · `V` | Drag a box to multi-select; then move/rotate/delete the selection |
| **Erase** · `Q` | Click to delete objects (modes: All, Top Layer, Bottom Layer) |
| **Grid** · `H` | Toggle snap-to-grid overlay |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Escape` | Cancel current action / close open panel |

### Zoom

| Action | Method |
|---|---|
| Zoom in | `Ctrl/Cmd + Scroll Up` or `+` button |
| Zoom out | `Ctrl/Cmd + Scroll Down` or `−` button |

### Adding objects

Click **Add** to open the placement menu. Select a category, configure options, then click on the canvas to place. Most objects snap to the grid.

### Editing objects

Click any object with no tool active to open its **Edit Popup**:

- **Name** — custom label
- **Color** — color picker (hex + presets)
- **Opacity** — 0–100%
- **Rotation** — left / right buttons
- **Flip Horizontal** — mirror sprite
- **Collision** — toggle solid collision
- **Layer** — draw-order integer

Type-specific options (spikes, teleportals, bouncers, buttons, text, zones) appear in their own sections of the popup.

### Adjusting saw-blade size

In the object inspector, click **Adjust Size** to enter resize mode. Eight handles (corners + edges) appear in orange — drag them on the grid. Press `Escape` or **Stop Adjusting** to exit.

---

## Game Objects

### Block

Solid platform. Options:

- **Appearance** — Ground, Spike, Decorator
- **Acting type** — Ground, Spike, Checkpoint, Spawn, End, Text, Zone
- **Texture** — None, Brick, etc.
- **Collision** — on/off
- **Fill mode** — Add / Replace / Overlap

### Spike

Damage-dealing obstacle. Per-object options:

| Option | Description |
|---|---|
| **Touchbox preset** | Full, Normal (tip + sides), Tip Only, Ground, Flag, Air |
| **All Spike** | Flat base is also lethal — no safe standing zone |
| **Drop Hurt Only** | Only damages when the player is moving *toward* the tip |
| **Damage amount** | How much damage each hit deals |

### Saw Blade (Spinner)

Rotating circular obstacle. Options:

- **Size** — drag-handle resize in editor
- **Spin direction** — clockwise / counter-clockwise
- **Spin speed**
- **Damage amount**

### Teleportal

Linked portal pair. Teleports the player on contact.

- Each portal has a **Teleportal Name** (must be unique)
- **Send To** list — portal names this portal sends the player to
- **Receive From** list — portal names allowed to send players here
- A connection is active **only when both sides are set**: A's Send To must contain B _and_ B's Receive From must contain A
- Editor highlights valid connections in green, incomplete (one-way) entries in red
- **Particle Opacity** — 0–100% slider controlling the opacity of the portal's particle effects (default 100%)

### Bouncer

Spring pad that launches the player on contact.

- **Direction** — up / right / down / left (arrow picker in edit popup)
- **Match Appearance** — links launch direction and visual orientation together
- **Bounce strength** — 5–50 (default 20; normal jump is ~13)
- Bouncer works in both test mode and editor fly mode
- Spring animation plays on trigger; amplitude ramps up on rapid re-trigger (max ×3.5×)

### Button

Interactive trigger.

| Mode | Behavior |
|---|---|
| **Click** | Player enters zone → popup appears → click to confirm |
| **Collide** | Triggers immediately and silently when the player steps on it |

- **One-Time Trigger** — fires only once per session
- **Face Color** / **Base Color** — two independent color pickers
- Fires the `button.pressed` plugin hook when triggered

### Coin

Collectible item.

- Floats with a gentle up/down animation; disappears when collected; plays `coin.ogg`
- **Amount** — value added to the coin counter (default 1)
- **Activity Scope** — `Global` (all players see the change) or `Player` (only the collector)
- Coin counter shown above the toolbar during test/host mode; hidden if the map has no coins; controlled by **Show Coin Counter** in map config

### Zone

Named rectangular region used by plugins or game logic.

- Drag to place; drag handles to resize
- Each zone has a **Name** and **Color**

### Text

Floating text label.

- **Font** — Parkoreen Game and others
- **Font size** — 8–200 px
- **Alignment** — horizontal + vertical
- **Letter / line spacing**

### Checkpoint, Spawn Point, End Point

Placed via the **Game Item** entry in the Add menu.

---

## Map Config

Access via the **Config** button (top-left in the editor).

### General

| Setting | Description |
|---|---|
| Map Name | Display name |
| Background | Sky, Galaxy, or Custom (image / GIF / video) |
| Die Line Y | Y coordinate below which the player dies |
| Show Coin Counter | Show/hide the coin counter HUD |

### Physics

| Setting | Default |
|---|---|
| Player speed | 5 |
| Jump force | −14 |
| Gravity | 0.8 |

### Player

| Setting | Description |
|---|---|
| Jumps | Number of jumps allowed (or infinite) |
| Additional airjump | All jumps available in air |
| Collide with each other | Player–player collision in multiplayer |

### Default Colors

| Object | Default |
|---|---|
| Block | `#787878` |
| Spike | `#c45a3f` |
| Portal | `#9b59b6` |
| Bouncer | `#f59e0b` |

New objects are seeded from these world defaults.

### Checkpoint Colors

| State | Default |
|---|---|
| Default (untouched) | `#808080` |
| Active (current) | `#4CAF50` |
| Touched (past) | `#2196F3` |

### Spike Behavior (global defaults)

- **Touchbox preset** — Full / Normal / Tip / Ground / Flag / Air
- **Drop Hurt Only** — spikes only damage when the player moves toward the tip
- **Damage amount** — default damage per hit

### Music

Built-in tracks or upload custom audio; volume + loop controls.

### Data Type

`.json` (human-readable) or `.dat` (compressed binary) for the inner map data file.

---

## Playing the Game

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move left/right | `A` / `D` or `←` / `→` | Joystick |
| Jump | `W`, `↑`, or `Space` | Jump button |
| Fly up/down | `W`/`S` or `↑`/`↓` (fly mode) | Joystick |

> **Keyboard layouts:** JimmyQrg (default) and Hollow Knight Original are selectable in Settings — attack, heal, dash, and super-dash keys differ between layouts.

### Tester mode (in editor)

| Key / Button | Action |
|---|---|
| Tester button | Start/stop test |
| `G` | Toggle fly |
| Respawn button | Respawn at last checkpoint / spawn point |
| Invincibility button | Toggle god mode |
| Touchboxes button | Show/hide hitbox overlays |
| `Escape` | Exit test and return to editor |

---

## Keyboard Shortcuts

### Editor

| Key | Action |
|---|---|
| `G` | Fly tool (also active in tester) |
| `M` | Move tool |
| `C` | Duplicate tool |
| `R` | Rotate tool |
| `V` | Select tool (multi-select) |
| `Q` | Erase tool |
| `H` | Toggle grid |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Escape` | Cancel / close |

### Admin (in-game)

| Key | Action |
|---|---|
| `G` | Toggle fly |
| `M` | Toggle Quick Drag Player |
| `K` | Quick Kill |

---

## Multiplayer

### Hosting

1. Open a map in the editor → **Config** → **Host Game**
2. Set max players and optional password → **Host Game**
3. Share the 6-character room code

The map is auto-saved when the tab is closed or reloaded (keepalive fetch).

### Joining

1. Dashboard → **Join** (or `/join/`)
2. Enter room code and password (if required) → **Join**

### Player colors

Each player gets a distinct color calculated to be maximally different from all current players in the room.

---

## Plugins

Plugins extend gameplay with custom mechanics loaded from `/assets/plugins/`.

| Plugin | Description |
|---|---|
| **HK** (Hollow Knight) | HP bar, attacks, wall-cling, dash, soul statue, pogo |
| **HP** | Generic HP system without HK abilities |
| **Code** | In-map JavaScript scripting (BETA) |
| **CJ** | Additional movement abilities |

Plugins expose hooks (`player.damage`, `player.respawn`, `button.pressed`, etc.) for inter-plugin communication. Gravity, jump height, and keyboard layout are individually configurable per plugin.

---

## File Format

Parkoreen maps use the `.pkrn` extension. A `.pkrn` file is a ZIP archive:

```
my_map.pkrn  (ZIP)
├── data.json            ← map data (or data.dat for compressed)
├── uploaded_img_1.png   ← custom background (optional)
├── uploaded_sound_1.mp3 ← custom music (optional)
└── ...
```

### Map data structure (excerpt)

```json
{
  "version": "2.0",
  "metadata": { "name": "My Map", "objectCount": 42 },
  "settings": {
    "background": "sky",
    "playerSpeed": 5,
    "jumpForce": -14,
    "gravity": 0.8,
    "defaultPortalColor": "#9b59b6",
    "defaultBouncerColor": "#f59e0b",
    "showCoinCounter": true
  },
  "objects": [...]
}
```

Old v1.x `.pkrn` files (JSON-only) are automatically upgraded on import.

---

## Cloudflare Worker

The `cloudflare-worker/` directory contains the backend API (Cloudflare Workers + KV / D1).
See [`cloudflare-worker/README.md`](cloudflare-worker/README.md) for setup and deployment.

---

## Resources

- **Wiki** — `/wiki/` — per-object and per-version documentation
- **Changelog** — `/changelog/` — full version history
- **How to Play** — `/howtoplay/` — new-player guide

---

## License

**PROPRIETARY SOFTWARE — ALL RIGHTS RESERVED**

Copyright © 2026 JimmyQrg

No permission is granted to use, copy, modify, distribute, or create derivative works from this software. See [LICENSE](LICENSE) for full terms.
