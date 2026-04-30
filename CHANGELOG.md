# Changelog

The full **Parkoreen** changelog lives in the wiki:

**[wiki/changelog/index.html](wiki/changelog/index.html)** — open in a browser from the repo, or from the deployed site at `wiki/changelog/`.

For line-by-line history, use `git log` and `git show <commit>`.

Latest highlights (see wiki changelog for full details):
- Saw blade multi-select now exposes **Width** and **Height** (in blocks), so multiple saw blades can be resized together; **Damage Amount**, **Spin Direction**, and **Spin Speed** continue to apply across the selection.
- Mechanic block type **Action** has been renamed to **Event** (data, UI labels, default templates). Existing maps with `actions` are auto-migrated to `events` on load.
- Mechanics editor: fixed a crash when picking the **Player Action Input** trigger type (extra block scoping for `switch`-case `const`s, and a missing `area` reference) so per-action options now render reliably.
- Hosting / editing a map no longer fails with `SyntaxError: await is only valid in async functions` (mismatched braces inside `initializePlayMode` were closing the function early).
- Dashboard navigation is now iframe-aware: when the dashboard is embedded in an iframe, opening a map / join page uses `location.href` instead of `_blank`, avoiding popup blocks.
- Added SPA routing for dashboard, mails, settings, howtoplay, and admin pages with bouncy transitions.
- Coin and bouncer now render using `coin.svg` / `bouncer.svg`.
- Bouncer rotate-tool updates now sync bouncer direction/appearance direction.
- Sideways bouncers now launch players sideways reliably.
- Add type (`Add` / `Replace` / `Overlap`) is now available across all add modes (including teleportal, coin, text, zone, spinner, and button).
- Coin snapping: moving/duplicating coins now snaps to the center of the grid block (not top-left).
- Coin bobbing flow: each coin now animates with different timing/phase so they do not move in sync.
- Move & Duplicate tools now also play `tile.ogg` when objects are duplicated or a move is finalized.
- Collected coins now disappear immediately during gameplay (coins are rendered dynamically, not tile-cached).
- HK plugin updates: wall jump height now matches normal jump height, super dash wall collisions freeze the player briefly, and Mantis Claw no longer clings to teleportal, coin, or bouncer objects.
- End points now appear gray only when a coin requirement exists and is unmet.
