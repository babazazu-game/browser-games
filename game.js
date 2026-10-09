/* Merge-оборона — вся логика игры в одном файле. */
const WIDTH = 900, HEIGHT = 650, COLS = 10, ROWS = 7, CELL = 64;
const GX = 130, GY = 112;

const TOWERS = {
  archer: { name: 'Лучник', price: 50, damage: 12, range: 118, cooldown: 620, color: 0x62b94f, frame: 0 },
  cannon: { name: 'Пушка', price: 75, damage: 27, range: 105, cooldown: 1050, color: 0xe18a36, frame: 1 },
  mage:   { name: 'Маг', price: 100, damage: 19, range: 138, cooldown: 820, color: 0x8b62dc, frame: 2 }
};
const ENEMIES = {
  normal: { hp: 62, speed: 55, reward: 12, frame: 3, color: 0xd9574f },
  fast:   { hp: 42, speed: 92, reward: 14, frame: 4, color: 0xe7bd3b },
  tank:   { hp: 145, speed: 37, reward: 20, frame: 5, color: 0x59416f }
};

// Клетки пути задают строгий серпантин сверху вниз.
const pathCells = [];
for (let x = 0; x < COLS; x++) pathCells.push([x, 0]);
for (let y = 1; y <= 2; y++) pathCells.push([9, y]);
for (let x = 8; x >= 0; x--) pathCells.push([x, 2]);
for (let y = 3; y <= 4; y++) pathCells.push([0, y]);
for (let x = 1; x < COLS; x++) pathCells.push([x, 4]);
for (let y = 5; y <= 6; y++) pathCells.push([9, y]);
for (let x = 8; x >= 4; x--) pathCells.push([x, 6]);
const roadSet = new Set(pathCells.map(([x, y]) => `${x},${y}`));
const center = ([x, y]) => ({ x: GX + x * CELL + CELL / 2, y: GY + y * CELL + CELL / 2 });
const waypoints = [{ x: center(pathCells[0]).x, y: GY - 42 }, ...pathCells.map(center),
  { x: center(pathCells.at(-1)).x, y: GY + ROWS * CELL + 44 }];

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    this.load.spritesheet('atlas', 'assets/sprites.png', { frameWidth: 512, frameHeight: 512 });
  }

  create() {
    this.gold = 150; this.baseHP = 20; this.wave = 0; this.paused = false;
    this.gameOver = false; this.enemies = []; this.towers = []; this.menu = null;
    this.waveActive = false; this.spawnLeft = 0; this.nextWaveAt = this.time.now + 2500;
    this.audioCtx = null;

    this.makeFallbackTextures();
    this.drawBoard();
    this.createUI();
    this.input.on('pointerdown', () => this.ensureAudio(), this);

    this.input.on('dragstart', (_, tower) => {
      if (this.paused || this.gameOver || !tower.getData('tower')) return;
      tower.setData('dragged', true).setDepth(30).setAlpha(0.82);
    });
    this.input.on('drag', (_, tower, x, y) => {
      if (tower.getData('tower')) tower.setPosition(x, y);
    });
    this.input.on('dragend', (_, tower) => this.finishDrag(tower));
    this.updateUI();
  }

  makeFallbackTextures() {
    const make = (key, color, enemy = false) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, .25).fillCircle(34, 37, 24);
      g.fillStyle(color).fillCircle(32, 32, enemy ? 23 : 26);
      g.lineStyle(4, enemy ? 0x301d1d : 0xe7d19b, 1).strokeCircle(32, 32, enemy ? 21 : 25);
      if (enemy) g.fillStyle(0xffffff).fillCircle(24, 28, 4).fillCircle(40, 28, 4);
      else g.fillStyle(0x3b3026).fillRect(28, 12, 8, 40);
      g.generateTexture(key, 64, 64); g.destroy();
    };
    Object.entries(TOWERS).forEach(([k, v]) => make(`fallback-${k}`, v.color));
    Object.entries(ENEMIES).forEach(([k, v]) => make(`fallback-${k}`, v.color, true));
  }

  drawBoard() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x173322, 0x173322, 0x0d2218, 0x0d2218, 1).fillRect(0, 0, WIDTH, HEIGHT);
    bg.fillStyle(0x294f32).fillRoundedRect(GX - 16, GY - 16, COLS * CELL + 32, ROWS * CELL + 32, 18);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const road = roadSet.has(`${x},${y}`), px = GX + x * CELL, py = GY + y * CELL;
      bg.fillStyle(road ? 0x9a7953 : ((x + y) % 2 ? 0x478b4c : 0x509a54));
      bg.fillRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 8);
      bg.lineStyle(1, road ? 0xb79a70 : 0x6aad66, .45).strokeRoundedRect(px + 2, py + 2, CELL - 4, CELL - 4, 8);
      if (!road) {
        const hit = this.add.rectangle(px + CELL / 2, py + CELL / 2, CELL - 5, CELL - 5, 0xffffff, .001)
          .setInteractive({ useHandCursor: true });
        hit.setData({ cx: x, cy: y });
        hit.on('pointerover', () => hit.setFillStyle(0xd8f1a0, .18));
        hit.on('pointerout', () => hit.setFillStyle(0xffffff, .001));
        hit.on('pointerdown', (p) => { p.event.stopPropagation(); this.openBuildMenu(x, y); });
      }
    }
    this.add.text(GX + 8, GY - 35, 'ВХОД', { fontSize: '16px', color: '#ffd99b', fontStyle: 'bold' });
    const end = waypoints.at(-1);
    this.add.circle(end.x, end.y, 31, 0x4c72bd).setStrokeStyle(5, 0xb9d2ff);
    this.add.text(end.x, end.y, 'БАЗА', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(.5);
  }

  createUI() {
    this.add.rectangle(WIDTH / 2, 45, WIDTH - 40, 70, 0x101918, .96).setStrokeStyle(2, 0x4d7859);
    const style = { fontSize: '22px', color: '#f4f0da', fontStyle: 'bold' };
    this.goldText = this.add.text(48, 45, '', style).setOrigin(0, .5);
    this.waveText = this.add.text(330, 45, '', style).setOrigin(0, .5);
    this.hpText = this.add.text(565, 45, '', style).setOrigin(0, .5);
    this.pauseBtn = this.add.text(820, 45, '⏸', { fontSize: '28px', color: '#fff', backgroundColor: '#31543d', padding: { x: 12, y: 5 } })
      .setOrigin(.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.togglePause());
    this.statusText = this.add.text(WIDTH / 2, 88, '', { fontSize: '18px', color: '#ffe7a4', fontStyle: 'bold' }).setOrigin(.5);
  }

  openBuildMenu(cx, cy) {
    if (this.paused || this.gameOver || this.towerAt(cx, cy)) return;
    this.closeMenu();
    const px = GX + cx * CELL + CELL / 2, py = GY + cy * CELL + CELL / 2;
    const menuY = Phaser.Math.Clamp(py, 150, HEIGHT - 80);
    const c = this.add.container(Phaser.Math.Clamp(px, 155, WIDTH - 155), menuY).setDepth(50);
    c.add(this.add.rectangle(0, 0, 300, 70, 0x101918, .98).setStrokeStyle(2, 0xe5c875));
    Object.entries(TOWERS).forEach(([key, t], i) => {
      const x = -100 + i * 100;
      const button = this.add.rectangle(x, 0, 92, 58, t.color, .82).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, -12, t.name, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(.5);
      const price = this.add.text(x, 12, `${t.price} 🪙`, { fontSize: '13px', color: '#ffe6a1' }).setOrigin(.5);
      button.on('pointerdown', (p) => { p.event.stopPropagation(); this.buyTower(key, cx, cy); });
      c.add([button, label, price]);
    });
    this.menu = c;
  }

  closeMenu() { if (this.menu) this.menu.destroy(true); this.menu = null; }

  buyTower(type, cx, cy) {
    const cfg = TOWERS[type];
    if (this.gold < cfg.price) { this.flashStatus('Не хватает золота!', '#ff9d91'); return; }
    if (this.towerAt(cx, cy)) return this.closeMenu();
    this.gold -= cfg.price; this.createTower(type, 1, cx, cy); this.closeMenu(); this.updateUI();
  }

  makeSprite(kind, type, frame, size) {
    const atlasOK = this.textures.exists('atlas') && this.textures.get('atlas').key !== '__MISSING';
    const obj = atlasOK ? this.add.image(0, 0, 'atlas', frame) : this.add.image(0, 0, `fallback-${type}`);
    obj.setDisplaySize(size, size);
    return obj;
  }

  createTower(type, level, cx, cy) {
    const pos = center([cx, cy]), cfg = TOWERS[type];
    const tower = this.add.container(pos.x, pos.y).setSize(58, 58).setInteractive({ useHandCursor: true });
    const sprite = this.makeSprite('tower', type, cfg.frame, 60);
    const badge = this.add.circle(20, 20, 12, 0x101918, .95).setStrokeStyle(2, 0xffdc71);
    const levelText = this.add.text(20, 20, `${level}`, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(.5);
    tower.add([sprite, badge, levelText]);
    tower.setData({ tower: true, type, level, cx, cy, homeX: pos.x, homeY: pos.y, nextShot: 0, levelText, dragged: false });
    this.input.setDraggable(tower); this.towers.push(tower); return tower;
  }

  finishDrag(tower) {
    if (!tower.active || !tower.getData('tower')) return;
    const target = this.towers.find(t => t !== tower && t.active && Phaser.Math.Distance.Between(t.x, t.y, tower.x, tower.y) < 38);
    const same = target && target.getData('type') === tower.getData('type') && target.getData('level') === tower.getData('level');
    if (same && target.getData('level') < 5) {
      const level = target.getData('level') + 1;
      target.setData('level', level); target.getData('levelText').setText(level);
      this.tweens.add({ targets: target, scale: 1.35, duration: 150, yoyo: true });
      this.towers = this.towers.filter(t => t !== tower); tower.destroy(true);
      this.flashStatus(`Слияние! ${TOWERS[target.getData('type')].name} — уровень ${level}`, '#aef5b0');
      this.soundEffect('merge');
    } else {
      if (same) this.flashStatus('Максимальный уровень — 5', '#ffe3a3');
      this.tweens.add({ targets: tower, x: tower.getData('homeX'), y: tower.getData('homeY'), duration: 180, ease: 'Back.out' });
      tower.setDepth(5).setAlpha(1).setData('dragged', false);
    }
  }

  towerAt(cx, cy) { return this.towers.find(t => t.active && t.getData('cx') === cx && t.getData('cy') === cy); }

  startWave() {
    if (this.wave >= 10) return;
    this.wave++; this.waveActive = true; this.spawnLeft = 6 + this.wave * 2;
    this.spawnTimer = 0; this.updateUI(); this.soundEffect('wave');
    this.flashStatus(`Волна ${this.wave} начинается!`, '#ffe28a');
  }

  spawnEnemy() {
    const n = (6 + this.wave * 2) - this.spawnLeft;
    const type = n % 5 === 4 ? 'tank' : n % 3 === 2 ? 'fast' : 'normal';
    const cfg = ENEMIES[type], hp = Math.round(cfg.hp * Math.pow(1.3, this.wave - 1));
    const sprite = this.makeSprite('enemy', type, cfg.frame, type === 'tank' ? 58 : 50).setPosition(waypoints[0].x, waypoints[0].y).setDepth(10);
    sprite.setData({ enemy: true, type, hp, maxHp: hp, speed: cfg.speed, reward: cfg.reward, wp: 1 });
    const barBg = this.add.rectangle(sprite.x, sprite.y - 30, 48, 6, 0x351d1d).setDepth(11);
    const bar = this.add.rectangle(sprite.x - 24, sprite.y - 30, 48, 6, 0x79d66f).setOrigin(0, .5).setDepth(12);
    sprite.setData('barBg', barBg); sprite.setData('bar', bar);
    this.enemies.push(sprite);
  }

  update(time, delta) {
    if (this.paused || this.gameOver) return;
    if (!this.waveActive && time >= this.nextWaveAt) this.startWave();
    if (this.waveActive && this.spawnLeft > 0) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) { this.spawnEnemy(); this.spawnLeft--; this.spawnTimer = Math.max(420, 900 - this.wave * 25); }
    }
    this.moveEnemies(delta);
    this.updateTowers(time);
    if (this.waveActive && this.spawnLeft === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      if (this.wave === 10) this.finishGame(true);
      else { this.nextWaveAt = time + 10000; this.flashStatus('Передышка: 10 секунд', '#b8e4ff'); }
    }
    if (!this.waveActive && this.wave < 10) {
      const left = Math.max(0, Math.ceil((this.nextWaveAt - time) / 1000));
      this.statusText.setText(`Следующая волна через ${left} сек.`);
    }
  }

  moveEnemies(delta) {
    [...this.enemies].forEach(e => {
      if (!e.active) return;
      const p = waypoints[e.getData('wp')], dist = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      const step = e.getData('speed') * delta / 1000;
      if (dist <= step + 1) {
        e.setPosition(p.x, p.y); e.setData('wp', e.getData('wp') + 1);
        if (e.getData('wp') >= waypoints.length) this.enemyReachedBase(e);
      } else {
        const a = Phaser.Math.Angle.Between(e.x, e.y, p.x, p.y);
        e.x += Math.cos(a) * step; e.y += Math.sin(a) * step;
      }
      if (e.active) { e.getData('barBg').setPosition(e.x, e.y - 30); e.getData('bar').setPosition(e.x - 24, e.y - 30); }
    });
  }

  updateTowers(time) {
    this.towers.forEach(t => {
      if (!t.active || t.getData('dragged') || time < t.getData('nextShot')) return;
      const cfg = TOWERS[t.getData('type')], level = t.getData('level');
      const range = cfg.range * Math.pow(1.2, level - 1);
      const target = this.enemies.filter(e => e.active && e.getData('hp') > 0 && Phaser.Math.Distance.Between(t.x, t.y, e.x, e.y) <= range)
        .sort((a, b) => b.getData('wp') - a.getData('wp'))[0];
      if (target) {
        t.setData('nextShot', time + cfg.cooldown * Math.pow(.94, level - 1));
        this.fire(t, target, cfg.damage * Math.pow(2, level - 1), cfg.color);
      }
    });
  }

  fire(tower, target, damage, color) {
    const shot = this.add.circle(tower.x, tower.y, tower.getData('type') === 'cannon' ? 7 : 4, color).setDepth(20);
    this.soundEffect('shot', tower.getData('type'));
    this.tweens.add({ targets: shot, x: target.x, y: target.y, duration: 130, onComplete: () => {
      shot.destroy(); if (target.active) this.damageEnemy(target, damage);
    }});
  }

  damageEnemy(enemy, damage) {
    const hp = enemy.getData('hp') - damage; enemy.setData('hp', hp);
    enemy.getData('bar').displayWidth = 48 * Math.max(0, hp / enemy.getData('maxHp'));
    enemy.setTintFill(0xffffff); this.time.delayedCall(55, () => enemy.active && enemy.clearTint());
    if (hp <= 0) {
      this.gold += enemy.getData('reward'); this.soundEffect('death');
      this.tweens.add({ targets: enemy, alpha: 0, scale: .3, duration: 180, onComplete: () => this.removeEnemy(enemy) });
      enemy.setData('hp', -999999); this.enemies = this.enemies.filter(e => e !== enemy); this.updateUI();
    }
  }

  removeEnemy(enemy) {
    if (!enemy.active) return;
    enemy.getData('barBg').destroy(); enemy.getData('bar').destroy();
    enemy.destroy();
  }

  enemyReachedBase(enemy) {
    this.enemies = this.enemies.filter(e => e !== enemy); this.removeEnemy(enemy);
    this.baseHP--; this.cameras.main.shake(120, .006); this.updateUI();
    if (this.baseHP <= 0) this.finishGame(false);
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused; this.pauseBtn.setText(this.paused ? '▶' : '⏸');
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics?.pause(); this.tweens.pauseAll(); this.statusText.setText('ПАУЗА');
    } else {
      // Сдвигаем абсолютный таймер, чтобы пауза не съедала время перед волной.
      if (!this.waveActive) this.nextWaveAt += this.time.now - this.pausedAt;
      this.physics?.resume(); this.tweens.resumeAll();
    }
  }

  finishGame(win) {
    this.gameOver = true; this.closeMenu();
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07100c, .82).setDepth(100);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 45, win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ', {
      fontSize: '58px', color: win ? '#ffe278' : '#ff8a80', fontStyle: 'bold'
    }).setOrigin(.5).setDepth(101);
    this.add.text(WIDTH / 2, HEIGHT / 2 + 30, win ? 'Все 10 волн отбиты' : 'База разрушена', { fontSize: '24px', color: '#fff' }).setOrigin(.5).setDepth(101);
    const again = this.add.text(WIDTH / 2, HEIGHT / 2 + 95, 'Играть снова', { fontSize: '22px', color: '#132016', backgroundColor: '#d7e99d', padding: { x: 22, y: 12 } })
      .setOrigin(.5).setDepth(101).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart());
  }

  updateUI() {
    this.goldText.setText(`🪙 Золото: ${this.gold}`);
    this.waveText.setText(`Волна: ${this.wave}/10`);
    this.hpText.setText(`💙 База: ${this.baseHP}/20`);
  }

  flashStatus(text, color = '#ffe7a4') {
    this.statusText.setColor(color).setText(text);
    this.time.delayedCall(1800, () => { if (!this.gameOver && this.waveActive) this.statusText.setText(''); });
  }

  ensureAudio() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  // Мягкие синтезированные звуки: синусоидальные тоны с фильтрацией и плавным спадом.
  soundEffect(kind, variant = '') {
    this.ensureAudio(); const c = this.audioCtx, now = c.currentTime;
    const osc = c.createOscillator(), gain = c.createGain(), filter = c.createBiquadFilter();
    osc.type = kind === 'death' ? 'triangle' : 'sine';
    const freq = kind === 'wave' ? 260 : kind === 'death' ? 155 : kind === 'merge' ? 420 : variant === 'cannon' ? 90 : variant === 'mage' ? 520 : 330;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'wave' || kind === 'merge' ? freq * 1.7 : Math.max(45, freq * .58), now + .22);
    filter.type = 'lowpass'; filter.frequency.value = kind === 'shot' ? 1100 : 1500; filter.Q.value = .7;
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.09, now + .018); gain.gain.exponentialRampToValueAtTime(.0001, now + .28);
    osc.connect(filter).connect(gain).connect(c.destination); osc.start(now); osc.stop(now + .3);
  }
}

new Phaser.Game({
  type: Phaser.AUTO, width: WIDTH, height: HEIGHT, parent: document.body,
  backgroundColor: '#13271b', scene: GameScene,
  render: { antialias: true, pixelArt: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
