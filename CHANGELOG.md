# Changelog

All notable changes to **Parkoreen** are summarized here. **[Current] - Unreleased** is the moving tip on `next` / `v0.4-Indev`. Numbered **v1.x** sections align with historical git branch milestones (see reference table at the bottom). Entries are grouped from `git log` (newest first).

---

## [Current] - Unreleased

Development on `origin/next` (after the `v0.3` merge); not yet cut as a numbered v1.x release.

### Admin & moderation
- Admin panel: users, rooms, **maps** tab; scrolling; fixes for access and layout.
- **Parkoreen** admin welcome flow; admin chat commands in-game.
- **Maps**: list/detail, rename/delete, room↔map linkage; admin edit/host flows.
- **Reserved official names** handling; role-based admin powers.

### Editor & maps
- **Undo / redo** for editor actions.
- **Spawn & end** markers: dedicated add-menu tool; “Koreen” add-menu label → **Game Item**.
- **Saw blades**: size unit controls, **spin direction**, damage amount; spinning behavior tied to rotation; updated blade artwork.
- **Damage amount** on spikes/saw blades; touchbox tuning (gaps, teleportal size, tester tool, invincibility testing).
- **Plugin logic** fixes; **three-dots** / HUD menu fixes.
- Sample map updates; **download map** from dashboard; default value tweaks.

### Gameplay & plugins
- **Hollow Knight** plugin: attack range/speed, controllable jump, keyboard fixes, **CJ** plugin addition.
- **Teleportals**: particle effects, collision/touch fixes.
- HP bar appearance; HP-related fixes; **pogo** / movement fixes.
- **Space** fly-up removed; **space** fly speed boost; fly movement and performance improvements.
- Lower max fall speed; text position and color-picker fixes.

### Clouds & backgrounds
- More **cloud SVG** variants and loader updates; cloud generation behavior changes.
- Grid + cloud rendering fixes.

### Account & UI
- **Auto log-out** when unauthorized.
- **Keyboard** settings moved into Parkoreen settings; dashboard scrolling.
- Editor (`editor.js`) updates.

---

## v1.4

_Git range: `origin/v0.2` → `origin/v0.3`._

### Added
- **Saw blade** obstacle (in spike workflow); **Variable** mechanic block type.
- **Block textures** (brick etc.) with texture preview in UI.
- **Buttons** (interactive).
- **Multi-selection**; **object inspector**; **rotate left** control.
- **Heal at checkpoints** option.
- **Cloud** placement tweaks and **sky / galaxy cloud color** settings.
- **UI transitions**; stacking fixes.

### Fixed
- Cloud rendering (several passes).
- Spike-related issues (“fix spiles”); downward movement; dash distance experiment.
- Index / entry page update.

---

## v1.3

_Git range: `origin/V0.1` → `origin/v0.2`._

### Added
- **Plugin system**: Hollow Knight–style plugin, **HP** plugin assets, **Code** plugin (BETA) with loader/inject tooling.
- **Load bar** for asset loading; improved portals and spike visuals; **cover** art / icons.
- **Mobile-friendly** adjustments; touchscreen support for HK plugin.
- **Soul statue** improvements; **Mantis Claw**–style ability; attack fixes.
- Plugin **gravity** and jump-height tuning; `color.js` and globals/inject scripts.
- Asset layout: HK/HP/Code plugin folders (SVG, PNG, TTF renames).

### Changed / fixed
- Camera fluency reduced (performance); lag fixes; HK injector fixes.
- **GOBOY** hint reference; better hint copy.
- Various HK plugin stability fixes.

---

## v1.2

_Git range: `origin/V0.0` → `origin/V0.1`. (Historical tip commit: “finish V1.1.0”.)_

### Added
- **Zones**, **teleportals**, **checkpoint** animation.
- **Portals** (major milestone).
- **Font size** settings; **horizontal flip**; larger position values; show position.
- Stronger **touchscreen** support and scrolling fixes.

### Fixed
- Large “huge fix” passes; TypeError fixes; font chooser position.

---

## v1.1

_Git range: initial commit → `origin/V0.0`._

### Added
- **Core game**: blocks, physics, fly mode, editor, hosting, **multiplayer** rooms.
- **Authentication**: signup/login flows (many iterative fixes).
- **Map persistence**: save cadence, save on close/leave.
- **Spikes**, collision, touchbox options; **layers**; **eraser** options.
- **End game** flow; smooth positions; username rules; room player list fixes.
- **Icons**; Parkoreen / Tektur → **Parkoreen Game** font branding.
- **README**, **LICENSE**; layer/fly documentation.

### Fixed
- Editor/host/join issues; jump issues; font selection; rotate key.
- Layers preview; color picking; accidental keyboard capture in inputs.

---

## Changelog version ↔ git branches

| Changelog | Git branch tip (on `origin`) |
|-----------|------------------------------|
| **[Current] - Unreleased** | `next`, `v0.4-Indev` |
| **v1.4** | `v0.3` |
| **v1.3** | `v0.2` |
| **v1.2** | `V0.1` |
| **v1.1** | `V0.0` |

`main` may differ; use `git log main..next` to compare. There are **no git tags** tied to v1.x in-repo; these labels are **documentation mapping** only.

### Regenerating detail

```bash
git log --oneline origin/v0.2..origin/v0.3    # v1.4
git log --oneline origin/V0.1..origin/v0.2    # v1.3
git log --oneline origin/V0.0..origin/V0.1    # v1.2
git log --oneline <initial>..origin/V0.0      # v1.1
git log --oneline origin/v0.3..origin/next  # Current
```

---

_Changelog assembled from `git log` across `origin` branches. For exact file-level diffs, use `git show <commit>`._
