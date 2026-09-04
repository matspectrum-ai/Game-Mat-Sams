# CATastrophe v0.2 — Playtest Spec

## Goal
Validate whether chess-like positioning + escalating card access + destructible/constructible terrain creates enough tactical tension for repeated two-player matches before online multiplayer and deckbuilding.

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
- Can jump over units, boxes and destroyed tiles.
- Cannot land on boxes or destroyed tiles.

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

### Cardboard Box
- Non-walkable cover created by Cardboard Fort.
- Blocks Witch paths and normal movement.
- Knights may jump across it.
- Fish Bomb and Yarnado may destroy it by converting its tile to Destroyed.

## Cards
Each player starts with one copy of every card. Cards are consumed after successful play.

### Fish Bomb — 2 energy
- Choose a tile.
- Deal 2 damage to every unit in the surrounding 3×3 area, including allies.
- If the center has no unit after damage resolution, convert the center to Destroyed.

### Swap Places — 1 energy
- Choose two distinct units.
- Lord Cats cannot be selected.
- Swap their positions.

### Spilled Milk — 1 energy
- Choose an empty Floor or Milk tile.
- Convert it to Milk.
- Cannot target Destroyed or Cardboard Box tiles.

### Yarnado — 3 energy
- Choose any tile to identify a row.
- Deal 2 damage to every unit in that row.
- Convert every empty tile in that row, including Cardboard Boxes, to Destroyed.

### One Orange Braincell — 2 energy
- Target one of your units.
- Deterministically resolve one of three effects from the match seed/RNG state:
  1. heal 2 HP up to max HP;
  2. suffer 2 damage;
  3. teleport to a deterministic random open tile.

### Cardboard Fort — 2 energy
- Choose an empty Floor or Milk tile.
- Convert it to Cardboard Box.
- Cannot place a box under a unit or on Destroyed terrain.

### Zoomies — 2 energy
- Target one of your non-Lord units and a destination exactly two orthogonal squares away.
- Ignores the unit's normal movement vector and the intermediate tile.
- Destination must be in bounds, empty and walkable.
- Cannot land on Cardboard Box or Destroyed terrain.

## Energy
Energy now creates pacing instead of only card eligibility.

- Round 1: both players have 1 max energy.
- Round 2: both players have 2 max energy.
- Round 3: both players have 3 max energy.
- Round 4: both players have 4 max energy.
- Round 5 onward: both players have 5 max energy.
- At the start of a player's turn, energy refills to that round's max.
- One action per turn remains unchanged in v0.2.

This deliberately makes low-cost manipulation available early while delaying board-wiping cards such as Yarnado.

## Determinism contract
For any command:

`same game state + same command + same seed/RNG step = same result`

No gameplay code may depend on `Math.random()`.

## Acceptance criteria
- Moon and Sun have equal energy at equivalent rounds.
- Legal piece movement is highlighted by the renderer.
- Legal attacks are visually distinguishable.
- Invalid commands do not mutate state or pass the turn.
- Every successful action passes the turn unless the game ends.
- Destroyed tiles and Cardboard Boxes change future legal movement.
- Cardboard Boxes block Witch paths.
- Knights can jump over Cardboard Boxes but cannot land on them.
- Milk affects movement observably.
- Zoomies can reposition a non-Lord unit exactly two orthogonal squares independent of normal movement rules.
- Cards are removed only after successful play.
- Lord death ends the match immediately.
- Deterministic card behavior is covered by tests.
- `npm test` and `npm run build` pass in CI.

## Explicitly deferred
- Online multiplayer / Supabase.
- Deckbuilding, random card draw and discard piles.
- More than four unit classes.
- More than seven cards.
- Persistent progression, accounts, ranked matchmaking.
- Full animation sheets and final audio mix.
