# Development notes

This folder is for development only. It is left out of release builds (`git archive` skips it, see `.gitattributes`).

- `TODO.txt` — the request and priority list, with the status of each item and the log of each run of updates.
- `versions/` — screenshots for each release, named `<shot>.jpg` (about 720 px wide), listed in the `shots` of its `VERSION_LOG` entry.

## Debug mode

Open the game with `?debug` in the address (for example `index.html?debug`). F2 or the `` ` `` key then shows or hides the debug window: cheats, spawners, time, weather, utilities, teleport (Ctrl+click), player stats and world overlays. In a debug session the What's new window also shows each release's screenshots and commits. Without `?debug` none of this exists.

## Versions

Versions are written `xxx.xxx.xxx.xxx`: major (000 during development), minor (features), patch (fixes and polish) and build (the number of commits on the branch up to and including the release commit). Players see them as `v0.24.1 · build 145`.

To release:
1. Add an entry at the top of `VERSION_LOG` in `js/versions.js` (version, date, title, player-facing notes, commits, shots). `VERSION` follows the newest entry.
2. Put its screenshots in `dev/versions/`.
3. Commit, then build the release zip with `git archive --format=zip --prefix=hollow-creek/ -o hollow-creek-<version>.zip HEAD`.
