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

  constructor() {
    super('CATastrophe');
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

    this.drawBackdrop();

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

        const shadow = this.add.rectangle(centerX + 2, centerY + 3, TILE_SIZE - 6, TILE_SIZE - 6, 0x100c0a, 0.25);
        const square = this.add
          .rectangle(centerX, centerY, TILE_SIZE - 7, TILE_SIZE - 7, fill, alpha)
          .setStrokeStyle(
            isLegal ? 4 : isAttackable ? 4 : 2,
            isLegal ? 0xf0d66d : isAttackable ? 0xdf5548 : 0x4a362e,
            1,
          )
          .setInteractive({ useHandCursor: true });

        square.on('pointerdown', () => this.handleTileClick(position));
        this.boardLayer.add([shadow, square]);

        if (isLegal) {
          const marker = this.add.circle(centerX, centerY, 9, 0xf0d66d, 0.7).setStrokeStyle(2, 0x5a4227, 0.8);
          this.boardLayer.add(marker);
        }

        this.drawTileDetail(tile?.kind ?? 'floor', centerX, centerY, x, y);

        if (occupant) this.renderUnit(occupant, centerX, centerY, isAttackable);
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
    const moon = unit.owner === 'moon';
    const fur = moon ? 0x6c507c : 0xc47740;
    const furDark = moon ? 0x463551 : 0x7b462d;
    const muzzle = moon ? 0xd9c7df : 0xf1d1ac;
    const ink = 0x241917;
    const outline = isSelected ? 0xf4d86e : attackable ? 0xef6255 : ink;

    const shadow = this.add.ellipse(x + 2, y + 29, 62, 20, 0x100b09, 0.42);
    const body = this.add.ellipse(x, y + 8, unit.kind === 'kitten' ? 45 : 57, unit.kind === 'kitten' ? 48 : 60, fur, 1)
      .setStrokeStyle(isSelected || attackable ? 4 : 3, outline, 1);
    const head = this.add.circle(x, y - 12, unit.kind === 'kitten' ? 22 : 26, fur, 1)
      .setStrokeStyle(3, outline, 1);
    const earL = this.add.triangle(x - 18, y - 31, 0, 21, 12, 0, 22, 21, fur, 1)
      .setStrokeStyle(2, outline, 1)
      .setRotation(-0.08);
    const earR = this.add.triangle(x + 18, y - 31, 0, 21, 10, 0, 22, 21, fur, 1)
      .setStrokeStyle(2, outline, 1)
      .setRotation(0.08);

    const muzzlePatch = this.add.ellipse(x, y - 3, 25, 16, muzzle, 0.92);
    const eyeL = this.add.circle(x - 8, y - 14, 2.7, ink, 1);
    const eyeR = this.add.circle(x + 8, y - 14, 2.7, ink, 1);
    const nose = this.add.triangle(x, y - 5, 0, 0, 7, 0, 3.5, 5, 0xb86663, 1);
    const mouthL = this.add.line(x - 3, y, 0, 0, -6, 4, ink, 0.85).setLineWidth(1.4);
    const mouthR = this.add.line(x + 3, y, 0, 0, 6, 4, ink, 0.85).setLineWidth(1.4);
    const whiskerL = this.add.line(x - 16, y - 1, 0, 0, -16, -2, ink, 0.55).setLineWidth(1);
    const whiskerR = this.add.line(x + 16, y - 1, 0, 0, 16, -2, ink, 0.55).setLineWidth(1);
    const tail = this.add.arc(x + 24, y + 13, 19, 250, 80, false, furDark, 0)
      .setStrokeStyle(6, furDark, 1)
      .setRotation(0.18);

    const parts: Phaser.GameObjects.GameObject[] = [
      shadow, tail, body, earL, earR, head, muzzlePatch, eyeL, eyeR, nose, mouthL, mouthR, whiskerL, whiskerR,
    ];

    this.addClassAccessory(unit, x, y, furDark, outline, parts);

    const label = this.add.text(x, y + 36, UNIT_SHORT_NAMES[unit.kind], {
      fontFamily: 'Georgia, serif',
      fontSize: unit.kind === 'kitten' ? '8px' : '9px',
      color: '#f7e7cf',
      backgroundColor: '#211613',
      padding: { x: 4, y: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const hp = this.add.text(x + 23, y - 39, \`${unit.hp}♥\`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#ffd5c7',
      backgroundColor: '#211613',
      padding: { x: 4, y: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5);

    parts.push(label, hp);

    for (const object of parts) {
      if ('setInteractive' in object && typeof object.setInteractive === 'function') {
        object.setInteractive({ useHandCursor: true });
        object.on('pointerdown', () => this.handleUnitClick(unit.id));
      }
      this.boardLayer.add(object);
    }

    if (isSelected) {
      this.tweens.add({
        targets: [body, head],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  private addClassAccessory(
    unit: Unit,
    x: number,
    y: number,
    dark: number,
    outline: number,
    parts: Phaser.GameObjects.GameObject[],
  ): void {
    if (unit.kind === 'lord') {
      const crown = this.add.triangle(x, y - 46, 0, 18, 13, 0, 26, 18, 0xd5ae55, 1)
        .setStrokeStyle(2, outline, 1);
      const jewel = this.add.circle(x, y - 43, 3, unit.owner === 'moon' ? 0x7e69c8 : 0xd85e43, 1);
      parts.push(crown, jewel);
      return;
    }

    if (unit.kind === 'knight') {
      const scarf = this.add.rectangle(x, y + 16, 42, 8, 0x8d3f3f, 1).setRotation(-0.08);
      const plume = this.add.line(x + 19, y - 36, 0, 0, 8, -13, 0xd7bc71, 1).setLineWidth(4);
      parts.push(scarf, plume);
      return;
    }

    if (unit.kind === 'witch') {
      const brim = this.add.rectangle(x, y - 40, 44, 7, dark, 1).setRotation(-0.08);
      const hat = this.add.triangle(x - 1, y - 54, 0, 25, 18, 0, 34, 26, dark, 1)
        .setStrokeStyle(2, outline, 1)
        .setRotation(-0.05);
      const star = this.add.text(x + 1, y - 50, '✦', {
        fontSize: '11px',
        color: '#f2d46e',
      }).setOrigin(0.5);
      parts.push(brim, hat, star);
      return;
    }

    const tuft = this.add.triangle(x, y - 35, 0, 10, 7, 0, 14, 10, dark, 1).setRotation(0.15);
    parts.push(tuft);
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
      this.setStatus(\`${this.prettyUnit(clicked)} selecionado. Dourado = mover. Vermelho = atacar.\`);
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
      return;
    }

    this.gameState = nextState;
    this.selectedUnitId = null;
    this.selectedCard = null;
    this.swapFirstUnitId = null;
    this.setStatus(
      this.gameState.winner
        ? \`${this.playerName(this.gameState.winner)} venceu a partida.\`
        : \`Agora é a vez de ${this.playerName(this.gameState.activePlayer)}.\`,
    );
    this.renderEverything();
    this.playFeedback(events);
  }

  private playFeedback(events: GameEvent[]): void {
    const hasDestruction = events.some((event) => event.type === 'tile_changed' && event.kind === 'destroyed');
    const hasDamage = events.some((event) => event.type === 'unit_damaged');
    const hasCard = events.some((event) => event.type === 'card_played');
    const gameOver = events.some((event) => event.type === 'game_over');

    if (hasDestruction) this.cameras.main.shake(220, 0.008);
    else if (hasDamage) this.cameras.main.shake(130, 0.004);

    if (hasCard) this.cameras.main.flash(130, 247, 221, 149, false);
    if (gameOver) {
      this.cameras.main.flash(500, 255, 214, 105, false);
      this.cameras.main.shake(380, 0.009);
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
        ? \`${this.playerName(this.gameState.winner)} venceu\`
        : this.playerName(active);
    }
    if (turnNumber) turnNumber.textContent = \`#${this.gameState.turn}\`;
    if (turnDot) turnDot.style.background = active === 'moon' ? '#9b79bb' : '#d88a4d';
    if (energy) {
      energy.textContent = \`${'🐾 '.repeat(player.energy)}${'· '.repeat(Math.max(0, player.maxEnergy - player.energy))}\`.trim();
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
      button.className = \`card-button${this.selectedCard === card ? ' selected' : ''}\`;
      button.disabled = !available || player.energy < CARD_COSTS[card] || Boolean(this.gameState.winner);
      button.innerHTML = [
        '<span class="card-grain" aria-hidden="true"></span>',
        \`<span class="card-cost">${CARD_COSTS[card]} <span>🐾</span></span>\`,
        \`<span class="card-icon" aria-hidden="true">${CARD_ICONS[card]}</span>\`,
        \`<strong>${CARD_NAMES[card]}</strong>\`,
        \`<small>${available ? CARD_DESCRIPTIONS[card] : 'Carta já usada nesta partida.'}</small>\`,
      ].join('');
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
