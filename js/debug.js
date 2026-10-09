'use strict';
// ---------------------------------------------------------------------------
// Debug mode in the spirit of Project Zomboid's: cheats, spawners and overlays.
// Off unless switched on. Gameplay code checks the flags below.
// ---------------------------------------------------------------------------
const Debug = {
  on: false,
  // cheats read by player.js / zombie.js / actions.js / crafting.js
  god: false, invisible: false, ghost: false, instant: false, build: false, noTire: false, speed: 1,
  drawWorld(ctx, minX, minY, maxX, maxY) { void ctx; void minX; void minY; void maxX; void maxY; },
  drawScreen(ctx, W, H) { void ctx; void W; void H; },
};
