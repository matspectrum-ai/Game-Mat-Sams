import type {
  CardId,
  GameCommand,
  GameEvent,
  GameResult,
  GameState,
  PlayerId,
  Position,
  Tile,
  TileKind,
  Unit,
  UnitKind,
} from './types';

const BOARD_SIZE = 7 as const;
const MAX_ENERGY = 5;

export const CARD_COSTS: Record<CardId, number> = {
  fish_bomb: 2,
  swap_places: 1,
  spilled_milk: 1,
  yarnado: 3,
  orange_braincell: 2,
  cardboard_fort: 2,
  zoomies: 2,
};

export const CARD_NAMES: Record<CardId, string> = {
  fish_bomb: 'Fish Bomb',
  swap_places: 'Swap Places',
  spilled_milk: 'Spilled Milk',
  yarnado: 'Yarnado',
  orange_braincell: 'One Orange Braincell',
  cardboard_fort: 'Cardboard Fort',
  zoomies: 'Zoomies!',
};

const INITIAL_HAND: CardId[] = [
  'fish_bomb',
  'swap_places',
  'spilled_milk',
  'yarnado',
  'orange_braincell',
  'cardboard_fort',
  'zoomies',
];

function pos(x: number, y: number): Position {
  return { x, y };
}

function unit(
  id: string,
  owner: PlayerId,
  kind: UnitKind,
  position: Position,
  hp: number,
  attack: number,
): Unit {
  return { id, owner, kind, position, hp, maxHp: hp, attack };
}

function energyForTurn(turn: number): number {
  return Math.min(MAX_ENERGY, Math.ceil(turn / 2));
}

export function createInitialState(seed = 1337): GameState {
  const tiles: Tile[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      tiles.push({ position: pos(x, y), kind: 'floor' });
    }
  }

  return {
    boardSize: BOARD_SIZE,
    turn: 1,
    activePlayer: 'moon',
    winner: null,
    seed,
    rngStep: 0,
    tiles,
    units: [
      unit('sun-lord', 'sun', 'lord', pos(3, 0), 8, 2),
      unit('sun-knight', 'sun', 'knight', pos(1, 0), 3, 2),
      unit('sun-witch', 'sun', 'witch', pos(5, 0), 2, 2),
      unit('sun-kitten-a', 'sun', 'kitten', pos(2, 1), 1, 1),
      unit('sun-kitten-b', 'sun', 'kitten', pos(4, 1), 1, 1),
      unit('moon-kitten-a', 'moon', 'kitten', pos(2, 5), 1, 1),
      unit('moon-kitten-b', 'moon', 'kitten', pos(4, 5), 1, 1),
      unit('moon-knight', 'moon', 'knight', pos(1, 6), 3, 2),
      unit('moon-lord', 'moon', 'lord', pos(3, 6), 8, 2),
      unit('moon-witch', 'moon', 'witch', pos(5, 6), 2, 2),
    ],
    players: {
      moon: { id: 'moon', hp: 8, maxHp: 8, energy: 1, maxEnergy: 1, hand: [...INITIAL_HAND] },
      sun: { id: 'sun', hp: 8, maxHp: 8, energy: 1, maxEnergy: 1, hand: [...INITIAL_HAND] },
    },
    log: ['The cats have entered the board. Moon moves first.'],
  };
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function inBounds(position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < BOARD_SIZE && position.y < BOARD_SIZE;
}

function tileAt(state: GameState, position: Position): Tile | undefined {
  return state.tiles.find((tile) => samePosition(tile.position, position));
}

function unitAt(state: GameState, position: Position): Unit | undefined {
  return state.units.find((candidate) => samePosition(candidate.position, position));
}

function unitById(state: GameState, id: string): Unit | undefined {
  return state.units.find((candidate) => candidate.id === id);
}

function setTileKind(state: GameState, position: Position, kind: TileKind, events: GameEvent[]): void {
  const tile = tileAt(state, position);
  if (!tile || tile.kind === kind) return;
  tile.kind = kind;
  events.push({ type: 'tile_changed', position: { ...position }, kind });
}

