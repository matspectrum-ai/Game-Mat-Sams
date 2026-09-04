import Phaser from 'phaser';
import {
  CARD_COSTS,
  CARD_NAMES,
  applyCommand,
  createInitialState,
  getAttackableUnits,
  getLegalMoves,
} from '../core/game';
import type { CardId, GameEvent, GameState, PlayerId, Position, Unit, UnitKind } from '../core/types';

const TILE_SIZE = 88;
const BOARD_OFFSET = 52;

const CARD_DESCRIPTIONS: Record<CardId, string> = {
  fish_bomb: 'Explode uma área 3×3 e pode abrir uma cratera no centro.',
  swap_places: 'Troque dois gatos — o Lorde se recusa a participar.',
  spilled_milk: 'Transforme uma casa em uma armadilha escorregadia.',
  yarnado: 'Varre uma fileira inteira com lã, dano e destruição.',
  orange_braincell: 'Cura, dano ou teleporte. O neurônio decide.',
};

const CARD_ICONS: Record<CardId, string> = {
  fish_bomb: '🐟',
  swap_places: '↔',
  spilled_milk: '🥛',
  yarnado: '🧶',
  orange_braincell: '🍊',
};

const UNIT_SHORT_NAMES: Record<UnitKind, string> = {
  lord: 'LORDE',
  knight: 'CAVALEIRO',
  witch: 'BRUXA',
  kitten: 'FILHOTE',
};

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export class GameScene extends Phaser.Scene {
  private gameState: GameState = createInitialState();
  private selectedUnitId: string | null = null;
  private selectedCard: CardId | null = null;
  private swapFirstUnitId: string | null = null;
  private boardLayer?: Phaser.GameObjects.Container;
  private audioContext?: AudioContext;

  constructor() {
    super('CATastrophe');
  }

  preload(): void {
    for (const owner of ['moon', 'sun'] as const) {
      for (const kind of ['lord', 'knight', 'witch', 'kitten'] as const) {
        this.load.svg(`cat-${owner}-${kind}`, `/assets/cats/${owner}-${kind}.svg`);
      }
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#211713');
    this.bindDomControls();
    this.renderEverything();
  }

  private bindDomControls(): void {
    document.querySelector<HTMLButtonElement>('#restart')?.addEventListener('click', () => {
      this.gameState = createInitialState(Date.now() >>> 0);
      this.selectedUnitId = null;
      this.selectedCard = null;
      this.swapFirstUnitId = null;
      this.setStatus('Nova partida. Lua começa. Escolha um gato.');
      this.renderEverything();
      this.cameras.main.flash(220, 246, 223, 190, false);
      this.playTone(392, 0.08, 'sine', 0.025);
    });

    document.querySelector<HTMLButtonElement>('#cancel-card')?.addEventListener('click', () => {
      this.selectedCard = null;
      this.swapFirstUnitId = null;
      this.setStatus('Carta cancelada. Escolha um gato ou outra carta.');
      this.renderEverything();
    });
  }

  private renderEverything(): void {
    this.renderBoard();
    this.renderHud();
    this.renderCards();
  }

  private boardPoint(position: Position): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      BOARD_OFFSET + position.x * TILE_SIZE + TILE_SIZE / 2,
      BOARD_OFFSET + position.y * TILE_SIZE + TILE_SIZE / 2,
    );
  }

  private renderBoard(): void {
    this.boardLayer?.destroy(true);
    this.boardLayer = this.add.container(0, 0);

    this.drawBackdrop();

    const legalMoves = this.selectedUnitId ? getLegalMoves(this.gameState, this.selectedUnitId) : [];
    const attackable = this.selectedUnitId ? getAttackableUnits(this.gameState, this.selectedUnitId) : [];

    for (let y = 0; y < this.gameState.boardSize; y += 1) {
      for (let x = 0; x < this.gameState.boardSize; x += 1) {
        const position = { x, y };
        const tile = this.gameState.tiles.find((candidate) => samePosition(candidate.position, position));
        const occupant = this.gameState.units.find((candidate) => samePosition(candidate.position, position));
        const center = this.boardPoint(position);
        const lightSquare = (x + y) % 2 === 0;

        let fill = lightSquare ? 0xe0c491 : 0x71556b;
        let alpha = 0.98;
        if (tile?.kind === 'destroyed') {
          fill = 0x17100e;
          alpha = 1;
        } else if (tile?.kind === 'milk') {
          fill = 0xcbd3cc;
        }

        const isLegal = legalMoves.some((move) => samePosition(move, position));
        const isAttackable = occupant ? attackable.some((unit) => unit.id === occupant.id) : false;

        const shadow = this.add.rectangle(center.x + 2, center.y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 0x100c0a, 0.25);
        const square = this.add
          .rectangle(center.x, center.y, TILE_SIZE - 7, TILE_SIZE - 7, fill, alpha)
          .setStrokeStyle(
            isLegal ? 4 : isAttackable ? 4 : 2,
            isLegal ? 0xf0d66d : isAttackable ? 0xdf5548 : 0x4a362e,
            1,
          )
          .setInteractive({ useHandCursor: true });

        square.on('pointerdown', () => this.handleTileClick(position));
        this.boardLayer.add([shadow, square]);

        if (isLegal) {
          const marker = this.add.circle(center.x, center.y, 9, 0xf0d66d, 0.68).setStrokeStyle(2, 0x5a4227, 0.8);
          this.boardLayer.add(marker);
          this.tweens.add({ targets: marker, scale: 1.28, alpha: 0.35, duration: 680, yoyo: true, repeat: -1 });
        }

        this.drawTileDetail(tile?.kind ?? 'floor', center.x, center.y, x, y);
        if (occupant) this.renderUnit(occupant, center.x, center.y, isAttackable);
      }
    }

    for (let index = 0; index < 7; index += 1) {
      const labelX = BOARD_OFFSET + index * TILE_SIZE + TILE_SIZE / 2;
      const labelY = BOARD_OFFSET + index * TILE_SIZE + TILE_SIZE / 2;
      this.boardLayer.add(this.add.text(labelX, 25, String.fromCharCode(65 + index), {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#b8a189', fontStyle: 'bold',
      }).setOrigin(0.5));
      this.boardLayer.add(this.add.text(25, labelY, String(index + 1), {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#b8a189', fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  private drawBackdrop(): void {
    if (!this.boardLayer) return;

    const boardShadow = this.add.rectangle(363, 366, 666, 666, 0x0e0a08, 0.65).setRotation(-0.006);
    const frame = this.add.rectangle(360, 360, 662, 662, 0x35251f, 1)
      .setStrokeStyle(5, 0x765948, 1)
      .setRotation(0.004);
    const inner = this.add.rectangle(360, 360, 628, 628, 0x261b17, 1)
      .setStrokeStyle(2, 0xa27a5d, 0.45);

    this.boardLayer.add([boardShadow, frame, inner]);

    const doodles: Array<[number, number, string, number]> = [
      [30, 30, '✦', -0.08],
      [686, 34, '≋', 0.1],
      [690, 686, '✧', 0.1],
      [28, 686, '⌁', -0.15],
    ];

    for (const [x, y, glyph, rotation] of doodles) {
      this.boardLayer.add(
        this.add.text(x, y, glyph, {
          fontFamily: 'Georgia, serif',
          fontSize: '22px',
          color: '#8e6a55',
        }).setOrigin(0.5).setRotation(rotation).setAlpha(0.7),
      );
    }
  }

  private drawTileDetail(kind: string, x: number, y: number, gridX: number, gridY: number): void {
    if (!this.boardLayer) return;

    if (kind === 'destroyed') {
      const crater = this.add.circle(x, y, 27, 0x0c0908, 0.9).setStrokeStyle(3, 0x4a2b22, 0.9);
      const crackA = this.add.line(x, y, -22, -18, 21, 17, 0x6a3a2c, 0.8).setLineWidth(2);
      const crackB = this.add.line(x, y, -18, 20, 18, -20, 0x513028, 0.8).setLineWidth(2);
      const debrisA = this.add.triangle(x - 25, y + 22, 0, 10, 8, 0, 13, 11, 0x77503b, 0.9).setRotation(0.5);
      const debrisB = this.add.triangle(x + 22, y - 22, 0, 9, 7, 0, 11, 9, 0x664431, 0.8).setRotation(-0.4);
      this.boardLayer.add([crater, crackA, crackB, debrisA, debrisB]);
      return;
    }

    if (kind === 'milk') {
      const spill = this.add.ellipse(x, y + 3, 60, 34, 0xf4f0df, 0.7).setRotation((gridX - gridY) * 0.04);
      const drop = this.add.circle(x + 24, y - 16, 5, 0xf4f0df, 0.6);
      this.boardLayer.add([spill, drop]);
      return;
    }

    if ((gridX * 5 + gridY * 3) % 11 === 0) {
      const scratch = this.add.text(x + 20, y + 19, '///', {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: '#4c382f',
      }).setOrigin(0.5).setRotation(-0.3).setAlpha(0.35);
      this.boardLayer.add(scratch);
    }
  }

  private renderUnit(unit: Unit, x: number, y: number, attackable: boolean): void {
    if (!this.boardLayer) return;

    const isSelected = unit.id === this.selectedUnitId || unit.id === this.swapFirstUnitId;
    const textureKey = `cat-${unit.owner}-${unit.kind}`;
    const shadow = this.add.ellipse(x + 2, y + 31, 62, 18, 0x100b09, 0.42);
    const glow = this.add.circle(
      x,
      y + 4,
      unit.kind === 'lord' ? 37 : 33,
      isSelected ? 0xf0d66d : attackable ? 0xe4544b : unit.owner === 'moon' ? 0x776399 : 0xc87c45,
      isSelected || attackable ? 0.2 : 0.08,
    );
    const sprite = this.add.image(x, y + 2, textureKey)
      .setDisplaySize(unit.kind === 'kitten' ? 66 : 76, unit.kind === 'kitten' ? 66 : 76)
      .setInteractive({ useHandCursor: true });

    const hp = this.add.text(x + 27, y - 34, `${unit.hp}♥`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#ffd5c7',
      backgroundColor: '#211613',
      padding: { x: 4, y: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const rank = this.add.text(x, y + 38, UNIT_SHORT_NAMES[unit.kind], {
      fontFamily: 'Georgia, serif',
      fontSize: unit.kind === 'kitten' ? '7px' : '8px',
      color: '#f7e7cf',
      backgroundColor: '#211613',
      padding: { x: 4, y: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5);

    sprite.on('pointerdown', () => this.handleUnitClick(unit.id));
    this.boardLayer.add([shadow, glow, sprite, hp, rank]);

    if (isSelected) {
      this.tweens.add({
        targets: sprite,
        y: y - 3,
        angle: unit.owner === 'moon' ? -2 : 2,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  private handleTileClick(position: Position): void {
    if (this.gameState.winner) return;

    if (this.selectedCard === 'fish_bomb' || this.selectedCard === 'spilled_milk' || this.selectedCard === 'yarnado') {
      this.playCard({ target: position });
      return;
    }

    if (!this.selectedUnitId) {
      this.setStatus('Escolha primeiro um gato da sua equipe.');
      return;
    }

    const result = applyCommand(this.gameState, {
      type: 'move',
      player: this.gameState.activePlayer,
      unitId: this.selectedUnitId,
      to: position,
    });
    this.consumeResult(result.ok, result.state, result.error ?? 'Movimento inválido.', result.events);
  }

  private handleUnitClick(unitId: string): void {
    if (this.gameState.winner) return;
    const clicked = this.gameState.units.find((unit) => unit.id === unitId);
    if (!clicked) return;

    if (this.selectedCard === 'orange_braincell') {
      this.playCard({ targetUnitId: unitId });
      return;
    }

    if (this.selectedCard === 'swap_places') {
      if (!this.swapFirstUnitId) {
        if (clicked.kind === 'lord') {
          this.setStatus('Lord Cats recusam Swap Places. Escolha outro gato.');
          return;
        }
        this.swapFirstUnitId = clicked.id;
        this.setStatus('Primeiro gato marcado. Agora escolha o segundo.');
        this.renderBoard();
        return;
      }
      this.playCard({ targetUnitId: this.swapFirstUnitId, secondUnitId: unitId });
      return;
    }

    if (clicked.owner === this.gameState.activePlayer) {
      this.selectedUnitId = clicked.id;
      this.selectedCard = null;
      this.swapFirstUnitId = null;
      this.setStatus(`${this.prettyUnit(clicked)} selecionado. Dourado = mover. Vermelho = atacar.`);
      this.renderEverything();
      this.playTone(520, 0.035, 'sine', 0.015);
      return;
    }

    if (!this.selectedUnitId) {
      this.setStatus('Você precisa selecionar um gato seu antes de atacar.');
      return;
    }

    const result = applyCommand(this.gameState, {
      type: 'attack',
      player: this.gameState.activePlayer,
      unitId: this.selectedUnitId,
      targetUnitId: clicked.id,
    });
    this.consumeResult(result.ok, result.state, result.error ?? 'Ataque inválido.', result.events);
  }

  private playCard(targets: { target?: Position; targetUnitId?: string; secondUnitId?: string }): void {
    if (!this.selectedCard) return;
    const result = applyCommand(this.gameState, {
      type: 'play_card',
      player: this.gameState.activePlayer,
      card: this.selectedCard,
      ...targets,
    });
    this.consumeResult(result.ok, result.state, result.error ?? 'Não foi possível jogar essa carta.', result.events);
  }

  private consumeResult(
    ok: boolean,
    nextState: GameState,
    error: string,
    events: GameEvent[] = [],
  ): void {
    if (!ok) {
      this.setStatus(error);
      this.cameras.main.shake(90, 0.002);
      this.playTone(120, 0.05, 'square', 0.015);
      return;
    }

    const previousState = this.gameState;
    this.gameState = nextState;
    this.selectedUnitId = null;
    this.selectedCard = null;
    this.swapFirstUnitId = null;
    this.setStatus(
      this.gameState.winner
        ? `${this.playerName(this.gameState.winner)} venceu a partida.`
        : `Agora é a vez de ${this.playerName(this.gameState.activePlayer)}.`,
    );
    this.renderEverything();
    this.playFeedback(events, previousState);
  }

  private playFeedback(events: GameEvent[], previousState: GameState): void {
    const cardEvent = events.find((event): event is Extract<GameEvent, { type: 'card_played' }> => event.type === 'card_played');
    if (cardEvent) this.showCardBanner(cardEvent.card);

    for (const event of events) {
      if (event.type === 'unit_moved') this.animateMove(event.from, event.to);
      if (event.type === 'unit_damaged') this.animateDamage(event.unitId, event.amount, previousState);
      if (event.type === 'tile_changed') this.animateTileChange(event.position, event.kind);
      if (event.type === 'units_swapped') this.animateSwap(event.firstUnitId, event.secondUnitId);
    }

    const hasDestruction = events.some((event) => event.type === 'tile_changed' && event.kind === 'destroyed');
    const hasDamage = events.some((event) => event.type === 'unit_damaged');
    const gameOver = events.find((event): event is Extract<GameEvent, { type: 'game_over' }> => event.type === 'game_over');

    if (hasDestruction) {
      this.cameras.main.shake(220, 0.008);
      this.playTone(82, 0.12, 'sawtooth', 0.035);
    } else if (hasDamage) {
      this.cameras.main.shake(120, 0.004);
      this.playTone(155, 0.07, 'square', 0.025);
    } else {
      this.playTone(330, 0.045, 'triangle', 0.018);
    }

    if (cardEvent) this.cameras.main.flash(130, 247, 221, 149, false);
    if (gameOver) this.showVictory(gameOver.winner);
  }

  private animateMove(from: Position, to: Position): void {
    const start = this.boardPoint(from);
    const end = this.boardPoint(to);
    const trail = this.add.text(start.x, start.y, '🐾', {
      fontSize: '22px',
      color: '#f3d68d',
    }).setOrigin(0.5).setAlpha(0.75).setDepth(40);

    this.tweens.add({
      targets: trail,
      x: end.x,
      y: end.y,
      alpha: 0,
      scale: 1.35,
      duration: 280,
      ease: 'Cubic.Out',
      onComplete: () => trail.destroy(),
    });
  }

  private animateDamage(unitId: string, amount: number, previousState: GameState): void {
    const unit = this.gameState.units.find((candidate) => candidate.id === unitId)
      ?? previousState.units.find((candidate) => candidate.id === unitId);
    if (!unit) return;

    const point = this.boardPoint(unit.position);
    const slashA = this.add.line(point.x, point.y, -25, -18, 25, 18, 0xf06b5e, 0.95).setLineWidth(5).setDepth(42);
    const slashB = this.add.line(point.x, point.y, -18, 24, 18, -24, 0xffc0a6, 0.8).setLineWidth(3).setDepth(42);
    const number = this.add.text(point.x, point.y - 18, `-${amount}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd0bd',
      stroke: '#321714',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(43);

    this.tweens.add({ targets: [slashA, slashB], alpha: 0, scale: 1.4, duration: 250, onComplete: () => { slashA.destroy(); slashB.destroy(); } });
    this.tweens.add({ targets: number, y: point.y - 55, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => number.destroy() });
  }

  private animateTileChange(position: Position, kind: 'floor' | 'destroyed' | 'milk'): void {
    const point = this.boardPoint(position);

    if (kind === 'destroyed') {
      const ring = this.add.circle(point.x, point.y, 18, 0xff9b50, 0.18).setStrokeStyle(5, 0xffbf6c, 0.9).setDepth(39);
      const core = this.add.circle(point.x, point.y, 8, 0xffe2a1, 0.9).setDepth(40);
      this.tweens.add({
        targets: ring,
        radius: 48,
        alpha: 0,
        duration: 360,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      });
      this.tweens.add({ targets: core, scale: 4, alpha: 0, duration: 210, onComplete: () => core.destroy() });
      return;
    }

    if (kind === 'milk') {
      const splash = this.add.text(point.x, point.y, '🥛', { fontSize: '32px' }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: splash, y: point.y - 28, scale: 1.25, alpha: 0, duration: 460, onComplete: () => splash.destroy() });
    }
  }

  private animateSwap(firstUnitId: string, secondUnitId: string): void {
    const first = this.gameState.units.find((unit) => unit.id === firstUnitId);
    const second = this.gameState.units.find((unit) => unit.id === secondUnitId);
    if (!first || !second) return;

    for (const unit of [first, second]) {
      const point = this.boardPoint(unit.position);
      const sparkle = this.add.text(point.x, point.y, '✦', {
        fontFamily: 'Georgia, serif', fontSize: '34px', color: '#dbb9ff',
      }).setOrigin(0.5).setDepth(41);
      this.tweens.add({ targets: sparkle, angle: 180, scale: 1.7, alpha: 0, duration: 520, onComplete: () => sparkle.destroy() });
    }
  }

  private showCardBanner(card: CardId): void {
    const panel = this.add.rectangle(360, 90, 360, 72, 0x1d1620, 0.94)
      .setStrokeStyle(2, 0xd5ae62, 0.75)
      .setDepth(60)
      .setScale(0.84)
      .setAlpha(0);
    const icon = this.add.text(220, 90, CARD_ICONS[card], { fontSize: '34px' }).setOrigin(0.5).setDepth(61).setAlpha(0);
    const label = this.add.text(385, 89, CARD_NAMES[card], {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#f4dbac',
    }).setOrigin(0.5).setDepth(61).setAlpha(0);

    this.tweens.add({ targets: [panel, icon, label], alpha: 1, scale: 1, duration: 150, ease: 'Back.Out' });
    this.time.delayedCall(700, () => {
      this.tweens.add({
        targets: [panel, icon, label],
        y: '-=18',
        alpha: 0,
        duration: 250,
        onComplete: () => { panel.destroy(); icon.destroy(); label.destroy(); },
      });
    });
  }

  private showVictory(winner: PlayerId): void {
    this.cameras.main.flash(520, 255, 214, 105, false);
    this.cameras.main.shake(380, 0.009);
    this.playTone(winner === 'moon' ? 440 : 523, 0.18, 'triangle', 0.04);
    this.time.delayedCall(120, () => this.playTone(winner === 'moon' ? 660 : 784, 0.22, 'triangle', 0.035));

    const veil = this.add.rectangle(360, 360, 720, 720, 0x100c12, 0.72).setDepth(80).setAlpha(0);
    const crown = this.add.text(360, 255, '♛', { fontSize: '70px', color: '#f1c968' }).setOrigin(0.5).setDepth(81).setAlpha(0);
    const title = this.add.text(360, 345, `${this.playerName(winner).toUpperCase()} VENCEU`, {
      fontFamily: 'Georgia, serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#f7dfb0',
      stroke: '#34201d',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(81).setAlpha(0);
    const subtitle = this.add.text(360, 405, winner === 'moon' ? 'Os Lunáticos dominaram a mesa.' : 'Os Caóticos dominaram a mesa.', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'italic',
      color: '#d5c1aa',
    }).setOrigin(0.5).setDepth(81).setAlpha(0);

    this.tweens.add({ targets: [veil, crown, title, subtitle], alpha: 1, duration: 380, ease: 'Quad.Out' });
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    try {
      this.audioContext ??= new AudioContext();
      const context = this.audioContext;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Audio is ornamental. Gameplay must never depend on browser audio support.
    }
  }

  private renderHud(): void {
    const active = this.gameState.activePlayer;
    const player = this.gameState.players[active];
    const moonHp = document.querySelector<HTMLElement>('#moon-hp');
    const sunHp = document.querySelector<HTMLElement>('#sun-hp');
    const turnPlayer = document.querySelector<HTMLElement>('#turn-player');
    const turnNumber = document.querySelector<HTMLElement>('#turn-number');
    const turnDot = document.querySelector<HTMLElement>('#turn-dot');
    const energy = document.querySelector<HTMLElement>('#energy');
    const log = document.querySelector<HTMLElement>('#game-log');

    if (moonHp) moonHp.textContent = String(this.gameState.players.moon.hp);
    if (sunHp) sunHp.textContent = String(this.gameState.players.sun.hp);
    if (turnPlayer) {
      turnPlayer.textContent = this.gameState.winner
        ? `${this.playerName(this.gameState.winner)} venceu`
        : this.playerName(active);
    }
    if (turnNumber) turnNumber.textContent = `#${this.gameState.turn}`;
    if (turnDot) turnDot.style.background = active === 'moon' ? '#9b79bb' : '#d88a4d';
    if (energy) {
      energy.textContent = `${'🐾 '.repeat(player.energy)}${'· '.repeat(Math.max(0, player.maxEnergy - player.energy))}`.trim();
    }
    if (log) log.textContent = this.gameState.log[0] ?? 'Miau.';
  }

  private renderCards(): void {
    const container = document.querySelector<HTMLElement>('#cards');
    if (!container) return;
    container.replaceChildren();

    const player = this.gameState.players[this.gameState.activePlayer];
    const cards: CardId[] = ['fish_bomb', 'swap_places', 'spilled_milk', 'yarnado', 'orange_braincell'];

    for (const card of cards) {
      const button = document.createElement('button');
      const available = player.hand.includes(card);
      button.type = 'button';
      button.dataset.card = card;
      button.className = `card-button${this.selectedCard === card ? ' selected' : ''}`;
      button.disabled = !available || player.energy < CARD_COSTS[card] || Boolean(this.gameState.winner);
      button.innerHTML = [
        '<span class="card-grain" aria-hidden="true"></span>',
        `<img class="card-art" src="/assets/cards/${card}.svg" alt="" aria-hidden="true" />`,
        `<span class="card-cost">${CARD_COSTS[card]} <span>🐾</span></span>`,
        `<span class="card-icon" aria-hidden="true">${CARD_ICONS[card]}</span>`,
        `<strong>${CARD_NAMES[card]}</strong>`,
        `<small>${available ? CARD_DESCRIPTIONS[card] : 'Carta já usada nesta partida.'}</small>`,
      ].join('');
      button.addEventListener('click', () => {
        this.selectedCard = card;
        this.selectedUnitId = null;
        this.swapFirstUnitId = null;
        this.setStatus(this.cardInstruction(card));
        this.renderEverything();
        this.playTone(620, 0.04, 'sine', 0.015);
      });
      container.appendChild(button);
    }
  }

  private setStatus(message: string): void {
    const status = document.querySelector<HTMLElement>('#status');
    if (status) status.textContent = message;
  }

  private prettyUnit(unit: Unit): string {
    const labels: Record<UnitKind, string> = {
      lord: 'Lorde Gato',
      knight: 'Cavaleiro-Gato',
      witch: 'Gata Bruxa',
      kitten: 'Filhote',
    };
    return labels[unit.kind];
  }

  private playerName(player: PlayerId): string {
    return player === 'moon' ? 'Lua' : 'Sol';
  }

  private cardInstruction(card: CardId): string {
    if (card === 'fish_bomb') return 'Fish Bomb: escolha a casa central da explosão 3×3.';
    if (card === 'spilled_milk') return 'Spilled Milk: escolha uma casa para cobrir de leite.';
    if (card === 'yarnado') return 'Yarnado: clique em qualquer casa da fileira que será devastada.';
    if (card === 'swap_places') return 'Swap Places: escolha dois gatos que não sejam Lordes.';
    return 'One Orange Braincell: escolha um gato seu e aceite as consequências.';
  }
}
