import Phaser from 'phaser';
import {
  CARD_COSTS,
  CARD_NAMES,
  applyCommand,
  createInitialState,
  getAttackableUnits,
  getLegalMoves,
} from '../core/game';
import type { CardId, GameState, PlayerId, Position, Unit, UnitKind } from '../core/types';

const TILE_SIZE = 88;
const BOARD_OFFSET = 52;

const UNIT_GLYPHS: Record<UnitKind, string> = {
  lord: '♛',
  knight: '♞',
  witch: '✦',
  kitten: '●',
};

const CARD_DESCRIPTIONS: Record<CardId, string> = {
  fish_bomb: '2 de dano em uma área 3×3. O centro pode virar cratera.',
  swap_places: 'Troque dois gatos que não sejam Lordes.',
  spilled_milk: 'Deixe uma casa escorregadia e faça gatos deslizarem.',
  yarnado: '2 de dano em uma fileira inteira e destrói casas vazias.',
  orange_braincell: 'Cure, se machuque ou teleporte. O cérebro decide.',
};

const CARD_ICONS: Record<CardId, string> = {
  fish_bomb: '🐟',
  swap_places: '↔',
  spilled_milk: '🥛',
  yarnado: '🧶',
  orange_braincell: '🍊',
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

  constructor() {
    super('CATastrophe');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#241a17');
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

  private renderBoard(): void {
    this.boardLayer?.destroy(true);
    this.boardLayer = this.add.container(0, 0);

    const frame = this.add.rectangle(360, 360, 650, 650, 0x2d211d, 1).setStrokeStyle(3, 0x6f5544, 1);
    this.boardLayer.add(frame);

    const legalMoves = this.selectedUnitId ? getLegalMoves(this.gameState, this.selectedUnitId) : [];
    const attackable = this.selectedUnitId ? getAttackableUnits(this.gameState, this.selectedUnitId) : [];

    for (let y = 0; y < this.gameState.boardSize; y += 1) {
      for (let x = 0; x < this.gameState.boardSize; x += 1) {
        const position = { x, y };
        const tile = this.gameState.tiles.find((candidate) => samePosition(candidate.position, position));
        const occupant = this.gameState.units.find((candidate) => samePosition(candidate.position, position));
        const centerX = BOARD_OFFSET + x * TILE_SIZE + TILE_SIZE / 2;
        const centerY = BOARD_OFFSET + y * TILE_SIZE + TILE_SIZE / 2;
        const lightSquare = (x + y) % 2 === 0;

        let fill = lightSquare ? 0xd5ba8a : 0x76576d;
        let alpha = 0.98;
        if (tile?.kind === 'destroyed') {
          fill = 0x16100e;
          alpha = 1;
        } else if (tile?.kind === 'milk') {
          fill = 0xcbd6d0;
        }

        const isLegal = legalMoves.some((move) => samePosition(move, position));
        const isAttackable = occupant ? attackable.some((unit) => unit.id === occupant.id) : false;

        const square = this.add
          .rectangle(centerX, centerY, TILE_SIZE - 4, TILE_SIZE - 4, fill, alpha)
          .setStrokeStyle(isLegal ? 4 : isAttackable ? 4 : 1, isLegal ? 0xe0c96c : isAttackable ? 0xc84f42 : 0x4c382f, 1)
          .setInteractive({ useHandCursor: true });

        square.on('pointerdown', () => this.handleTileClick(position));
        this.boardLayer.add(square);

        if (tile?.kind === 'destroyed') {
          const crack = this.add.text(centerX, centerY, '✹', {
            fontFamily: 'Georgia, serif',
            fontSize: '42px',
            color: '#4a3027',
          }).setOrigin(0.5);
          this.boardLayer.add(crack);
        }

        if (tile?.kind === 'milk') {
          const milk = this.add.text(centerX, centerY, '≈', {
            fontFamily: 'Georgia, serif',
            fontSize: '42px',
            color: '#f4f0df',
          }).setOrigin(0.5).setAlpha(0.82);
          this.boardLayer.add(milk);
        }

        if (occupant) this.renderUnit(occupant, centerX, centerY, isAttackable);
      }
    }

    for (let index = 0; index < 7; index += 1) {
      const labelX = BOARD_OFFSET + index * TILE_SIZE + TILE_SIZE / 2;
      const labelY = BOARD_OFFSET + index * TILE_SIZE + TILE_SIZE / 2;
      this.boardLayer.add(this.add.text(labelX, 28, String.fromCharCode(65 + index), {
        fontSize: '13px', color: '#aa9581', fontStyle: 'bold',
      }).setOrigin(0.5));
      this.boardLayer.add(this.add.text(28, labelY, String(index + 1), {
        fontSize: '13px', color: '#aa9581', fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  private renderUnit(unit: Unit, x: number, y: number, attackable: boolean): void {
    if (!this.boardLayer) return;

    const isSelected = unit.id === this.selectedUnitId || unit.id === this.swapFirstUnitId;
    const primary = unit.owner === 'moon' ? 0x5f456f : 0xb66b38;
    const outline = isSelected ? 0xf1d06d : attackable ? 0xe55e4e : 0x2a1a17;

    const base = this.add.circle(x, y + 6, 30, primary, 1).setStrokeStyle(isSelected || attackable ? 4 : 2, outline, 1);
    const ears = this.add.triangle(x - 18, y - 14, 0, 18, 12, 0, 22, 20, primary, 1);
    const ears2 = this.add.triangle(x + 18, y - 14, 0, 20, 10, 0, 22, 18, primary, 1);
    const glyph = this.add.text(x, y + 3, UNIT_GLYPHS[unit.kind], {
      fontFamily: 'Georgia, serif',
      fontSize: unit.kind === 'kitten' ? '24px' : '30px',
      color: '#f8ead1',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hp = this.add.text(x, y + 34, `${unit.hp}♥`, {
      fontSize: '11px',
      color: '#f6c3b5',
      backgroundColor: '#1c1412',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    for (const object of [base, ears, ears2, glyph, hp]) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerdown', () => this.handleUnitClick(unit.id));
      this.boardLayer.add(object);
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
    this.consumeResult(result.ok, result.state, result.error ?? 'Movimento inválido.');
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
      this.setStatus(`${this.prettyUnit(clicked)} selecionado. Casas douradas são movimentos; inimigos vermelhos podem ser atacados.`);
      this.renderEverything();
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
    this.consumeResult(result.ok, result.state, result.error ?? 'Ataque inválido.');
  }

  private playCard(targets: { target?: Position; targetUnitId?: string; secondUnitId?: string }): void {
    if (!this.selectedCard) return;
    const result = applyCommand(this.gameState, {
      type: 'play_card',
      player: this.gameState.activePlayer,
      card: this.selectedCard,
      ...targets,
    });
    this.consumeResult(result.ok, result.state, result.error ?? 'Não foi possível jogar essa carta.');
  }

  private consumeResult(ok: boolean, nextState: GameState, error: string): void {
    if (!ok) {
      this.setStatus(error);
      return;
    }

    this.gameState = nextState;
    this.selectedUnitId = null;
    this.selectedCard = null;
    this.swapFirstUnitId = null;
    this.setStatus(this.gameState.winner ? `${this.playerName(this.gameState.winner)} venceu a partida.` : `Agora é a vez de ${this.playerName(this.gameState.activePlayer)}.`);
    this.renderEverything();
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
    if (turnPlayer) turnPlayer.textContent = this.gameState.winner ? `${this.playerName(this.gameState.winner)} venceu` : this.playerName(active);
    if (turnNumber) turnNumber.textContent = `#${this.gameState.turn}`;
    if (turnDot) turnDot.style.background = active === 'moon' ? '#9473b8' : '#d28a4f';
    if (energy) energy.textContent = `${'🐾 '.repeat(player.energy)}${'· '.repeat(Math.max(0, player.maxEnergy - player.energy))}`.trim();
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
      button.className = `card-button${this.selectedCard === card ? ' selected' : ''}`;
      button.disabled = !available || player.energy < CARD_COSTS[card] || Boolean(this.gameState.winner);
      button.innerHTML = `<span class="card-cost">${CARD_COSTS[card]} 🐾</span><strong>${CARD_ICONS[card]} ${CARD_NAMES[card]}</strong><small>${available ? CARD_DESCRIPTIONS[card] : 'Carta já usada nesta partida.'}</small>`;
      button.addEventListener('click', () => {
        this.selectedCard = card;
        this.selectedUnitId = null;
        this.swapFirstUnitId = null;
        this.setStatus(this.cardInstruction(card));
        this.renderEverything();
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
