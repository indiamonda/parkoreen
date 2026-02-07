# 🏃 Parkoreen

**A multiplayer parkour game where you build your own maps and challenge friends!**

Build creative parkour courses, test them yourself, then host games and race against others in real-time.

![Parkoreen](https://img.shields.io/badge/version-2.0.0-green) ![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 📋 Table of Contents

- [Features](#-features)
- [Getting Started](#-getting-started)
- [Editor Guide](#-editor-guide)
- [Playing the Game](#-playing-the-game)
- [Multiplayer](#-multiplayer)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [File Format](#-file-format)
- [License](#-license)

---

## ✨ Features

- 🎮 **2D Platformer Physics** - Smooth movement, jumping, and collision detection
- 🏗️ **Powerful Map Editor** - Create complex parkour courses with ease
- 👥 **Real-time Multiplayer** - Race against friends with live position sync
- 💾 **Cloud Storage** - All your maps are saved online
- 📤 **Export/Import** - Share maps as `.pkrn` files (ZIP-based format)
- 📱 **Touchscreen Support** - Play on mobile devices
- 🎨 **Customizable Checkpoints** - Set custom colors for checkpoint states
- 🎵 **Background Music** - Built-in tracks or upload your own
- 🖼️ **Custom Backgrounds** - Images, GIFs, or videos as backgrounds
- 🏷️ **Zones** - Define named rectangular regions for scripting
- ⚙️ **Physics Settings** - Customize player speed, jump height, and gravity

---

## 🚀 Getting Started

### Creating an Account

1. Visit the game
2. Click **Sign Up** to create a new account
3. Enter your **Display Name**, **Username**, and **Password**
4. Click **Create Account**

### Your Dashboard

After logging in, you'll see your **Dashboard** with all your maps:

- **Join** - Enter a game code to join someone else's room
- **Settings** - Adjust volume and touchscreen mode
- **New Map** - Create a fresh map to start building

Each map card shows:
- 🏠 **Host** - Start a multiplayer game with this map
- ✏️ **Edit** - Open the map in the editor
- 📋 **Duplicate** - Create a copy of the map
- 🗑️ **Delete** - Remove the map (requires confirmation)

---

## 🛠️ Editor Guide

### Interface Overview

When you open the editor, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│ [⚙ Config]                              [⚙ Settings]    │
│                                                         │
│                    GAME CANVAS                          │
│                  (your map here)                        │
│                                                         │
│ [+ Add]                                    [≡ Layers]   │
│                                                         │
│        [  Fly  | Move | Dup | Rot | + | - | Erase ]     │
└─────────────────────────────────────────────────────────┘
```

### Navigation

| Action | Method |
|--------|--------|
| **Pan Camera** | Enable Fly mode (`G`), then click and drag |
| **Zoom In** | `Ctrl/Cmd + Scroll Up` or click `+` button |
| **Zoom Out** | `Ctrl/Cmd + Scroll Down` or click `-` button |

### Toolbar Tools

| Tool | Key | Description |
|------|-----|-------------|
| **Fly** | `G` | Move freely around the map |
| **Move** | `M` | Reposition existing objects |
| **Duplicate** | `C` | Copy an existing object |
| **Rotate** | `R` | Rotate objects 90° counter-clockwise |
| **Erase** | - | Delete objects (options: All, Top Layer, Bottom Layer) |

### Adding Objects

Click **Add** to open the placement menu:

#### 🟫 Block
Solid platforms and obstacles with options:
- **Appearance**: Ground or Spike
- **Acting Type**: Ground, Spike, Checkpoint, Spawnpoint, Endpoint
- **Collision**: On/Off
- **Fill Mode**: Add, Replace, or Overlap (place on top of existing)

#### 🔷 Koreen
Special marker objects:
- Checkpoint flags
- Spawn points
- End points
- **Zones**: Named rectangular regions (click & drag to place)

#### 📝 Text
Text labels with customizable font, alignment, and spacing.

### Configuration Panel

Access via the Config button (top-left):

#### Game Settings
- **Test Game** - Try your map instantly
- **Map Name** - Set the map's display name
- **Background** - Sky, Galaxy, or Custom (image/video)

#### Physics
- **Player Speed** - Movement speed (default: 5)
- **Jump Height** - Jump force (default: -14)
- **Gravity** - Fall speed modifier (default: 0.8)

#### Player Settings
- **Jumps** - Set number or infinite
- **Additional Airjump** - All jumps available in air
- **Collide with Each Other** - Player collision in multiplayer

#### Checkpoint Colors
- **Default Color** - Untouched checkpoints (gray)
- **Active Color** - Current checkpoint (green)
- **Already Checked** - Previously touched (blue)

#### Spike Behavior
Configure how spikes interact with players:
- **Full Spike** - Entire spike is dangerous
- **Normal Spike** - Flat base is ground, rest damages
- **Tip Spike** - Only peak damages
- **Ground** - Acts as solid ground
- **Flag** - Flat part is ground, rest passes through
- **Air** - No collision at all

#### Music
- Built-in tracks or upload custom music
- Volume control and loop toggle

#### Export/Import Settings
- **Data Type**: `.json` (readable) or `.dat` (compressed)

---

## 🎮 Playing the Game

### Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move Left | `A` or `←` | D-pad Left |
| Move Right | `D` or `→` | D-pad Right |
| Jump | `W`, `↑`, or `Space` | Jump button |
| Fly Up | `W` or `↑` (in fly mode) | D-pad Up |
| Fly Down | `S` or `↓` (in fly mode) | D-pad Down |

### Test Mode

- Press `G` to toggle fly mode during testing
- Fly mode is OFF by default when starting a test

---

## 👥 Multiplayer

### Hosting a Game

1. Open your map in the editor
2. Click **Config** → **Host Game**
3. Set max players and optional password
4. Click **Host Game**
5. Share the 6-character room code

### Joining a Game

1. From Dashboard, click **Join**
2. Enter the room code
3. Enter password if required
4. Click **Join**

### Player Colors

Each player gets a unique color automatically calculated to be maximally different from other players in the room.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Toggle Fly mode |
| `M` | Move tool |
| `C` | Duplicate tool |
| `R` | Rotate selected object |
| `Escape` | Cancel current action / Close panels |
| `Ctrl/Cmd + Scroll` | Zoom in/out |

---

## 📁 File Format

Parkoreen maps use the `.pkrn` file extension.

### Version 2.0 Format

`.pkrn` files are ZIP archives containing:

```
map_name.pkrn (ZIP)
├── data.json          (or data.dat for compressed)
├── uploaded_img_1.png (custom backgrounds)
├── uploaded_sound_1.mp3 (custom music)
└── ...
```

### Data Structure

```json
{
  "version": "2.0",
  "metadata": {
    "name": "My Map",
    "createdAt": "2026-02-07T00:00:00.000Z",
    "objectCount": 42
  },
  "settings": {
    "background": "sky",
    "defaultBlockColor": "#787878",
    "defaultSpikeColor": "#c45a3f",
    "checkpointDefaultColor": "#808080",
    "checkpointActiveColor": "#4CAF50",
    "checkpointTouchedColor": "#2196F3",
    "playerSpeed": 5,
    "jumpForce": -14,
    "gravity": 0.8,
    "spikeTouchbox": "normal",
    "storedDataType": "json"
  },
  "objects": [...]
}
```

### Backward Compatibility

Old `.pkrn` files (v1.x JSON format) are still supported and will be automatically upgraded on import.

---

## 📄 License

**PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**

Copyright (c) 2026 JimmyQrg

This software and all associated files are the exclusive property of JimmyQrg. No permission is granted to use, copy, modify, distribute, or create derivative works from this software.

See the [LICENSE](LICENSE) file for full terms.

---

## 🙏 Credits

Created by **JimmyQrg** © 2026

---

**Happy Parkour-ing! 🏃‍♂️💨**
