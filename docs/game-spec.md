# CATastrophe v0.1 — Vertical Slice Spec

## Goal
Validate whether chess-like positioning + single-use chaos cards + destructible terrain creates a fun two-player loop before investing in final art or multiplayer.

## Match
- Board: 7×7.
- Players: Moon and Sun.
- Moon starts.
- One action per turn: move, attack, or play one card.
- Successful actions end the turn.
- Destroy the enemy Lord Cat to win.

## Units
### Lord Cat
- 8 HP, 2 attack.
- Moves/attacks one square in any direction.
- If killed, its owner immediately loses.

### Knight Cat
- 3 HP, 2 attack.
- Chess-knight L movement.
- Can jump over units and destroyed tiles.

### Witch Cat
- 2 HP, 2 attack.
- Moves/attacks diagonally 1–3 squares.
- Path must be clear and walkable.

### Kitten
- 1 HP, 1 attack.
- Moves/attacks one square forward toward the opponent.

## Terrain
### Floor
Normal walkable tile.

### Destroyed
Cannot be entered. Knight movement may jump across it but may not land on it.

### Milk
Walkable. A non-knight entering it slides one additional square in the same direction if that square is walkable and empty.

## Cards
Each player starts with one copy of each card. Cards are consumed after successful play.

### Fish Bomb — 2 energy
- Choose a tile.
- Deal 2 damage to every unit in the surrounding 3×3 area, including allies.
- If the center is empty after damage resolution, destroy that tile.

### Swap Places — 1 energy
- Choose two distinct units.
- Lord Cats cannot be selected.
- Swap their positions.

### Spilled Milk — 1 energy
- Choose a non-destroyed tile.
- Convert it to Milk.

### Yarnado — 3 energy
- Choose any tile to identify a row.
- Deal 2 damage to every unit in that row.
- Destroy every empty tile in that row after damage resolution.

### One Orange Braincell — 2 energy
- Target one of your units.
- Deterministically resolve one of three effects from the match seed/RNG state:
  1. heal 2 HP up to max HP;
  2. suffer 2 damage;
  3. teleport to a deterministic random open tile.

## Energy
- Each player has 3 max energy.
- Active player starts/refills the turn at 3 energy.
- Since v0.1 allows one action per turn, energy currently differentiates card eligibility rather than supporting multi-card turns.
- Revisit this after playtesting; do not expand the energy system until it produces meaningful decisions.

## Determinism contract
For any command:

`same game state + same command + same seed/RNG step = same result`

No gameplay code may depend on `Math.random()`.

## Acceptance criteria
- Legal piece movement is highlighted by the renderer.
- Legal attacks are visually distinguishable.
- Invalid commands do not mutate state or pass the turn.
- Every successful action passes the turn unless the game ends.
- Destructible tiles change future legal movement.
- Milk affects movement observably.
- Cards are removed only after successful play.
- Lord death ends the match immediately.
- Deterministic card behavior is covered by tests.
- `npm test` and `npm run build` pass in CI.

## Explicitly deferred
- Online multiplayer / Supabase.
- Deckbuilding and card draw.
- More than four unit classes.
- More than five cards.
- Final hand-drawn assets and animation sheets.
- Sound/music.
- Matchmaking/accounts/ranked play.
- Persistent progression.
