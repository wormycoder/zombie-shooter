# Development notes

This folder holds the development notes: the request list and how releases are made. It ships in the zip so the list travels with the game.

- `TODO.txt` — the request and priority list, with the status of each item and the log of each run of updates.

## Debug mode

Switch it on in Settings > Experimental > Debug mode, or open the game with `?debug` in the address. F2 or the `` ` `` key then shows or hides the debug window: cheats, spawners, time, weather, utilities, teleport (Ctrl+click), player stats and world overlays. In a debug session the What's new window also shows each release's commits. Switched off, none of this exists.

## Versions

Versions are written `xxx.xxx.xxx.xxx`: major (000 during development), minor (features), patch (fixes and polish) and build (the number of commits on the branch up to and including the release commit). Players see them as `v0.24.1 · build 145`.

To release:
1. Add an entry at the top of `VERSION_LOG` in `js/versions.js` (version, date, title, player-facing notes, commits, shots). `VERSION` follows the newest entry.
2. Put its screenshots in `versions/` (`<shot>.jpg`, about 720 px wide); players see them in What's new.
3. Commit, then build the release zip with `git archive --format=zip --prefix=hollow-creek/ -o hollow-creek-<version>.zip HEAD`.