function isWalkable(state: GameState, position: Position): boolean {
  if (!inBounds(position)) return false;
  const kind = tileAt(state, position)?.kind;
  return kind !== 'destroyed' && kind !== 'box';
}

function sign(value: number): number {
  return value === 0 ? 0 : value > 0 ? 1 : -1;
}

function pathIsClear(state: GameState, from: Position, to: Position): boolean {
  const dx = sign(to.x - from.x);
  const dy = sign(to.y - from.y);
  let x = from.x + dx;
  let y = from.y + dy;

  while (x !== to.x || y !== to.y) {
    const position = pos(x, y);
    if (!isWalkable(state, position) || unitAt(state, position)) return false;
    x += dx;
    y += dy;
  }
  return true;
}

function legalVector(kind: UnitKind, owner: PlayerId, from: Position, to: Position): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (kind === 'lord') return Math.max(ax, ay) === 1;
  if (kind === 'knight') return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
  if (kind === 'witch') return ax === ay && ax >= 1 && ax <= 3;
  if (kind === 'kitten') return dx === 0 && dy === (owner === 'moon' ? -1 : 1);
  return false;
}

function canReach(state: GameState, movingUnit: Unit, target: Position): boolean {
  if (!inBounds(target) || !isWalkable(state, target)) return false;
  if (!legalVector(movingUnit.kind, movingUnit.owner, movingUnit.position, target)) return false;
  if (movingUnit.kind === 'witch' && !pathIsClear(state, movingUnit.position, target)) return false;
  return true;
}

export function getLegalMoves(state: GameState, unitId: string): Position[] {
  const movingUnit = unitById(state, unitId);
  if (!movingUnit || movingUnit.owner !== state.activePlayer || state.winner) return [];

  const result: Position[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const target = pos(x, y);
      if (!canReach(state, movingUnit, target)) continue;
      if (!unitAt(state, target)) result.push(target);
    }
  }
  return result;
}

export function getAttackableUnits(state: GameState, unitId: string): Unit[] {
  const attacker = unitById(state, unitId);
  if (!attacker || attacker.owner !== state.activePlayer || state.winner) return [];

  return state.units.filter(
    (target) => target.owner !== attacker.owner && canReach(state, attacker, target.position),
  );
}

function fail(state: GameState, error: string): GameResult {
  return { ok: false, state, events: [], error };
}

function damageUnit(state: GameState, target: Unit, amount: number, events: GameEvent[]): void {
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: 'unit_damaged', unitId: target.id, amount, hp: target.hp });
  if (target.kind === 'lord') state.players[target.owner].hp = target.hp;
  if (target.hp > 0) return;

  state.units = state.units.filter((candidate) => candidate.id !== target.id);
  events.push({ type: 'unit_killed', unitId: target.id });

  if (target.kind === 'lord') {
    const winner: PlayerId = target.owner === 'moon' ? 'sun' : 'moon';
    state.winner = winner;
    events.push({ type: 'game_over', winner });
    state.log.unshift(`${winner === 'moon' ? 'Moon' : 'Sun'} wins. The rival Lord Cat has fallen.`);
  }
}

function nextRandom(state: GameState): number {
  let value = (state.seed + state.rngStep * 0x9e3779b9) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngStep += 1;
  return value >>> 0;
}

function endTurn(state: GameState, events: GameEvent[]): void {
  if (state.winner) return;

  state.turn += 1;
  state.activePlayer = state.activePlayer === 'moon' ? 'sun' : 'moon';
  const energy = energyForTurn(state.turn);
  state.players[state.activePlayer].maxEnergy = energy;
  state.players[state.activePlayer].energy = energy;
  events.push({ type: 'turn_started', player: state.activePlayer, turn: state.turn, energy });
}

function removeCard(state: GameState, player: PlayerId, card: CardId): void {
  const hand = state.players[player].hand;
  const index = hand.indexOf(card);
  if (index >= 0) hand.splice(index, 1);
}

