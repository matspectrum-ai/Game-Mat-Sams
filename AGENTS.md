# CATastrophe repository instructions

## Product goal
CATastrophe is a browser-first, two-player tactical board game: chess-like positional play plus cards, destructible terrain and intentionally absurd cat-themed effects.

## Architecture invariant
Keep the deterministic game rules independent from Phaser, DOM, networking and persistence.

- `src/core/**`: pure TypeScript game state, commands, validation, deterministic RNG and events.
- `src/game/**`: Phaser renderer/input adapter. It may ask the core what is legal; it must not invent rules.
- Browser UI may submit commands but never mutate authoritative game state directly.
- Future multiplayer/server code must call the same core command API used by the local prototype.

## Required loop
Observe -> Plan -> Act -> Verify -> Iterate.

For rule changes:
1. Update/clarify the observable rule.
2. Add or update a test in `src/core/*.test.ts`.
3. Change the smallest core surface necessary.
4. Run `npm test` and `npm run build`.
5. Only then adjust renderer animation/UI if needed.

## Determinism
- Never use `Math.random()` for gameplay.
- Random gameplay must derive from `GameState.seed` + deterministic RNG state.
- Same state + same command + same seed must produce the same next state and events.

## Multiplayer safety
Clients will eventually send intents (`move`, `attack`, `play_card`), not trusted state snapshots. Server-side validation will be authoritative.

## Scope discipline
Before expanding content, prove the current loop is fun. Prefer a few highly interactive pieces/cards over a large content catalog.

## Commands
- `npm run dev`
- `npm test`
- `npm run build`
