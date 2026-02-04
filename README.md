# 🏃 Parkoreen

**A multiplayer parkour game where you build your own maps and challenge friends!**

Build creative parkour courses, test them yourself, then host games and race against others in real-time. Share your maps and get them featured!

![Parkoreen](https://img.shields.io/badge/version-1.0.0-green) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [Getting Started](#-getting-started)
- [Editor Guide](#-editor-guide)
  - [Interface Overview](#interface-overview)
  - [Navigation & Camera](#navigation--camera)
  - [Toolbar Tools](#toolbar-tools)
  - [Adding Objects](#adding-objects)
  - [Layers Panel](#layers-panel)
  - [Configuration](#configuration)
- [Playing the Game](#-playing-the-game)
- [Multiplayer](#-multiplayer)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [File Format](#-file-format)
- [Deployment](#-deployment)
- [License](#-license)

---

## ✨ Features

- 🎮 **2D Platformer Physics** - Smooth movement, jumping, and collision detection
- 🏗️ **Powerful Map Editor** - Create complex parkour courses with ease
- 👥 **Real-time Multiplayer** - Race against friends with live position sync
- 💾 **Cloud Storage** - All your maps are saved online
- 📤 **Export/Import** - Share maps as `.pkrn` files
- 📱 **Touchscreen Support** - Play on mobile devices
- 🌐 **PWA Support** - Install as a standalone app

---

## 🚀 Getting Started

### Creating an Account

1. Visit the game at `https://jimmyqrg.github.io/parkoreen/`
2. Click **Sign Up** to create a new account
3. Enter your **Display Name** (how others see you), **Username** (unique, cannot be changed), and **Password**
4. Click **Create Account**

### Your Dashboard

After logging in, you'll see your **Dashboard** with all your maps:

- **Join** - Enter a game code to join someone else's room
- **Settings** - Adjust volume and touchscreen mode
- **New Map** - Create a fresh map to start building

Each map card shows:
- 🏠 **Host** - Start a multiplayer game with this map
- ✏️ **Edit** - Open the map in the editor
- 🗑️ **Delete** - Remove the map (requires confirmation)

---

## 🛠️ Editor Guide

The editor is where you'll spend most of your time creating amazing parkour courses!

### Interface Overview

When you open the editor, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│ [⚙ Config]                              [⚙ Settings]    │
│                                                         │
│                                                         │
│                    GAME CANVAS                          │
│                  (your map here)                        │
│                                                         │
│                                                         │
│ [+ Add]                                    [≡ Layers]   │
│                                                         │
│        [  Fly  | Move | Dup | Rot | + | - | Erase ]     │
└─────────────────────────────────────────────────────────┘
```

#### Corner Buttons

| Position | Icon | Function |
|----------|------|----------|
| Top-Left | 🔧 Build | Opens **Config Panel** (test game, theme, player settings, hosting) |
| Top-Right | ⚙️ Settings | Opens **Settings Panel** (volume, touchscreen mode) |
| Bottom-Left | ➕ Add | Opens **Add Menu** (place blocks, koreens, text) |
| Bottom-Right | 📚 Layers | Opens **Layers Panel** (view and manage all objects) |

---

### Navigation & Camera

#### Moving Around the Map

| Action | Method |
|--------|--------|
| **Pan Camera** | Enable Fly mode (press `G`), then click and drag |
| **Zoom In** | `Ctrl/Cmd + Scroll Up` or click Zoom In button |
| **Zoom Out** | `Ctrl/Cmd + Scroll Down` or click Zoom Out button |

The editor displays a **grid overlay** to help you align objects. Each grid cell is 32×32 pixels.

---

### Toolbar Tools

The toolbar at the bottom provides quick access to essential tools:

#### 🛫 Fly Mode (G)

- **Purpose**: Move freely around your map without gravity
- **How to use**: 
  1. Press `G` or click the Fly button
  2. Click and drag to pan the camera
  3. Press `Escape` or `G` again to disable

#### ↔️ Move Tool (M)

- **Purpose**: Reposition existing objects
- **How to use**:
  1. Press `M` or click the Move button
  2. Click on any object in your map
  3. The object follows your mouse
  4. Click again to place it, or press `Escape` to cancel

#### 📋 Duplicate Tool (C)

- **Purpose**: Copy an existing object
- **How to use**:
  1. Press `C` or click the Duplicate button
  2. Click on any object to create a copy
  3. The copy follows your mouse
  4. Click to place the duplicate

#### 🔄 Rotator (R)

- **Purpose**: Rotate objects 90° counter-clockwise
- **How to use**:
  1. Press `R` or click the Rotator button
  2. Click on any object to rotate it
  3. Each click rotates by 90°

#### 🔍 Zoom In / Zoom Out

- **Purpose**: Adjust the view scale
- **Shortcut**: `Ctrl/Cmd + Mouse Wheel`
- Zoom range: 50% to 200%

#### 🧹 Quick Eraser

- **Purpose**: Rapidly delete objects
- **How to use**:
  1. Click the Eraser button to enable
  2. Click and drag across objects to delete them
  3. Press `Escape` to disable
- **Note**: The eraser won't work when your mouse is over a UI button

---

### Adding Objects

Click the **Add** button (bottom-left) to open the Add Menu:

#### 🟫 Block

Blocks are the foundation of your map - platforms, walls, and obstacles.

When you select **Block**, the placement toolbar appears with these options:

| Option | Values | Description |
|--------|--------|-------------|
| **Appearance** | Ground, Spike | How the block looks visually |
| **Acting Type** | Ground, Spike, Checkpoint, Spawnpoint, Endpoint | How the block behaves |
| **Collision** | On, Off | Whether players can collide with it |
| **Fill** | Add, Replace | Add only to empty cells, or replace existing objects |
| **Color** | Any hex color | Click the color preview to open the color picker |
| **Opacity** | 0% - 100% | Transparency level |

**Acting Types Explained:**

- **Ground**: Normal solid surface - players can stand on it and collide with it
- **Spike**: Hurts players on contact (resets them to checkpoint/spawn)
- **Checkpoint**: Saves player's progress - they respawn here after dying
- **Spawnpoint**: Where players start the game (you need exactly one!)
- **Endpoint**: The finish line - reaching this wins the game

**Pro Tips:**
- A spike that *looks* like ground can be a tricky trap!
- A ground block that *looks* like a spike can be a fake-out
- Use collision OFF for decorative elements

#### 🔷 Koreen

Koreens are special marker objects for game mechanics.

| Option | Values | Description |
|--------|--------|-------------|
| **Appearance** | Checkpoint, Spawnpoint, Endpoint | Visual style |
| **Acting Type** | Ground, Spike, Checkpoint, Spawnpoint, Endpoint, Text | Behavior |
| **Fill** | Add, Replace | Placement mode |
| **Opacity** | 0% - 100% | Transparency |

**When to use Koreens:**
- When you want the classic checkpoint flag appearance
- When you want a spawn/end marker that doesn't look like a block

#### 📝 Text Box

Add text labels, signs, or decorations to your map.

| Option | Values | Description |
|--------|--------|-------------|
| **Content** | Any text | What the text says |
| **Acting Type** | Ground, Spike, Checkpoint, Spawnpoint, Endpoint, Text | Behavior (usually "Text" for no collision) |
| **Font** | Google Fonts | Choose from 50+ fonts |
| **Color** | Any hex color | Text color |
| **Opacity** | 0% - 100% | Transparency |
| **H-Align** | Left, Center, Right | Horizontal text alignment |
| **V-Align** | Top, Center, Bottom | Vertical text alignment |
| **H-Spacing** | Percentage | Horizontal offset |
| **V-Spacing** | Percentage | Vertical offset |

**Font Selection:**
- Click the font dropdown to see all available fonts
- Use the search bar to find specific fonts
- Recently used fonts appear at the top for quick access
- Click the ✕ next to a recent font to remove it from the list

#### Placing Objects

1. Select your object type and configure options
2. Move your mouse to the desired location (green preview shows placement)
3. Click to place the object
4. Objects snap to the grid automatically
5. Press `Escape` or click the ✕ button (top-left) to exit placement mode

---

### Layers Panel

The Layers Panel (bottom-right button) shows all objects in your map:

```
┌─────────────────────────────────────────┐
│ Layers                              [✕] │
├─────────────────────────────────────────┤
│ ≡ Block_001           [🗑] [↑][—][↓]    │
│ ≡ Spike_002           [🗑] [↑][—][↓]    │
│ ≡ Checkpoint_003      [🗑] [↑][—][↓]    │
│ ≡ Spawnpoint_004      [🗑] [↑][—][↓]    │
└─────────────────────────────────────────┘
```

#### Layer Controls

| Icon | Function |
|------|----------|
| ≡ (drag handle) | Drag to reorder objects |
| 🗑️ Delete | Remove this object |
| ↑ Arrow Up | Render **above** the player |
| — Line | Render on the **same layer** as the player |
| ↓ Arrow Down | Render **behind** the player |

#### Layer Order Matters!

- Objects at the **top** of the list render **on top** of objects below
- Drag objects to reorder them visually
- Use the arrow buttons to control whether objects appear in front of or behind the player

---

### Configuration

Click the **Config** button (top-left) to access game settings:

#### 🎮 Test Game

Click **Test Game** to try your map immediately!
- You'll spawn at the spawnpoint
- Play through to test difficulty and flow
- Click the **Stop** button (bottom-right) to return to editing

**Requirement:** You must have a spawnpoint placed to test!

#### 🎨 Theme Settings

| Setting | Description |
|---------|-------------|
| **Background** | Choose between Sky or Galaxy |
| **Default Block Color** | New blocks will use this color |
| **Default Spike Color** | New spikes will use this color |
| **Default Text Color** | New text will use this color |

**Note:** Changing defaults doesn't affect existing objects!

#### 🏃 Player Settings

| Setting | Description |
|---------|-------------|
| **Jumps** | Set Number or Infinite |
| **Number of Jumps** | How many times the player can jump (if not infinite) |
| **Additional Airjump** | If ON: all jumps available in air. If OFF: 1 jump on ground, rest in air |
| **Collide with Each Other** | Whether players can bump into each other in multiplayer |

**Jump Examples:**
- Jumps = 1, Additional Airjump OFF: Classic single jump
- Jumps = 2, Additional Airjump OFF: 1 ground jump + 1 air jump (double jump)
- Jumps = 3, Additional Airjump ON: 3 jumps anytime (even if you walk off a ledge)
- Jumps = Infinite: Fly anywhere!

#### 📤 Export & Import

- **Export**: Download your map as a `.pkrn` file
- **Import**: Load a `.pkrn` file (replaces current map!)

Share `.pkrn` files with friends to let them play or edit your maps!

#### 🌐 Host Game

Configure multiplayer settings:

| Setting | Description |
|---------|-------------|
| **Max Player Amount** | 1 to 999,999 players |
| **Use Password** | Require a password to join |
| **Custom Password** | The password players must enter |

Click **Host Game** to start! Requirements:
- ✅ Must have a spawnpoint
- ✅ If password enabled, it can't be empty

You'll receive a **6-character room code** to share with friends.

---

## 🎮 Playing the Game

### Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move Left | `A` or `←` | Left D-pad |
| Move Right | `D` or `→` | Right D-pad |
| Jump | `W`, `↑`, or `Space` | Jump button |
| Move Up (Fly mode) | `W`, `↑`, or `space` | Up D-pad |
| Move Down (Fly mode) | `S`, `↓`, or `shift` | Down D-pad |

### Game HUD

During gameplay, you'll see:

- **Top-Left**: Leave button (exit to dashboard)
- **Top-Right**: Settings button
- **Top-Center**: Room code (in multiplayer)
- **Bottom-Left**: Chat button
- **Bottom-Right**: Players list button

### Touchscreen Mode

Enable in Settings for on-screen controls:
- **D-pad** (bottom-left): Movement arrows
- **Jump button** (bottom-right): Large jump button

---

## 👥 Multiplayer

### Hosting a Game

1. Open your map in the editor
2. Click **Config** → **Host Game**
3. Set max players and optional password
4. Click **Host Game**
5. Share the 6-character room code with friends

### Joining a Game

1. From the Dashboard, click **Join**
2. Enter the 6-character room code
3. Enter password if required
4. Click **Join**

### In-Game Features

- **Player List**: See all players and their colors
- **Chat**: Send messages to other players
- **Kick** (Host only): Remove players from the room

### Important Notes

- If the host leaves, **everyone is kicked** and the room closes
- Each player gets a random color when joining
- The game ends when any player reaches the endpoint

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Toggle Fly mode |
| `M` | Move tool |
| `C` | Duplicate tool |
| `R` | Rotate object under cursor |
| `Escape` | Cancel current action / Close panels |
| `Ctrl/Cmd + Scroll` | Zoom in/out |

---

## 📁 File Format

Parkoreen maps use the `.pkrn` file extension (JSON format):

```json
{
  "version": "1.0",
  "metadata": {
    "name": "My Awesome Map",
    "createdAt": "2026-01-29T12:00:00.000Z",
    "objectCount": 42
  },
  "settings": {
    "background": "sky",
    "defaultBlockColor": "#787878",
    "defaultSpikeColor": "#c45a3f",
    "defaultTextColor": "#000000",
    "maxJumps": 2,
    "infiniteJumps": false,
    "additionalAirjump": false,
    "collideWithEachOther": true
  },
  "objects": [
    {
      "id": "obj_123",
      "x": 0,
      "y": 0,
      "w": 32,
      "h": 32,
      "t": "block",
      "at": "ground",
      "act": "ground",
      "col": 1,
      "c": "#787878",
      "o": 1,
      "l": 1,
      "r": 0,
      "n": "Block"
    }
  ]
}
```

---

## 🚀 Deployment

### Frontend (GitHub Pages)

1. Push to your GitHub repository
2. Go to **Settings** → **Pages**
3. Select your branch and save
4. Access at `https://jimmyqrg.github.io/parkoreen/`

### Backend (Cloudflare Workers)

1. Install Wrangler: `npm install -g wrangler`
2. Navigate to the worker folder
3. Create KV namespaces:
   ```bash
   wrangler kv:namespace create "USERS"
   wrangler kv:namespace create "MAPS"
   wrangler kv:namespace create "SESSIONS"
   ```
4. Update `wrangler.toml` with your namespace IDs
5. Deploy: `wrangler deploy`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

Created by **JimmyQrg** © 2026

- [GitHub](https://github.com/jimmyqrg/)

---

**Happy Parkour-ing! 🏃‍♂️💨**
