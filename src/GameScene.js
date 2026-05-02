'use strict';

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // ═══════════════════════════════════════════════
  //  CREATE
  // ═══════════════════════════════════════════════
  create() {
    // ── ゲーム状態 ─────────────────────────────
    this.soldierCount  = 10;
    this.weaponLevel   = 0;
    this.scrollY       = 0;
    this.lineOffset    = 0;
    this.phase         = 'playing'; // playing | boss | over
    this.scheduleIdx   = 0;
    this.shootTimer    = 0;
    this.targetX       = W / 2;
    this._pairId       = 0;
    this._triggeredPairs = new Set();

    // ── グループ ──────────────────────────────
    this.bullets   = this.add.group();
    this.enemies   = this.add.group();
    this.obstacles = this.add.group();
    this.gatePairs = [];   // { left, right, triggered }

    // ── 背景（最下レイヤー） ────────────────────
    this._buildBackground();
    this.roadLines = this.add.graphics();

    // ── プレイヤー陣形 ─────────────────────────
    this.formation = this.add.container(W / 2, FORMATION_Y);
    this.soldierGfx = [];
    this._rebuildFormation();

    // ── HUD（最上レイヤー） ─────────────────────
    this._createHUD();

    // ── 入力 ──────────────────────────────────
    this.input.on('pointermove', p => { this.targetX = p.x; });
    this.input.on('pointerdown', p => { this.targetX = p.x; });
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ═══════════════════════════════════════════════
  //  BACKGROUND
  // ═══════════════════════════════════════════════
  _buildBackground() {
    const g = this.add.graphics();

    // 芝生（外側）
    g.fillStyle(0x1b4a1b);
    g.fillRect(0, 0, W, H);

    // 道路
    g.fillStyle(0x362e24);
    g.fillRect(LANE_L, 0, LANE_W, H);

    // 道路テクスチャ
    g.fillStyle(0x2e261d, 0.6);
    for (let i = 0; i < 7; i++) g.fillRect(LANE_L + 5 + i * 44, 0, 20, H);

    // 左右ライン
    g.lineStyle(4, 0xffd600, 0.9);
    g.beginPath(); g.moveTo(LANE_L + 2, 0); g.lineTo(LANE_L + 2, H); g.strokePath();
    g.beginPath(); g.moveTo(LANE_R - 2, 0); g.lineTo(LANE_R - 2, H); g.strokePath();

    // 中央点線（静止）
    g.lineStyle(2, 0xffd600, 0.25);
    for (let y = 0; y < H; y += 60) {
      g.beginPath(); g.moveTo(LANE_CX, y); g.lineTo(LANE_CX, y + 32); g.strokePath();
    }

    // 草の装飾
    g.fillStyle(0x145214, 0.5);
    for (let y = 0; y < H; y += 100) {
      g.fillRect( 4, y + 10, 28, 14);
      g.fillRect(W - 32, y + 55, 28, 14);
    }
  }

  // ═══════════════════════════════════════════════
  //  FORMATION（横一列 or 複数列）
  // ═══════════════════════════════════════════════
  _rebuildFormation() {
    this.soldierGfx.forEach(s => s.destroy());
    this.soldierGfx = [];
    this.formation.removeAll(false);

    const n = Math.min(this.soldierCount, MAX_DISPLAY);
    const maxW = LANE_W - 50;
    const spacing = n > 1 ? Math.min(22, Math.floor(maxW / (n - 1))) : 0;
    const totalW = (n - 1) * spacing;

    for (let i = 0; i < n; i++) {
      const g = this.add.graphics();
      this._drawSoldier(g);
      g.x = -totalW / 2 + i * spacing;
      g.y = 0;
      this.formation.add(g);
      this.soldierGfx.push(g);
    }

    // 人数超過ラベル
    if (this.countBadge) this.countBadge.destroy();
    if (this.soldierCount > MAX_DISPLAY) {
      this.countBadge = this.add.text(
        this.formation.x + totalW / 2 + 16, FORMATION_Y - 6,
        `×${this.soldierCount}`, {
          fontSize: '18px', fontFamily: '"Arial Black"',
          color: '#ffd600', stroke: '#000', strokeThickness: 3,
        }
      ).setOrigin(0, 0.5).setDepth(30);
    }
  }

  _drawSoldier(g) {
    g.fillStyle(0xffcc80); g.fillCircle(0, -9, 7);          // 頭
    g.fillStyle(0x33691e); g.fillRect(-7, -17, 14, 10);     // ヘルメット
    g.fillStyle(0x558b2f); g.fillRect(-7, -1,  14, 17);     // 体
    g.fillStyle(0x558b2f); g.fillRect(-13, 0, 7, 10);       // 左腕
    g.fillRect(6, 0, 7, 10);                                 // 右腕
    g.fillStyle(0x212121); g.fillRect(9, -3, 14, 4);        // 銃
    g.fillStyle(0x2e7d32); g.fillRect(-7, 16, 6, 11);       // 左脚
    g.fillRect(1, 16, 6, 11);                                // 右脚
  }

  // ═══════════════════════════════════════════════
  //  GATE SYSTEM
  // ═══════════════════════════════════════════════
  _spawnGatePair() {
    const tmpl = Phaser.Utils.Array.GetRandom(GATE_TEMPLATES);
    const defs = [...tmpl];
    if (Math.random() < 0.5) defs.reverse(); // 左右ランダム

    const pid = this._pairId++;
    const left  = this._makeGateContainer(LANE_L  + LANE_W * 0.25, -90, defs[0], pid);
    const right = this._makeGateContainer(LANE_R  - LANE_W * 0.25, -90, defs[1], pid);

    this.gatePairs.push({ left, right, pid, triggered: false });
  }

  _makeGateContainer(x, y, def, pid) {
    const gw = 118, gh = 72;
    const con = this.add.container(x, y);

    const col    = def.good ? 0x1565c0 : 0xb71c1c;
    const border = def.good ? 0x64b5f6 : 0xef9a9a;

    const bg = this.add.graphics();
    bg.fillStyle(col, 0.80);
    bg.fillRoundedRect(-gw/2, -gh/2, gw, gh, 10);
    bg.lineStyle(3, border, 1);
    bg.strokeRoundedRect(-gw/2, -gh/2, gw, gh, 10);

    // グラデーションライン（上部ハイライト）
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(-gw/2, -gh/2, gw, 20, { tl:10, tr:10, bl:0, br:0 });

    const txt = this.add.text(0, 0, def.label, {
      fontSize: '30px', fontFamily: '"Arial Black", Arial',
      color: '#ffffff', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    con.add([bg, txt]);
    con.setSize(gw, gh);
    con.gData = { ...def, pid };
    return con;
  }

  _applyGate(def) {
    const prev = this.soldierCount;
    switch (def.op) {
      case 'add': this.soldierCount = Math.min(this.soldierCount + def.val, MAX_SOLDIERS); break;
      case 'sub': this.soldierCount = Math.max(1, this.soldierCount - def.val);            break;
      case 'mul': this.soldierCount = Math.min(this.soldierCount * def.val, MAX_SOLDIERS); break;
      case 'div': this.soldierCount = Math.max(1, Math.floor(this.soldierCount / def.val));break;
    }

    if (this.soldierCount !== prev) {
      this._rebuildFormation();
      this._updateSoldierHUD();
    }

    const good = def.good;
    this.cameras.main.flash(180, good ? 50 : 255, good ? 160 : 50, good ? 255 : 50, false);

    const pop = this.add.text(W / 2, H / 2 - 50, def.label, {
      fontSize: '52px', fontFamily: '"Arial Black"',
      color: good ? '#64b5f6' : '#ef5350',
      stroke: '#000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(90);
    this.tweens.add({
      targets: pop, y: H / 2 - 130, alpha: 0, duration: 750,
      ease: 'Power2', onComplete: () => pop.destroy(),
    });
  }

  // ═══════════════════════════════════════════════
  //  ENEMIES（ゾンビ）
  // ═══════════════════════════════════════════════
  _spawnWave(def) {
    for (let i = 0; i < def.count; i++) {
      const x = Phaser.Math.Clamp(
        LANE_CX + (Math.random() - 0.5) * (LANE_W - 60),
        LANE_L + 18, LANE_R - 18
      );
      this._spawnEnemy(x, -55 - i * 52, def.hp, def.speed);
    }
  }

  _spawnEnemy(x, y, hp, speed) {
    const con = this.add.container(x, y);
    const g = this.add.graphics();
    this._drawZombie(g);
    con.add(g);

    const hpBg = this.add.graphics().fillStyle(0x111,0.9).fillRoundedRect(-17,-38,34,6,3);
    const hpBar = this.add.graphics();
    con.add([hpBg, hpBar]);

    con.setSize(32, 52);
    con.eData = { hp, maxHp: hp, speed, hpBar };
    this._refreshEnemyHP(con);
    this.enemies.add(con);
  }

  _refreshEnemyHP(con) {
    const { hp, maxHp, hpBar } = con.eData;
    hpBar.clear();
    hpBar.fillStyle(0x76ff03);
    hpBar.fillRoundedRect(-17, -38, 34 * Math.max(0, hp / maxHp), 6, 3);
  }

  _drawZombie(g) {
    g.fillStyle(0x66bb6a, 0.9); g.fillCircle(0, -12, 11);   // 頭
    g.fillStyle(0x388e3c, 0.9); g.fillRect(-9, -1, 18, 22);  // 体
    g.fillStyle(0x4caf50);
    g.fillRect(-20, 1, 9, 8);   // 左腕（前に伸ばす）
    g.fillRect( 11, 1, 9, 8);
    g.fillStyle(0x2e7d32);
    g.fillRect(-8, 21, 7, 12);  // 脚
    g.fillRect( 1, 21, 7, 12);
    g.fillStyle(0xff1744);
    g.fillCircle(-4, -14, 3); g.fillCircle(4, -14, 3);      // 目
    g.fillStyle(0x111);
    g.fillRect(-5, -7, 10, 4);                               // 口
  }

  // ═══════════════════════════════════════════════
  //  OBSTACLES（障害ブロック）
  // ═══════════════════════════════════════════════
  _spawnObstacle() {
    const baseHp = 60 + this.scheduleIdx * 20;
    const hp = Phaser.Math.Between(baseHp, baseHp + 40);
    const x = Phaser.Math.Between(LANE_L + 44, LANE_R - 44);

    const con = this.add.container(x, -70);
    const g = this.add.graphics();

    // ドラム缶風
    g.fillStyle(0x4e342e);
    g.fillRoundedRect(-26, -26, 52, 52, 8);
    g.lineStyle(3, 0x8d6e63);
    g.strokeRoundedRect(-26, -26, 52, 52, 8);
    g.lineStyle(2, 0x3e2723, 0.8);
    g.beginPath(); g.moveTo(-26, -8); g.lineTo(26, -8); g.strokePath();
    g.beginPath(); g.moveTo(-26,  8); g.lineTo(26,  8); g.strokePath();

    // HP テキスト
    const hpTxt = this.add.text(0, 0, `${hp}`, {
      fontSize: '19px', fontFamily: '"Arial Black"',
      color: '#ffcc02', stroke: '#2e2e2e', strokeThickness: 3,
    }).setOrigin(0.5);

    con.add([g, hpTxt]);
    con.setSize(52, 52);
    con.oData = { hp, maxHp: hp, hpTxt };
    this.obstacles.add(con);
  }

  // ═══════════════════════════════════════════════
  //  BOSS
  // ═══════════════════════════════════════════════
  _startBossPhase() {
    this.phase = 'boss';
    this.obstacles.clear(true, true);
    this.gatePairs.forEach(p => { p.left.destroy(); p.right.destroy(); });
    this.gatePairs = [];

    const hp = BOSS_HP;
    const con = this.add.container(LANE_CX, 130);
    const g = this.add.graphics();
    this._drawBoss(g);
    con.add(g);

    // ボスHPバー（大きい）
    const bw = 260, bh = 18;
    const hpBg = this.add.graphics()
      .fillStyle(0x222, 0.9).fillRoundedRect(-bw/2, -70, bw, bh, 9);
    const hpBar = this.add.graphics();
    con.add([hpBg, hpBar]);
    con.setSize(80, 100);
    con.eData = { hp, maxHp: hp, speed: 22, hpBar, bw, isBoss: true };
    this._refreshBossHP(con);
    this.enemies.add(con);
    this._bossRef = con;

    // ボス登場演出
    this.cameras.main.shake(500, 0.018);
    const lbl = this.add.text(W/2, 55, '⚠  BOSS  ⚠', {
      fontSize: '40px', fontFamily: '"Arial Black"',
      color: '#ff1744', stroke: '#111', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(90);
    this.tweens.add({
      targets: lbl, scaleX: 1.3, scaleY: 1.3, alpha: 0,
      duration: 1100, ease: 'Power2', onComplete: () => lbl.destroy(),
    });

    // 画面上部にボスHPバー追加
    const topBgW = 290, topBgH = 16;
    const topBgX = (W - topBgW) / 2, topBgY = 50;
    this.add.graphics()
      .fillStyle(0x111, 0.85).fillRoundedRect(topBgX, topBgY, topBgW, topBgH, 8)
      .setDepth(70);
    this._topBossBar = this.add.graphics().setDepth(71);
    this._topBossCfg = { x: topBgX, y: topBgY, w: topBgW, h: topBgH };
    this.add.text(W/2, topBgY - 14, 'BOSS HP', {
      fontSize: '12px', fontFamily: '"Arial Black"',
      color: '#ff8a80', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(71);
    this._refreshTopBossBar(hp, hp);
  }

  _refreshBossHP(con) {
    const { hp, maxHp, hpBar, bw } = con.eData;
    hpBar.clear();
    hpBar.fillStyle(0xff1744);
    hpBar.fillRoundedRect(-bw/2, -70, bw * Math.max(0, hp/maxHp), 18, 9);
  }

  _refreshTopBossBar(hp, maxHp) {
    if (!this._topBossBar) return;
    const c = this._topBossCfg;
    this._topBossBar.clear();
    this._topBossBar.fillStyle(0xff1744);
    this._topBossBar.fillRoundedRect(c.x, c.y, c.w * Math.max(0, hp/maxHp), c.h, 8);
  }

  _drawBoss(g) {
    g.fillStyle(0x6a1b9a); g.fillRect(-32, -4, 64, 56);          // 胴体
    g.fillStyle(0x7b1fa2); g.fillCircle(0, -28, 34);             // 頭
    g.fillStyle(0x880e4f);
    g.fillTriangle(-18, -56, -8, -38, -26, -36);                 // 左角
    g.fillTriangle( 18, -56,  8, -38,  26, -36);                 // 右角
    g.fillStyle(0xff6d00);
    g.fillCircle(-11, -30, 9); g.fillCircle(11, -30, 9);         // 目
    g.fillStyle(0xff1744);
    g.fillCircle(-11, -30, 5); g.fillCircle(11, -30, 5);
    g.fillStyle(0x111);
    g.fillRect(-14, -18, 28, 8);                                  // 口
    g.fillStyle(0x6a1b9a);
    g.fillRect(-52, 0, 20, 44);                                   // 腕
    g.fillRect( 32, 0, 20, 44);
    g.fillStyle(0x4a148c);
    g.fillRect(-28, 52, 20, 22);                                  // 脚
    g.fillRect(  8, 52, 20, 22);
  }

  // ═══════════════════════════════════════════════
  //  AUTO FIRE
  // ═══════════════════════════════════════════════
  _autoFire(dt) {
    this.shootTimer += dt;
    const wpn = WEAPONS[this.weaponLevel];
    if (this.shootTimer < wpn.rate) return;
    this.shootTimer = 0;

    const targets = [...this.enemies.getChildren(), ...this.obstacles.getChildren()];
    if (targets.length === 0) return;

    this.soldierGfx.forEach(s => {
      const wx = this.formation.x + s.x;
      const wy = this.formation.y + s.y;

      let nearest = null, minD = Infinity;
      targets.forEach(t => {
        const d = Phaser.Math.Distance.Between(wx, wy, t.x, t.y);
        if (d < minD) { minD = d; nearest = t; }
      });
      if (!nearest) return;

      const baseAngle = Phaser.Math.Angle.Between(wx, wy, nearest.x, nearest.y);

      for (let k = 0; k < wpn.shotCount; k++) {
        const angle = wpn.shotCount > 1
          ? baseAngle + Phaser.Math.DegToRad((k - (wpn.shotCount - 1) / 2) * wpn.spread)
          : baseAngle;

        const b = this.add.graphics();
        b.fillStyle(wpn.color);
        b.fillCircle(0, 0, wpn.size);
        if (wpn.splash) {
          b.fillStyle(0xff6d00, 0.35);
          b.fillCircle(0, 0, wpn.size + 5);
        }
        b.x = wx; b.y = wy;
        b.bData = {
          vx: Math.cos(angle) * 530,
          vy: Math.sin(angle) * 530,
          dmg: wpn.dmg,
          splash: wpn.splash,
        };
        this.bullets.add(b);
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  HIT PROCESSING
  // ═══════════════════════════════════════════════
  _hitEnemy(enemy, dmg, splash) {
    enemy.eData.hp -= dmg;
    if (enemy.eData.isBoss) {
      this._refreshBossHP(enemy);
      this._refreshTopBossBar(enemy.eData.hp, enemy.eData.maxHp);
    } else {
      this._refreshEnemyHP(enemy);
    }

    if (splash) {
      this.enemies.getChildren().forEach(e => {
        if (e === enemy) return;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y) < 65) {
          e.eData.hp -= dmg * 0.45;
          e.eData.isBoss ? this._refreshBossHP(e) : this._refreshEnemyHP(e);
        }
      });
      this._splashFX(enemy.x, enemy.y);
    }

    this._showDmgNum(enemy.x, enemy.y - 30, dmg);

    if (enemy.eData.hp <= 0) {
      this._deathFX(enemy.x, enemy.y, !!enemy.eData.isBoss);
      const wasBoss = enemy.eData.isBoss;
      enemy.destroy();
      this.enemies.remove(enemy);
      if (wasBoss) this._endGame(true);
    }
  }

  _hitObstacle(obs, dmg) {
    obs.oData.hp -= dmg;
    obs.oData.hpTxt.setText(`${Math.max(0, Math.ceil(obs.oData.hp))}`);
    this._showDmgNum(obs.x, obs.y - 36, dmg);

    if (obs.oData.hp <= 0) {
      this._deathFX(obs.x, obs.y, false);
      obs.destroy();
      this.obstacles.remove(obs);
      // 武器アップグレード（60%確率）
      if (this.weaponLevel < WEAPONS.length - 1 && Math.random() < 0.60) {
        this.weaponLevel++;
        this._showWeaponUpgrade();
        this._updateWeaponHUD();
      }
    }
  }

  // ═══════════════════════════════════════════════
  //  HUD
  // ═══════════════════════════════════════════════
  _createHUD() {
    const pbW = 270, pbH = 12, pbX = (W - pbW) / 2, pbY = 16;

    this.add.graphics()
      .fillStyle(0x222, 0.75).fillRoundedRect(pbX, pbY, pbW, pbH, 6)
      .setDepth(60);
    this._progressBar = this.add.graphics().setDepth(61);
    this._pbCfg = { x: pbX, y: pbY, w: pbW, h: pbH };
    this._updateProgressBar();

    this.add.text(pbX - 6, pbY + pbH + 3, '🏃', { fontSize:'12px' }).setDepth(61);
    this.add.text(pbX + pbW - 12, pbY + pbH + 3, '👾', { fontSize:'12px' }).setDepth(61);

    // 兵士数
    this._soldierTxt = this.add.text(10, H - 16, '🪖  10', {
      fontSize: '20px', fontFamily: '"Arial Black"',
      color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 1).setDepth(60);

    // 武器表示
    this._weaponTxt = this.add.text(W - 10, H - 16, `🔫 ${WEAPONS[0].name}`, {
      fontSize: '16px', fontFamily: '"Arial Black"',
      color: '#ffd600', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 1).setDepth(60);
  }

  _updateProgressBar() {
    const total = SPAWN_SCHEDULE[SPAWN_SCHEDULE.length - 1].at + 200;
    const ratio = Math.min(this.scrollY / total, 1);
    const c = this._pbCfg;
    this._progressBar.clear();
    this._progressBar.fillStyle(0xffd600);
    this._progressBar.fillRoundedRect(c.x, c.y, c.w * ratio, c.h, 6);
  }

  _updateSoldierHUD() {
    this._soldierTxt.setText(`🪖  ${this.soldierCount}`);
  }

  _updateWeaponHUD() {
    this._weaponTxt.setText(`🔫 ${WEAPONS[this.weaponLevel].name}`);
  }

  // ═══════════════════════════════════════════════
  //  VISUAL FX
  // ═══════════════════════════════════════════════
  _deathFX(x, y, big) {
    const cnt = big ? 16 : 8;
    const col = big ? 0xff6d00 : 0x76ff03;
    for (let i = 0; i < cnt; i++) {
      const p = this.add.graphics();
      p.fillStyle(col); p.fillCircle(0, 0, big ? 7 : 4);
      p.x = x; p.y = y;
      const a = (i / cnt) * Math.PI * 2;
      const r = big ? 70 : 40;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: big ? 650 : 380,
        onComplete: () => p.destroy(),
      });
    }
    if (big) this.cameras.main.shake(350, 0.022);
  }

  _splashFX(x, y) {
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xff6d00, 0.8); ring.strokeCircle(0, 0, 10);
    ring.x = x; ring.y = y;
    this.tweens.add({
      targets: ring, scaleX: 5, scaleY: 5, alpha: 0,
      duration: 350, ease: 'Power2', onComplete: () => ring.destroy(),
    });
  }

  _showDmgNum(x, y, dmg) {
    const t = this.add.text(x + Phaser.Math.Between(-14, 14), y, `-${dmg}`, {
      fontSize: '15px', fontFamily: '"Arial Black"',
      color: '#ffee58', stroke: '#333', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: t, y: y - 28, alpha: 0,
      duration: 460, onComplete: () => t.destroy(),
    });
  }

  _showWeaponUpgrade() {
    const name = WEAPONS[this.weaponLevel].name;
    this.cameras.main.flash(250, 255, 160, 0, false);
    const pop = this.add.text(W/2, H/2 - 30, `🔫 ${name}`, {
      fontSize: '34px', fontFamily: '"Arial Black"',
      color: '#ff9800', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(90);
    this.tweens.add({
      targets: pop, y: H/2 - 110, alpha: 0, duration: 900,
      ease: 'Power2', onComplete: () => pop.destroy(),
    });
  }

  // ═══════════════════════════════════════════════
  //  END GAME
  // ═══════════════════════════════════════════════
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
      this.scene.start('ResultScene', { win, soldiers: this.soldierCount, weapon: WEAPONS[this.weaponLevel].name });
    });
  }

  // ═══════════════════════════════════════════════
  //  UPDATE LOOP
  // ═══════════════════════════════════════════════
  update(time, delta) {
    if (this.phase === 'over') return;
    const dt = delta / 1000;

    // ── プレイヤー左右移動 ─────────────────────
    let tx = this.targetX;
    if (this.cursors.left.isDown)  tx = this.formation.x - 420 * dt;
    if (this.cursors.right.isDown) tx = this.formation.x + 420 * dt;
    this.formation.x = Phaser.Math.Clamp(
      Phaser.Math.Linear(this.formation.x, tx, PLAYER_LERP),
      LANE_L + 30, LANE_R - 30
    );
    if (this.countBadge) this.countBadge.x = this.formation.x + 20;

    // ── 自動射撃 ──────────────────────────────
    this._autoFire(dt);

    // ── スクロール ────────────────────────────
    if (this.phase === 'playing') {
      this.scrollY += SCROLL_SPD * dt;
      this._updateProgressBar();

      // 中央点線スクロール
      this.lineOffset = (this.lineOffset + SCROLL_SPD * dt) % 60;
      this._drawScrollLines();

      // スポーンスケジュール
      while (
        this.scheduleIdx < SPAWN_SCHEDULE.length &&
        this.scrollY >= SPAWN_SCHEDULE[this.scheduleIdx].at
      ) {
        const ev = SPAWN_SCHEDULE[this.scheduleIdx++];
        if      (ev.type === 'gate')     this._spawnGatePair();
        else if (ev.type === 'wave')     this._spawnWave(WAVE_DEFS[ev.wave]);
        else if (ev.type === 'obstacle') this._spawnObstacle();
        else if (ev.type === 'boss')     this._startBossPhase();
      }
    }

    // ── ゲートペア更新 ─────────────────────────
    this.gatePairs = this.gatePairs.filter(pair => {
      pair.left.y  += SCROLL_SPD * dt;
      pair.right.y += SCROLL_SPD * dt;

      if (!pair.triggered && pair.left.y >= FORMATION_Y - 35) {
        pair.triggered = true;
        // プレイヤーが左右どちらにいるか
        const goLeft = this.formation.x < LANE_CX;
        const chosen  = goLeft ? pair.left  : pair.right;
        const unchosen = goLeft ? pair.right : pair.left;

        this._applyGate(chosen.gData);

        // 選んだ方を拡大フラッシュ
        this.tweens.add({ targets: chosen,   scaleX:1.25, scaleY:1.25, alpha:1.2, duration:180, yoyo:true });
        this.tweens.add({ targets: unchosen, alpha: 0.25, duration: 250 });
      }

      if (pair.left.y > H + 80) {
        pair.left.destroy(); pair.right.destroy();
        return false;
      }
      return true;
    });

    // ── 敵更新 ────────────────────────────────
    const deadEnemies = [];
    this.enemies.getChildren().forEach(e => {
      e.y += e.eData.speed * dt;
      if (e.y > FORMATION_Y) {
        this.cameras.main.shake(180, 0.015);
        deadEnemies.push(e);
        this.soldierCount = Math.max(0, this.soldierCount - 1);
        this._rebuildFormation();
        this._updateSoldierHUD();
        if (this.soldierCount <= 0) { this._endGame(false); return; }
      }
    });
    deadEnemies.forEach(e => { e.destroy(); this.enemies.remove(e); });

    // ── 障害物更新 ────────────────────────────
    const deadObs = [];
    this.obstacles.getChildren().forEach(o => {
      o.y += SCROLL_SPD * dt;
      if (o.y > FORMATION_Y + 10) {
        // 残HPで兵士を削る
        const dmgSoldiers = Math.max(1, Math.floor(o.oData.hp / 12));
        this.soldierCount = Math.max(0, this.soldierCount - dmgSoldiers);
        this._rebuildFormation();
        this._updateSoldierHUD();
        this.cameras.main.shake(220, 0.018);
        deadObs.push(o);
        if (this.soldierCount <= 0) { this._endGame(false); return; }
      }
    });
    deadObs.forEach(o => { o.destroy(); this.obstacles.remove(o); });

    // ── 弾更新 ────────────────────────────────
    const deadBullets = [];
    this.bullets.getChildren().forEach(b => {
      b.x += b.bData.vx * dt;
      b.y += b.bData.vy * dt;

      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) {
        deadBullets.push(b); return;
      }

      let hit = false;

      // 敵チェック
      this.enemies.getChildren().forEach(e => {
        if (hit) return;
        const radius = e.eData.isBoss ? 42 : 20;
        if (Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < radius) {
          hit = true;
          deadBullets.push(b);
          this._hitEnemy(e, b.bData.dmg, b.bData.splash);
        }
      });

      // 障害物チェック
      if (!hit) {
        this.obstacles.getChildren().forEach(o => {
          if (hit) return;
          if (Math.abs(b.x - o.x) < 30 && Math.abs(b.y - o.y) < 30) {
            hit = true;
            deadBullets.push(b);
            this._hitObstacle(o, b.bData.dmg);
          }
        });
      }
    });
    deadBullets.forEach(b => { b.destroy(); this.bullets.remove(b); });

    // ── 兵士ボブアニメ ─────────────────────────
    const t = time / 650;
    this.soldierGfx.forEach((s, i) => {
      s.y += Math.sin(t + i * 1.2) * 0.55 - Math.sin((t - dt) + i * 1.2) * 0.55;
    });
  }

  _drawScrollLines() {
    this.roadLines.clear();
    this.roadLines.lineStyle(2, 0xffd600, 0.22);
    for (let y = -60 + this.lineOffset; y < H + 60; y += 60) {
      this.roadLines.beginPath();
      this.roadLines.moveTo(LANE_CX, y);
      this.roadLines.lineTo(LANE_CX, y + 32);
      this.roadLines.strokePath();
    }
  }
}