function applyMove(state: GameState, unitId: string, to: Position, events: GameEvent[]): string | null {
  const movingUnit = unitById(state, unitId);
  if (!movingUnit) return 'Unit not found.';
  if (!canReach(state, movingUnit, to)) return 'That cat cannot move there.';
  if (unitAt(state, to)) return 'That tile is occupied.';

  const from = { ...movingUnit.position };
  movingUnit.position = { ...to };
  events.push({ type: 'unit_moved', unitId, from, to: { ...to } });

  if (tileAt(state, to)?.kind === 'milk' && movingUnit.kind !== 'knight') {
    const slide = pos(to.x + sign(to.x - from.x), to.y + sign(to.y - from.y));
    if (isWalkable(state, slide) && !unitAt(state, slide)) {
      const milkFrom = { ...movingUnit.position };
      movingUnit.position = slide;
      events.push({ type: 'unit_moved', unitId, from: milkFrom, to: { ...slide } });
      state.log.unshift(`${unitId} slipped on spilled milk.`);
    }
  }

  return null;
}

function applyZoomies(
  state: GameState,
  command: Extract<GameCommand, { type: 'play_card' }>,
  events: GameEvent[],
): string | null {
  if (!command.targetUnitId || !command.target) return 'Zoomies needs one of your cats and a destination.';

  const target = unitById(state, command.targetUnitId);
  if (!target || target.owner !== command.player) return 'Choose one of your own cats.';
  if (target.kind === 'lord') return 'Lord Cats are far too dignified for Zoomies.';
  if (!inBounds(command.target) || !isWalkable(state, command.target)) return 'Zoomies destination is not walkable.';
  if (unitAt(state, command.target)) return 'Zoomies destination is occupied.';

  const dx = Math.abs(command.target.x - target.position.x);
  const dy = Math.abs(command.target.y - target.position.y);
  if (!((dx === 2 && dy === 0) || (dx === 0 && dy === 2))) {
    return 'Zoomies must travel exactly two orthogonal squares.';
  }

  const from = { ...target.position };
  target.position = { ...command.target };
  events.push({ type: 'unit_moved', unitId: target.id, from, to: { ...target.position } });
  state.log.unshift(`${target.id} got the Zoomies and ignored normal movement rules.`);
  return null;
}

