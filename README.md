# CATastrophe

**Tactics. Mayhem. Treats.**

CATastrophe is a browser-first two-player tactics prototype: chess-like pieces, destructible terrain and absurd cat-themed cards.

## Current vertical slice
- 7×7 tactical board.
- Local hot-seat play for two players.
- Lord Cat, Knight Cat, Witch Cat and Kitten units.
- HP, attacks and immediate victory when a Lord Cat dies.
- Five single-use cards: Fish Bomb, Swap Places, Spilled Milk, Yarnado and One Orange Braincell.
- Destroyed terrain and slippery milk tiles.
- Deterministic gameplay RNG.
- Pure TypeScript game core with Vitest coverage.
- Phaser 4 renderer separated from game rules.

## Stack
- Phaser 4.2.1
- TypeScript 7
- Vite 8
- Vitest 4

## Run locally
```bash
npm install
npm run dev
```

Then open the URL printed by Vite.

## Verify
```bash
npm test
npm run build
```

## Architecture
```text
Browser / Phaser
      |
      | commands
      v
Pure TypeScript game core
      |
      | deterministic state + events
      v
Renderer / future authoritative server
```

The game core is intentionally independent from Phaser, DOM and future Supabase code. Multiplayer will reuse the same command-validation layer rather than trusting client state.

See `docs/game-spec.md` for the v0.1 observable rules and acceptance criteria.

## Status
This is a gameplay-first vertical slice. The current board uses temporary procedural/typographic cat pieces. Final hand-drawn 2D art, animation, sound and online rooms are deliberately deferred until the core loop proves fun.
