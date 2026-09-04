export type PlayerId = 'moon' | 'sun';
export type UnitKind = 'lord' | 'knight' | 'witch' | 'kitten';
export type CardId =
  | 'fish_bomb'
  | 'swap_places'
  | 'spilled_milk'
  | 'yarnado'
  | 'orange_braincell'
  | 'cardboard_fort'
  | 'zoomies';
export type TileKind = 'floor' | 'destroyed' | 'milk' | 'box';

export interface Position {
  x: number;
  y: number;
}

export interface Unit {
  id: string;
  owner: PlayerId;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  attack: number;
  position: Position;
}

export interface Tile {
  position: Position;
  kind: TileKind;
}

export interface PlayerState {
  id: PlayerId;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  hand: CardId[];
}

export interface GameState {
  boardSize: 7;
  turn: number;
  activePlayer: PlayerId;
  winner: PlayerId | null;
  seed: number;
  rngStep: number;
  units: Unit[];
  tiles: Tile[];
  players: Record<PlayerId, PlayerState>;
  log: string[];
}

export type GameEvent =
  | { type: 'unit_moved'; unitId: string; from: Position; to: Position }
  | { type: 'unit_damaged'; unitId: string; amount: number; hp: number }
  | { type: 'unit_killed'; unitId: string }
  | { type: 'tile_changed'; position: Position; kind: TileKind }
  | { type: 'units_swapped'; firstUnitId: string; secondUnitId: string }
  | { type: 'card_played'; player: PlayerId; card: CardId }
  | { type: 'turn_started'; player: PlayerId; turn: number; energy: number }
  | { type: 'game_over'; winner: PlayerId };

export type GameCommand =
  | { type: 'move'; player: PlayerId; unitId: string; to: Position }
  | { type: 'attack'; player: PlayerId; unitId: string; targetUnitId: string }
  | {
      type: 'play_card';
      player: PlayerId;
      card: CardId;
      target?: Position;
      targetUnitId?: string;
      secondUnitId?: string;
    };

export interface GameResult {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
  error?: string;
}
