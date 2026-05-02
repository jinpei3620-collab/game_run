'use strict';

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // ═══════════════════════════════════════════
  //  CREATE
  // ═══════════════════════════════════════════
  create() {
    this.soldierCount = 10;
    this.scrollY      = 0;
    this.lineOffset   = 0;
    this.phase        = 'playing';
    this.shootTimer   = 0;
    this.targetX      = W / 2;

    // スポーンタイマー
    this.panelTimer    = 0;
    this.panelInterval = 1.3;   // 秒
    this.waveTimer     = 0;
    this.waveInterval  = 3.2;   // 秒
    this.waveIndex     = 0;
    this.bossSpawned   = false;

    // グループ
    this.bullets   = this.add.group();
    this.panels    = this.add.group();
    this.enemies   = this.add.group();

    // 背景
    this._buildBackground();
    this.scrollLines = this.add.graphics();

    // 陣形
    this.formation = this.add.container(W / 2, FORMATION_Y);
    this.soldierGfx = [];
    this._rebuildFormation();

    // HUD
    this._createHUD();

    // 入力
    this.input.on('pointermove', p => { this.targetX = p.x; });
    this.input.on('pointerdown', p => { this.targetX = p.x; });
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ═══════════════════════════════════════════
  //  BACKGROUND ─ 左:パネルゾーン / 右:敵ゾーン
  // ═══════════════════════════════════════════
  _buildBackground() {
    const g = this.add.graphics();

    // 外側の草
    g.fillStyle(0x1a3a1a);
    g.fillRect(0, 0, W, H);

    // 左ゾーン（青系）
    g.fillStyle(0x0d1f3c);
    g.fillRect(LANE_L, 0, LANE_W / 2, H);

    // 右ゾーン（赤系）
    g.fillStyle(0x2c0f0f);
    g.fillRect(LANE_CX, 0, LANE_W / 2, H);

    // 外枠ライン
    g.lineStyle(4, 0x888888, 0.7);
    g.beginPath(); g.moveTo(LANE_L, 0); g.lineTo(LANE_L, H); g.strokePath();
    g.beginPath(); g.moveTo(LANE_R, 0); g.lineTo(LANE_R, H); g.strokePath();

    // 中央仕切り線
    g.lineStyle(3, 0xffffff, 0.35);
    g.beginPath(); g.moveTo(LANE_CX, 0); g.lineTo(LANE_CX, H); g.strokePath();

    // ゾーンラベル背景
    g.fillStyle(0x1565c0, 0.25);
    g.fillRect(LANE_L, 0, LANE_W / 2, 36);
    g.fillStyle(0xb71c1c, 0.25);
    g.fillRect(LANE_CX, 0, LANE_W / 2, 36);
  }

  // ═══════════════════════════════════════════
  //  陣形（横一列）
  // ═══════════════════════════════════════════
  _rebuildFormation() {
    this.soldierGfx.forEach(s => s.destroy());
    this.soldierGfx = [];
    this.formation.removeAll(false);

    const n = Math.min(this.soldierCount, MAX_DISPLAY);
    const maxW = LANE_W - 60;
    const spacing = n > 1 ? Math.min(22, Math.floor(maxW / (n - 1))) : 0;
    const totalW  = (n - 1) * spacing;

    for (let i = 0; i < n; i++) {
      const g = this.add.graphics();
      this._drawSoldier(g);
      g.x = -totalW / 2 + i * spacing;
      g.y = 0;
      this.formation.add(g);
      this.soldierGfx.push(g);
    }

    if (this.countBadge) { this.countBadge.destroy(); this.countBadge = null; }
    if (this.soldierCount > MAX_DISPLAY) {
      this.countBadge = this.add.text(
        this.formation.x + totalW / 2 + 18, FORMATION_Y - 4,
        `×${this.soldierCount}`, {
          fontSize: '17px', fontFamily: '"Arial Black"',
          color: '#ffd600', stroke: '#000', strokeThickness: 3,
        }
      ).setOrigin(0, 0.5).setDepth(30);
    }
  }

  _drawSoldier(g) {
    g.fillStyle(0xffcc80); g.fillCircle(0, -9, 7);
    g.fillStyle(0x33691e); g.fillRect(-7, -17, 14, 10);
    g.fillStyle(0x558b2f); g.fillRect(-7, -1, 14, 17);
    g.fillStyle(0x558b2f); g.fillRect(-13, 0, 7, 10); g.fillRect(6, 0, 7, 10);
    g.fillStyle(0x212121); g.fillRect(9, -3, 14, 4);  // 銃（右向き）
    g.fillStyle(0x2e7d32); g.fillRect(-7, 16, 6, 11); g.fillRect(1, 16, 6, 11);
  }

  // ═══════════════════════════════════════════
  //  PANEL（左ゾーン）
  // ═══════════════════════════════════════════
  _spawnPanel() {
    const x = Phaser.Math.Between(PZ_L + 22, PZ_R - 22);
    const con = this.add.container(x, -55);

    const bg = this.add.graphics();
    bg.fillStyle(0x1565c0, 0.92);
    bg.fillCircle(0, 0, 28);
    bg.lineStyle(3, 0x64b5f6, 1);
    bg.strokeCircle(0, 0, 28);

    const txt = this.add.text(0, 0, '+1', {
      fontSize: '22px', fontFamily: '"Arial Black"',
      color: '#ffffff', stroke: '#003', strokeThickness: 3,
    }).setOrigin(0.5);

    con.add([bg, txt]);
    con.setSize(56, 56);
    con.pData = { value: 1, txt, bg };
    this.panels.add(con);
  }

  _hitPanel(panel) {
    panel.pData.value++;
    panel.pData.txt.setText(`+${panel.pData.value}`);

    // 当てるたびに光る
    this.tweens.add({
      targets: panel, scaleX: 1.25, scaleY: 1.25, duration: 70,
      yoyo: true, ease: 'Power2',
    });

    // 数が大きいほど色が変わる（1→青, 5→緑, 10→金）
    const v = panel.pData.value;
    const col = v >= 10 ? 0xffd600 : v >= 5 ? 0x00e676 : 0x64b5f6;
    panel.pData.bg.clear();
    panel.pData.bg.fillStyle(v >= 10 ? 0xe65100 : v >= 5 ? 0x1b5e20 : 0x1565c0, 0.92);
    panel.pData.bg.fillCircle(0, 0, 28);
    panel.pData.bg.lineStyle(3, col, 1);
    panel.pData.bg.strokeCircle(0, 0, 28);
  }

  _collectPanel(panel) {
    const gained = panel.pData.value;
    this.soldierCount = Math.min(this.soldierCount + gained, MAX_SOLDIERS);
    this._rebuildFormation();
    this._updateSoldierHUD();

    // ポップアップ
    const pop = this.add.text(panel.x, FORMATION_Y - 40, `+${gained}`, {
      fontSize: '36px', fontFamily: '"Arial Black"',
      color: '#ffd600', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: pop, y: FORMATION_Y - 110, alpha: 0, duration: 700,
      ease: 'Power2', onComplete: () => pop.destroy(),
    });

    this.cameras.main.flash(130, 100, 200, 255, false);
    this.tweens.add({
      targets: panel, scaleX: 0, scaleY: 0, alpha: 0,
      duration: 180, onComplete: () => { panel.destroy(); this.panels.remove(panel); },
    });
    panel.collected = true;
  }

  // ═══════════════════════════════════════════
  //  ENEMY（右ゾーン）
  // ═══════════════════════════════════════════
  _spawnWave() {
    if (this.waveIndex >= TOTAL_WAVES) return;
    const def = WAVE_DEFS[this.waveIndex++];

    for (let i = 0; i < def.count; i++) {
      const x = Phaser.Math.Between(EZ_L + 16, EZ_R - 16);
      this._spawnEnemy(x, -50 - i * 50, def.hp, def.speed);
    }
  }

  _spawnEnemy(x, y, hp, speed) {
    const con = this.add.container(x, y);
    const g = this.add.graphics();
    this._drawZombie(g);
    con.add(g);

    // HP バー
    const hpBg  = this.add.graphics().fillStyle(0x111, 0.85).fillRoundedRect(-15, -36, 30, 5, 3);
    const hpBar = this.add.graphics();
    con.add([hpBg, hpBar]);

    con.setSize(30, 50);
    con.eData = { hp, maxHp: hp, speed, hpBar };
    this._refreshEnemyHP(con);
    this.enemies.add(con);
  }

  _refreshEnemyHP(con) {
    const { hp, maxHp, hpBar } = con.eData;
    hpBar.clear();
    hpBar.fillStyle(0x76ff03);
    hpBar.fillRoundedRect(-15, -36, 30 * Math.max(0, hp / maxHp), 5, 3);
  }

  _drawZombie(g) {
    g.fillStyle(0x66bb6a, 0.9); g.fillCircle(0, -12, 10);
    g.fillStyle(0x388e3c, 0.9); g.fillRect(-8, -2, 16, 20);
    g.fillStyle(0x4caf50);
    g.fillRect(-18, 0, 8, 7); g.fillRect(10, 0, 8, 7);
    g.fillStyle(0x2e7d32); g.fillRect(-7, 18, 6, 11); g.fillRect(1, 18, 6, 11);
    g.fillStyle(0xff1744); g.fillCircle(-3, -14, 2.5); g.fillCircle(3, -14, 2.5);
    g.fillStyle(0x111); g.fillRect(-4, -7, 8, 3);
  }

  // ═══════════════════════════════════════════
  //  BOSS
  // ═══════════════════════════════════════════
  _startBoss() {
    this.bossSpawned = true;
    this.phase = 'boss';
    this.enemies.clear(true, true);
    this.panels.clear(true, true);

    const con = this.add.container(LANE_CX, 120);
    const g = this.add.graphics();
    this._drawBoss(g);
    con.add(g);

    const bw = 260, bh = 18;
    const hpBg  = this.add.graphics().fillStyle(0x222,0.9).fillRoundedRect(-bw/2,-72,bw,bh,9);
    const hpBar = this.add.graphics();
    con.add([hpBg, hpBar]);

    con.setSize(80, 110);
    con.eData = { hp: BOSS_HP, maxHp: BOSS_HP, speed: 18, hpBar, isBoss: true, bw };
    this._refreshBossHP(con);
    this.enemies.add(con);
    this._bossRef = con;

    // 画面上部 ボスHP バー
    const topW = 290, topH = 16;
    const topX = (W - topW) / 2, topY = 52;
    this.add.graphics().fillStyle(0x111,0.85).fillRoundedRect(topX, topY, topW, topH, 8).setDepth(70);
    this._topBar = this.add.graphics().setDepth(71);
    this._topCfg = { x: topX, y: topY, w: topW, h: topH };
    this._refreshTopBar(BOSS_HP, BOSS_HP);

    this.add.text(W/2, topY-14, 'BOSS HP', {
      fontSize:'12px', fontFamily:'"Arial Black"',
      color:'#ff8a80', stroke:'#000', strokeThickness:2,
    }).setOrigin(0.5).setDepth(71);

    this.cameras.main.shake(450, 0.018);
    const lbl = this.add.text(W/2, 55, '⚠  BOSS  ⚠', {
      fontSize:'38px', fontFamily:'"Arial Black"',
      color:'#ff1744', stroke:'#111', strokeThickness:6,
    }).setOrigin(0.5).setDepth(90);
    this.tweens.add({ targets: lbl, scaleX:1.3, scaleY:1.3, alpha:0, duration:1100, onComplete:()=>lbl.destroy() });
  }

  _refreshBossHP(con) {
    const { hp, maxHp, hpBar, bw } = con.eData;
    hpBar.clear();
    hpBar.fillStyle(0xff1744);
    hpBar.fillRoundedRect(-bw/2, -72, bw * Math.max(0, hp/maxHp), 18, 9);
    this._refreshTopBar(hp, maxHp);
  }

  _refreshTopBar(hp, maxHp) {
    if (!this._topBar) return;
    const c = this._topCfg;
    this._topBar.clear();
    this._topBar.fillStyle(0xff1744);
    this._topBar.fillRoundedRect(c.x, c.y, c.w * Math.max(0, hp/maxHp), c.h, 8);
  }

  _drawBoss(g) {
    g.fillStyle(0x6a1b9a); g.fillRect(-34, -4, 68, 58);
    g.fillStyle(0x7b1fa2); g.fillCircle(0, -30, 36);
    g.fillStyle(0x880e4f);
    g.fillTriangle(-20,-62,-8,-40,-28,-38);
    g.fillTriangle( 20,-62, 8,-40, 28,-38);
    g.fillStyle(0xff6d00); g.fillCircle(-12,-32,9); g.fillCircle(12,-32,9);
    g.fillStyle(0xff1744); g.fillCircle(-12,-32,5); g.fillCircle(12,-32,5);
    g.fillStyle(0x111);    g.fillRect(-15,-20,30,9);
    g.fillStyle(0x4a148c); g.fillRect(-54,0,20,46); g.fillRect(34,0,20,46);
    g.fillStyle(0x38006b); g.fillRect(-28,54,20,22); g.fillRect(8,54,20,22);
  }

  // ═══════════════════════════════════════════
  //  HUD
  // ═══════════════════════════════════════════
  _createHUD() {
    // ゾーンラベル
    this.add.text(LANE_L + LANE_W/4, 18, '💊 PANEL', {
      fontSize:'13px', fontFamily:'"Arial Black"', color:'#64b5f6',
    }).setOrigin(0.5).setDepth(60);
    this.add.text(LANE_R - LANE_W/4, 18, '☠ ENEMY', {
      fontSize:'13px', fontFamily:'"Arial Black"', color:'#ef9a9a',
    }).setOrigin(0.5).setDepth(60);

    // 兵士数
    this._soldierTxt = this.add.text(W/2, H - 12, `🪖 ${this.soldierCount}`, {
      fontSize:'22px', fontFamily:'"Arial Black"',
      color:'#ffffff', stroke:'#000', strokeThickness:3,
    }).setOrigin(0.5, 1).setDepth(60);

    // ウェーブ進捗（右下）
    this._waveTxt = this.add.text(W - 8, H - 12, `WAVE 0/${TOTAL_WAVES}`, {
      fontSize:'13px', fontFamily:'"Arial Black"',
      color:'#aaa', stroke:'#000', strokeThickness:2,
    }).setOrigin(1, 1).setDepth(60);
  }

  _updateSoldierHUD() {
    this._soldierTxt.setText(`🪖 ${this.soldierCount}`);
  }

  // ═══════════════════════════════════════════
  //  AUTO FIRE（真上に発射）
  // ═══════════════════════════════════════════
  _autoFire(dt) {
    this.shootTimer += dt;
    if (this.shootTimer < FIRE_RATE) return;
    this.shootTimer = 0;

    this.soldierGfx.forEach(s => {
      const wx = this.formation.x + s.x;
      const wy = this.formation.y + s.y;

      const b = this.add.graphics();
      b.fillStyle(0xffee58); b.fillCircle(0, 0, 4);
      b.x = wx; b.y = wy;
      b.bData = { vy: -BULLET_SPD };
      this.bullets.add(b);
    });
  }

  // ═══════════════════════════════════════════
  //  DEATH FX
  // ═══════════════════════════════════════════
  _deathFX(x, y, big) {
    const cnt = big ? 16 : 7;
    const col = big ? 0xff6d00 : 0x76ff03;
    for (let i = 0; i < cnt; i++) {
      const p = this.add.graphics();
      p.fillStyle(col); p.fillCircle(0, 0, big ? 7 : 4);
      p.x = x; p.y = y;
      const a = (i / cnt) * Math.PI * 2;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * (big ? 70 : 38),
        y: y + Math.sin(a) * (big ? 70 : 38),
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: big ? 650 : 360,
        onComplete: () => p.destroy(),
      });
    }
    if (big) this.cameras.main.shake(380, 0.022);
  }

  _showDmg(x, y, val) {
    const t = this.add.text(x + Phaser.Math.Between(-12,12), y, `-${val}`, {
      fontSize:'14px', fontFamily:'"Arial Black"',
      color:'#ff5252', stroke:'#333', strokeThickness:2,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets:t, y:y-26, alpha:0, duration:440, onComplete:()=>t.destroy() });
  }

  // ═══════════════════════════════════════════
  //  END GAME
  // ═══════════════════════════════════════════
  _endGame(win) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    if (win) {
      this.cameras.main.flash(700, 255, 215, 0, false);
    } else {
      this.cameras.main.shake(300, 0.022);
      this.cameras.main.fade(800, 0, 0, 0);
    }
    this.time.delayedCall(900, () => {
      this.scene.start('ResultScene', { win, soldiers: this.soldierCount });
    });
  }

  // ═══════════════════════════════════════════
  //  UPDATE
  // ═══════════════════════════════════════════
  update(time, delta) {
    if (this.phase === 'over') return;
    const dt = delta / 1000;

    // ── プレイヤー移動 ─────────────────────────
    let tx = this.targetX;
    if (this.cursors.left.isDown)  tx = this.formation.x - 420 * dt;
    if (this.cursors.right.isDown) tx = this.formation.x + 420 * dt;
    this.formation.x = Phaser.Math.Clamp(
      Phaser.Math.Linear(this.formation.x, tx, PLAYER_LERP),
      LANE_L + 30, LANE_R - 30
    );
    if (this.countBadge) this.countBadge.x = this.formation.x + 22;

    // ── 射撃（真上） ──────────────────────────
    this._autoFire(dt);

    // ── スクロール ────────────────────────────
    if (this.phase === 'playing') {
      this.scrollY += SCROLL_SPD * dt;

      // スクロールライン
      this.lineOffset = (this.lineOffset + SCROLL_SPD * dt) % 70;
      this._drawScrollLines();

      // パネル生成
      this.panelTimer += dt;
      if (this.panelTimer >= this.panelInterval) {
        this.panelTimer = 0;
        this._spawnPanel();
        // 2つ目（少し遅れてもう1個）
        this.time.delayedCall(400, () => { if (this.phase === 'playing') this._spawnPanel(); });
      }

      // 敵ウェーブ生成
      this.waveTimer += dt;
      if (this.waveTimer >= this.waveInterval) {
        this.waveTimer = 0;
        if (this.waveIndex < TOTAL_WAVES) {
          this._spawnWave();
          this._waveTxt.setText(`WAVE ${this.waveIndex}/${TOTAL_WAVES}`);
        }
      }

      // 全ウェーブ完了 & 敵全滅 → ボス
      if (
        !this.bossSpawned &&
        this.waveIndex >= TOTAL_WAVES &&
        this.enemies.getLength() === 0
      ) {
        this._startBoss();
      }
    }

    // ── パネル更新（スクロール + 回収） ──────────
    const deadPanels = [];
    this.panels.getChildren().forEach(p => {
      p.y += SCROLL_SPD * dt;

      // プレイヤーが触れたら回収
      if (
        !p.collected &&
        Math.abs(p.x - this.formation.x) < 46 &&
        Math.abs(p.y - FORMATION_Y) < 36
      ) {
        this._collectPanel(p);
      }

      if (p.y > H + 60) deadPanels.push(p);
    });
    deadPanels.forEach(p => { p.destroy(); this.panels.remove(p); });

    // ── 敵更新（スクロール + 接触） ──────────────
    const deadEnemies = [];
    this.enemies.getChildren().forEach(e => {
      e.y += e.eData.speed * dt;
      if (e.y > FORMATION_Y) {
        this.cameras.main.shake(170, 0.014);
        deadEnemies.push(e);
        this.soldierCount = Math.max(0, this.soldierCount - 1);
        this._rebuildFormation();
        this._updateSoldierHUD();
        if (this.soldierCount <= 0) { this._endGame(false); return; }
      }
    });
    deadEnemies.forEach(e => { e.destroy(); this.enemies.remove(e); });

    // ── 弾更新 ────────────────────────────────
    const deadBullets = [];
    this.bullets.getChildren().forEach(b => {
      b.y += b.bData.vy * dt;

      if (b.y < -20) { deadBullets.push(b); return; }

      let hit = false;

      // パネルに命中
      this.panels.getChildren().forEach(p => {
        if (hit || p.collected) return;
        if (Math.abs(b.x - p.x) < 30 && Math.abs(b.y - p.y) < 30) {
          hit = true;
          deadBullets.push(b);
          this._hitPanel(p);
        }
      });

      // 敵に命中
      if (!hit) {
        this.enemies.getChildren().forEach(e => {
          if (hit) return;
          const r = e.eData.isBoss ? 44 : 19;
          if (Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < r) {
            hit = true;
            deadBullets.push(b);
            e.eData.hp -= 1;

            if (e.eData.isBoss) {
              this._refreshBossHP(e);
            } else {
              this._refreshEnemyHP(e);
              this._showDmg(e.x, e.y - 22, 1);
            }

            if (e.eData.hp <= 0) {
              this._deathFX(e.x, e.y, !!e.eData.isBoss);
              const wasBoss = e.eData.isBoss;
              e.destroy();
              this.enemies.remove(e);
              if (wasBoss) this._endGame(true);
            }
          }
        });
      }
    });
    deadBullets.forEach(b => { b.destroy(); this.bullets.remove(b); });

    // ── 兵士ボブアニメ ─────────────────────────
    const t = time / 650;
    this.soldierGfx.forEach((s, i) => {
      s.y += Math.sin(t + i * 1.2) * 0.55 - Math.sin(t - dt/1000 * 650 + i * 1.2) * 0.55;
    });
  }

  _drawScrollLines() {
    this.scrollLines.clear();
    // 左ゾーンのライン（青）
    this.scrollLines.lineStyle(1, 0x1e88e5, 0.18);
    for (let y = -70 + this.lineOffset; y < H + 70; y += 70) {
      this.scrollLines.beginPath();
      this.scrollLines.moveTo(LANE_L + 4, y);
      this.scrollLines.lineTo(LANE_CX - 4, y);
      this.scrollLines.strokePath();
    }
    // 右ゾーンのライン（赤）
    this.scrollLines.lineStyle(1, 0xe53935, 0.18);
    for (let y = -70 + this.lineOffset; y < H + 70; y += 70) {
      this.scrollLines.beginPath();
      this.scrollLines.moveTo(LANE_CX + 4, y);
      this.scrollLines.lineTo(LANE_R - 4, y);
      this.scrollLines.strokePath();
    }
  }
}
