import { describe, expect, it } from 'vitest';
import { applyCommand, createInitialState, getLegalMoves } from './game';

describe('CATastrophe game core', () => {
  it('starts with Moon, full Lord HP and five cards per player', () => {
    const state = createInitialState(7);
    expect(state.activePlayer).toBe('moon');
    expect(state.players.moon.hp).toBe(8);
    expect(state.players.sun.hp).toBe(8);
    expect(state.players.moon.hand).toHaveLength(5);
    expect(state.players.sun.hand).toHaveLength(5);
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

  it('Fish Bomb damages every unit inside its 3x3 area', () => {
    const state = createInitialState();
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

  it('Yarnado destroys empty tiles in the chosen row', () => {
    const state = createInitialState();
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
    const left = applyCommand(createInitialState(42), {
      type: 'play_card',
      player: 'moon',
      card: 'orange_braincell',
      targetUnitId: 'moon-knight',
    });
    const right = applyCommand(createInitialState(42), {
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
