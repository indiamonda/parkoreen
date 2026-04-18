# Changelog

The full **Parkoreen** changelog lives in the wiki:

**[wiki/changelog/index.html](wiki/changelog/index.html)** — open in a browser from the repo, or from the deployed site at `wiki/changelog/`.

For line-by-line history, use `git log` and `git show <commit>`.

Latest highlights (see wiki changelog for full details):
- Added SPA routing for dashboard, mails, settings, howtoplay, and admin pages with bouncy transitions.
- Coin and bouncer now render using `coin.svg` / `bouncer.svg`.
- Bouncer rotate-tool updates now sync bouncer direction/appearance direction.
- Sideways bouncers now launch players sideways reliably.
- Add type (`Add` / `Replace` / `Overlap`) is now available across all add modes (including teleportal, coin, text, zone, spinner, and button).
- Coin snapping: moving/duplicating coins now snaps to the center of the grid block (not top-left).
- Coin bobbing flow: each coin now animates with different timing/phase so they do not move in sync.
- Move & Duplicate tools now also play `tile.ogg` when objects are duplicated or a move is finalized.
- Collected coins now disappear immediately during gameplay (coins are rendered dynamically, not tile-cached).
