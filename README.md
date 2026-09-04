# CATastrophe

**Tactics. Mayhem. Treats.**

CATastrophe is a browser-first two-player tactical board game: chess-inspired movement, destructible terrain, illustrated cat factions and absurd rule-breaking cards.

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
- Illustrated SVG cat assets for Moon and Sun factions.
- Illustrated card art.
- Event-driven VFX for movement, attacks, cards, destruction and victory.
- Lightweight procedural Web Audio feedback.
- Cinematic Mat × Sams match intro.

## Stack
- Phaser 4.2.1
- TypeScript 6.0.3
- Vite 8
- Vitest 4

## Run locally
```bash
pnpm install
pnpm dev
```

Then open the URL printed by Vite.

## Verify
```bash
pnpm test
pnpm build
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

See `docs/game-spec.md` for the current observable rules and acceptance criteria.

## Status
This is an artistic gameplay vertical slice. The rules engine, event pipeline, illustrated factions, cards, VFX and local two-player loop are functional. Online rooms, authoritative multiplayer and final production-quality hand-drawn asset production remain future phases after playtesting the core loop.
