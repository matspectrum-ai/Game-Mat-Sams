# CATastrophe

**Tactics. Mayhem. Treats.**

CATastrophe is a browser-first two-player tactics game: chess-like cat units, destructible and constructible terrain, escalating energy and absurd single-use cards.

## Current vertical slice — v0.2

- 7×7 tactical board.
- Local hot-seat play for Mat × Sams.
- Cinematic intro and illustrated Moon/Sun factions.
- Lord Cat, Knight Cat, Witch Cat and Kitten units.
- HP, attacks and immediate victory when a Lord Cat dies.
- Seven cards:
  - Fish Bomb
  - Swap Places
  - Spilled Milk
  - Yarnado
  - One Orange Braincell
  - Cardboard Fort
  - Zoomies!
- Energy ramps fairly by round from 1 to 5.
- Cardboard Boxes create blocking terrain that can later be destroyed.
- Destroyed terrain and slippery milk tiles change future movement.
- Zoomies deliberately breaks a unit's normal movement rule for one action.
- Deterministic gameplay RNG.
- Pure TypeScript game core with Vitest coverage.
- Phaser 4 renderer separated from game rules.
- Illustrated SVG cat/card assets, VFX, procedural audio cues and victory presentation.

## Stack

- Phaser 4.2.1
- TypeScript 6.0.3
- Vite 8
- Vitest 4
- pnpm 10

## Run locally

```bash
pnpm install
pnpm dev
```

Then open the URL printed by Vite.

## Verify

```bash
pnpm test
pnpm run build
```

## Architecture

```text
Browser / Phaser renderer
        |
        | commands
        v
Pure TypeScript game core
        |
        | deterministic state + events
        v
Renderer / future authoritative server
```

The game core is intentionally independent from Phaser, DOM and future multiplayer infrastructure. Renderer effects consume `GameEvent`s; they do not decide gameplay outcomes.

The determinism contract is:

```text
same state + same command + same seed/RNG step = same result
```

See `docs/game-spec.md` for the v0.2 observable rules and acceptance criteria.

## Deferred until after local playtesting

- Online rooms / Supabase.
- Deckbuilding and random card draw.
- Additional unit classes.
- Accounts, matchmaking and progression.
- Full animation sheets and final audio mix.

The next product decision should come from playtesting the local v0.2 loop, not from adding systems speculatively.
