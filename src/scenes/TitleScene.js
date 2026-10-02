import Phaser from 'phaser';
import { STARTERS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { state, setPlayer } from '../state.js';
import { COLORS, makeButton, textStyle } from '../ui.js';

const CARD_W = 180;
const CARD_H = 200;
const CARD_GAP = 24;
const CARD_Y = 408;

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = this.scale.width / 2;
    this.selected = state.starter;
    this.cards = new Map();

    this.add.text(cx, 76, 'FETCH TOWER', textStyle(44, COLORS.accentText)).setOrigin(0.5);
    this.add.text(cx, 128, 'WEEK 2  ·  CLIMB TO THE TOP', textStyle(12, COLORS.muted)).setOrigin(0.5);

    this.add.text(cx, 180, 'YOUR NICKNAME', textStyle(12)).setOrigin(0.5);
    this.createNicknameInput(cx, 222);

    this.add.text(cx, 278, 'CHOOSE YOUR STARTER', textStyle(12)).setOrigin(0.5);
    const rowWidth = STARTERS.length * CARD_W + (STARTERS.length - 1) * CARD_GAP;
    STARTERS.forEach((starter, i) => {
      const x = cx - rowWidth / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      this.cards.set(starter.id, this.createCard(x, CARD_Y, starter));
    });

    this.message = this.add.text(cx, 536, '', textStyle(10, COLORS.muted)).setOrigin(0.5);
    this.playButton = makeButton(this, cx, 584, 'PLAY', () => this.play());

    this.refresh();
    this.loadStarterSprites();
  }

  createNicknameInput(x, y) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ft-input';
    input.maxLength = 16;
    input.placeholder = 'Name or nickname';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = state.nickname;
    input.addEventListener('input', () => this.refresh());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.play();
    });

    this.add.dom(x, y, input);
    this.nicknameInput = input;
  }

  createCard(x, y, starter) {
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setStrokeStyle(4, COLORS.border);
    const number = this.add
      .text(-CARD_W / 2 + 12, -CARD_H / 2 + 12, `#${String(starter.id).padStart(3, '0')}`, textStyle(10, COLORS.muted));
    const loading = this.add.text(0, -16, '...', textStyle(14, COLORS.muted)).setOrigin(0.5);
    const name = this.add.text(0, 72, starter.name.toUpperCase(), textStyle(12)).setOrigin(0.5);

    const card = this.add.container(x, y, [bg, number, loading, name]).setSize(CARD_W, CARD_H);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerover', () => this.selected !== starter.id && bg.setFillStyle(COLORS.panelHover));
    card.on('pointerout', () => bg.setFillStyle(COLORS.panel));
    card.on('pointerdown', () => {
      this.selected = starter.id;
      this.refresh();
    });

    return { card, bg, name, loading, id: starter.id };
  }

  // Fetch each starter from PokéAPI, then load its real sprite and name into the card.
  async loadStarterSprites() {
    let pokemon;
    try {
      pokemon = await Promise.all(STARTERS.map((s) => getPokemon(s.id)));
    } catch {
      if (!this.sys.isActive()) return;
      this.cards.forEach((c) => c.loading.setText('?'));
      this.message.setText("Couldn't reach PokéAPI. Check your internet and reload.").setColor(COLORS.error);
      return;
    }
    if (!this.sys.isActive()) return;

    this.load.setCORS('anonymous');
    pokemon.forEach((p) => {
      const key = `poke-${p.id}`;
      if (p.sprite && !this.textures.exists(key)) this.load.image(key, p.sprite);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.sys.isActive()) return;
      pokemon.forEach((p) => {
        const card = this.cards.get(p.id);
        card.name.setText(capitalize(p.name).toUpperCase());
        if (!this.textures.exists(`poke-${p.id}`)) return;
        card.loading.destroy();
        const sprite = this.add.image(0, -16, `poke-${p.id}`).setScale(2);
        card.card.addAt(sprite, 1);
      });
    });
    this.load.start();
  }

  refresh() {
    this.cards.forEach((c) => {
      const isSelected = c.id === this.selected;
      c.bg.setStrokeStyle(4, isSelected ? COLORS.accent : COLORS.border);
      c.name.setColor(isSelected ? COLORS.accentText : COLORS.text);
    });

    const nickname = this.nicknameInput.value.trim();
    const ready = nickname.length > 0 && this.selected != null;
    this.playButton.setEnabled(ready);

    if (this.message.style.color === COLORS.error) return;
    if (!nickname) this.message.setText('Type a nickname to start');
    else if (this.selected == null) this.message.setText('Pick a starter');
    else this.message.setText('');
  }

  play() {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname || this.selected == null) return;

    setPlayer(nickname, this.selected);
    this.scene.start('TowerScene');
  }
}
