import Phaser from 'phaser';
import './styles.css';
import './intro.css';
import './v02.css';
import { GameScene } from './game/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 720,
  backgroundColor: '#241a17',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

const intro = document.querySelector<HTMLElement>('#game-intro');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');

startButton?.addEventListener('click', () => {
  if (!intro) return;
  intro.classList.add('is-leaving');
  window.setTimeout(() => intro.remove(), 360);
});