function applyCard(
  state: GameState,
  command: Extract<GameCommand, { type: 'play_card' }>,
  events: GameEvent[],
): string | null {
  const player = state.players[command.player];
  const cost = CARD_COSTS[command.card];

  if (!player.hand.includes(command.card)) return 'That card is not in your hand.';
  if (player.energy < cost) return 'Not enough paw energy.';

  if (command.card === 'fish_bomb') {
    if (!command.target || !inBounds(command.target)) return 'Fish Bomb needs a board target.';

    for (const target of state.units.slice()) {
      if (
        Math.abs(target.position.x - command.target.x) <= 1 &&
        Math.abs(target.position.y - command.target.y) <= 1
      ) {
        damageUnit(state, target, 2, events);
      }
    }

    if (!unitAt(state, command.target)) setTileKind(state, command.target, 'destroyed', events);
    state.log.unshift('Fish Bomb exploded in a 3×3 area. Nobody is proud of this.');
  }

  if (command.card === 'spilled_milk') {
    if (!command.target || !inBounds(command.target)) return 'Spilled Milk needs a board target.';
    const tile = tileAt(state, command.target);
    if (!tile || tile.kind === 'destroyed' || tile.kind === 'box') return 'Milk cannot be poured there.';
    if (unitAt(state, command.target)) return 'A cat is already standing there.';

    setTileKind(state, command.target, 'milk', events);
    state.log.unshift('Milk spilled. Movement has become legally questionable.');
  }

  if (command.card === 'yarnado') {
    if (!command.target || !inBounds(command.target)) return 'Yarnado needs a row target.';
    const row = command.target.y;

    for (const target of state.units.slice()) {
      if (target.position.y === row) damageUnit(state, target, 2, events);
    }

    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const target = pos(x, row);
      if (!unitAt(state, target)) setTileKind(state, target, 'destroyed', events);
    }

    state.log.unshift(`Yarnado shredded row ${row + 1}.`);
  }

  if (command.card === 'swap_places') {
    if (!command.targetUnitId || !command.secondUnitId) return 'Swap Places needs two cats.';
    const first = unitById(state, command.targetUnitId);
    const second = unitById(state, command.secondUnitId);

    if (!first || !second || first.id === second.id) return 'Choose two different cats.';
    if (first.kind === 'lord' || second.kind === 'lord') return 'Lord Cats refuse to participate in this nonsense.';

    const firstPosition = { ...first.position };
    first.position = { ...second.position };
    second.position = firstPosition;
    events.push({ type: 'units_swapped', firstUnitId: first.id, secondUnitId: second.id });
    state.log.unshift(`${first.id} and ${second.id} swapped places.`);
  }

  if (command.card === 'orange_braincell') {
    if (!command.targetUnitId) return 'One Orange Braincell needs one of your cats.';
    const target = unitById(state, command.targetUnitId);
    if (!target || target.owner !== command.player) return 'Choose one of your own cats.';

    const roll = nextRandom(state) % 3;
    if (roll === 0) {
      target.hp = Math.min(target.maxHp, target.hp + 2);
      if (target.kind === 'lord') state.players[target.owner].hp = target.hp;
      state.log.unshift('The braincell worked: +2 HP. Astonishing.');
    } else if (roll === 1) {
      damageUnit(state, target, 2, events);
      state.log.unshift('The braincell did not work: self-inflicted damage. Classic orange cat.');
    } else {
      const openTiles = state.tiles.filter((tile) => isWalkable(state, tile.position) && !unitAt(state, tile.position));
      if (openTiles.length > 0) {
        const index = nextRandom(state) % openTiles.length;
        const destination = openTiles[index];
        if (destination) {
          const from = { ...target.position };
          target.position = { ...destination.position };
          events.push({ type: 'unit_moved', unitId: target.id, from, to: { ...target.position } });
          state.log.unshift('The braincell teleported a cat. No further questions.');
        }
      }
    }
  }

  if (command.card === 'cardboard_fort') {
    if (!command.target || !inBounds(command.target)) return 'Cardboard Fort needs a board target.';
    const tile = tileAt(state, command.target);
    if (!tile || tile.kind === 'destroyed' || tile.kind === 'box') return 'A cardboard fort cannot be built there.';
    if (unitAt(state, command.target)) return 'Move that cat before building a fort.';

    setTileKind(state, command.target, 'box', events);
    state.log.unshift('A strategically questionable cardboard fort appeared.');
  }

  if (command.card === 'zoomies') {
    const zoomiesError = applyZoomies(state, command, events);
    if (zoomiesError) return zoomiesError;
  }

  player.energy -= cost;
  removeCard(state, command.player, command.card);
  events.unshift({ type: 'card_played', player: command.player, card: command.card });
  return null;
}

export function applyCommand(currentState: GameState, command: GameCommand): GameResult {
  if (currentState.winner) return fail(currentState, 'The match is already over.');
  if (command.player !== currentState.activePlayer) return fail(currentState, 'It is not your turn.');

  const state = structuredClone(currentState);
  const events: GameEvent[] = [];
  let error: string | null = null;

  if (command.type === 'move') {
    const movingUnit = unitById(state, command.unitId);
    if (!movingUnit || movingUnit.owner !== command.player) return fail(currentState, 'Choose one of your cats.');
    error = applyMove(state, command.unitId, command.to, events);
    if (!error) state.log.unshift(`${command.unitId} moved.`);
  }

  if (command.type === 'attack') {
    const attacker = unitById(state, command.unitId);
    const target = unitById(state, command.targetUnitId);
    if (!attacker || attacker.owner !== command.player) return fail(currentState, 'Choose one of your cats.');
    if (!target || target.owner === command.player) return fail(currentState, 'Choose an enemy cat.');
    if (!canReach(state, attacker, target.position)) return fail(currentState, 'That enemy is out of reach.');

    damageUnit(state, target, attacker.attack, events);
    state.log.unshift(`${attacker.id} attacked ${target.id} for ${attacker.attack}.`);
  }

  if (command.type === 'play_card') {
    error = applyCard(state, command, events);
  }

  if (error) return fail(currentState, error);

  endTurn(state, events);
  return { ok: true, state, events };
}
