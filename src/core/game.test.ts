import { describe, expect, it } from 'vitest';
import { applyCommand, createInitialState, getLegalMoves } from './game';

describe('CATastrophe game core', () => {
  it('starts with Moon, full Lord HP, seven cards and round-one energy', () => {
    const state = createInitialState(7);
    expect(state.activePlayer).toBe('moon');
    expect(state.players.moon.hp).toBe(8);
    expect(state.players.sun.hp).toBe(8);
    expect(state.players.moon.hand).toHaveLength(7);
    expect(state.players.sun.hand).toHaveLength(7);
    expect(state.players.moon.energy).toBe(1);
    expect(state.players.sun.energy).toBe(1);
  });

  it('keeps knight movement chess-like and allows jumping', () => {
    const state = createInitialState();
    const moves = getLegalMoves(state, 'moon-knight');
    expect(moves).toContainEqual({ x: 0, y: 4 });
    expect(moves).toContainEqual({ x: 2, y: 4 });
  });

  it('moves a unit and passes the turn deterministically', () => {
    const state = createInitialState();
    const result = applyCommand(state, {
      type: 'move',
      player: 'moon',
      unitId: 'moon-knight',
      to: { x: 2, y: 4 },
    });

    expect(result.ok).toBe(true);
    expect(result.state.activePlayer).toBe('sun');
    expect(result.state.units.find((unit) => unit.id === 'moon-knight')?.position).toEqual({ x: 2, y: 4 });
  });

  it('ramps both players energy equally by round up to five', () => {
    let state = createInitialState();

    const moves = [
      ['moon', 'moon-knight', { x: 2, y: 4 }],
      ['sun', 'sun-knight', { x: 2, y: 2 }],
      ['moon', 'moon-knight', { x: 0, y: 3 }],
      ['sun', 'sun-knight', { x: 0, y: 3 }],
    ] as const;

    let result = applyCommand(state, { type: 'move', player: moves[0][0], unitId: moves[0][1], to: moves[0][2] });
    expect(result.state.players.sun.energy).toBe(1);
    state = result.state;

    result = applyCommand(state, { type: 'move', player: moves[1][0], unitId: moves[1][1], to: moves[1][2] });
    expect(result.state.players.moon.energy).toBe(2);
    state = result.state;

    result = applyCommand(state, { type: 'move', player: moves[2][0], unitId: moves[2][1], to: moves[2][2] });
    expect(result.state.players.sun.energy).toBe(2);
  });

  it('rejects commands from the wrong player', () => {
    const state = createInitialState();
    const result = applyCommand(state, {
      type: 'move',
      player: 'sun',
      unitId: 'sun-knight',
      to: { x: 2, y: 2 },
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it('prevents expensive cards before enough energy is unlocked', () => {
    const state = createInitialState();
    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'yarnado',
      target: { x: 3, y: 3 },
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it('Fish Bomb damages every unit inside its 3x3 area when affordable', () => {
    const state = createInitialState();
    state.players.moon.energy = 3;
    state.players.moon.maxEnergy = 3;
    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'fish_bomb',
      target: { x: 3, y: 1 },
    });

    expect(result.ok).toBe(true);
    expect(result.state.units.find((unit) => unit.id === 'sun-kitten-a')).toBeUndefined();
    expect(result.state.units.find((unit) => unit.id === 'sun-kitten-b')).toBeUndefined();
    expect(result.state.players.moon.hand).not.toContain('fish_bomb');
  });

  it('Spilled Milk changes a tile and can make a cat slide', () => {
    let state = createInitialState();
    let result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'spilled_milk',
      target: { x: 2, y: 2 },
    });
    expect(result.ok).toBe(true);
    state = result.state;

    result = applyCommand(state, {
      type: 'move',
      player: 'sun',
      unitId: 'sun-kitten-a',
      to: { x: 2, y: 2 },
    });
    expect(result.ok).toBe(true);
    expect(result.state.units.find((unit) => unit.id === 'sun-kitten-a')?.position).toEqual({ x: 2, y: 3 });
  });

  it('Cardboard Fort creates blocking terrain and knights cannot land on it', () => {
    const state = createInitialState();
    state.players.moon.energy = 2;
    state.players.moon.maxEnergy = 2;
    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'cardboard_fort',
      target: { x: 0, y: 4 },
    });
    expect(result.ok).toBe(true);
    expect(result.state.tiles.find((tile) => tile.position.x === 0 && tile.position.y === 4)?.kind).toBe('box');

    const moonTurnState = structuredClone(result.state);
    moonTurnState.activePlayer = 'moon';
    expect(getLegalMoves(moonTurnState, 'moon-knight')).not.toContainEqual({ x: 0, y: 4 });
  });

  it('Zoomies moves a non-Lord cat exactly two orthogonal squares', () => {
    const state = createInitialState();
    state.players.moon.energy = 2;
    state.players.moon.maxEnergy = 2;
    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'zoomies',
      targetUnitId: 'moon-kitten-a',
      target: { x: 0, y: 5 },
    });

    expect(result.ok).toBe(true);
    expect(result.state.units.find((unit) => unit.id === 'moon-kitten-a')?.position).toEqual({ x: 0, y: 5 });
  });

  it('Zoomies rejects Lord Cats and invalid destinations without consuming the card', () => {
    const state = createInitialState();
    state.players.moon.energy = 2;
    state.players.moon.maxEnergy = 2;
    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'zoomies',
      targetUnitId: 'moon-lord',
      target: { x: 1, y: 6 },
    });

    expect(result.ok).toBe(false);
    expect(result.state.players.moon.hand).toContain('zoomies');
  });

  it('Yarnado destroys empty tiles and cardboard in the chosen row when affordable', () => {
    const state = createInitialState();
    state.players.moon.energy = 3;
    state.players.moon.maxEnergy = 3;
    const box = state.tiles.find((tile) => tile.position.x === 0 && tile.position.y === 3);
    if (box) box.kind = 'box';

    const result = applyCommand(state, {
      type: 'play_card',
      player: 'moon',
      card: 'yarnado',
      target: { x: 3, y: 3 },
    });
    expect(result.ok).toBe(true);
    expect(result.state.tiles.filter((tile) => tile.position.y === 3 && tile.kind === 'destroyed')).toHaveLength(7);
  });

  it('One Orange Braincell gives the same result with the same seed and state', () => {
    const leftState = createInitialState(42);
    leftState.players.moon.energy = 2;
    leftState.players.moon.maxEnergy = 2;
    const rightState = structuredClone(leftState);

    const left = applyCommand(leftState, {
      type: 'play_card',
      player: 'moon',
      card: 'orange_braincell',
      targetUnitId: 'moon-knight',
    });
    const right = applyCommand(rightState, {
      type: 'play_card',
      player: 'moon',
      card: 'orange_braincell',
      targetUnitId: 'moon-knight',
    });

    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    expect(left.state).toEqual(right.state);
  });
});
