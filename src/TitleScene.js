'use strict';

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a0f');

    // 背景グラデーション風
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0a1a0e, 0x0a1a0e, 1);
    bg.fillRect(0, 0, W, H);

    // ロゴ
    this.add.text(W / 2, 160, 'LAST WAR', {
      fontSize: '58px',
      fontFamily: '"Arial Black", Arial, sans-serif',
      color: '#ffd600',
      stroke: '#7a5a00',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(W / 2, 225, '～ SURVIVAL ～', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // キャラ説明
    const infoStyle = { fontSize: '16px', fontFamily: 'Arial', color: '#cccccc' };
    [
      '🪖  兵士を率いて戦え！',
      '🔫  自動攻撃で敵を排除',
      '💊  パネルを取って強化',
      '👾  ボスを倒してステージクリア',
    ].forEach((txt, i) => {
      this.add.text(W / 2, 310 + i * 32, txt, infoStyle).setOrigin(0.5);
    });

    // スタートボタン
    const btn = this.add.text(W / 2, 530, '▶  ゲームスタート', {
      fontSize: '26px',
      fontFamily: '"Arial Black", Arial',
      color: '#ffffff',
      backgroundColor: '#c62828',
      padding: { x: 26, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: btn, alpha: 0.65, duration: 650, yoyo: true, repeat: -1 });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#e53935' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#c62828' }));
    btn.on('pointerdown', () => {
      this.cameras.main.fade(350, 0, 0, 0);
      this.time.delayedCall(350, () => this.scene.start('GameScene'));
    });

    // バージョン
    this.add.text(W - 8, H - 6, 'v0.1', {
      fontSize: '11px', color: '#444', fontFamily: 'Arial'
    }).setOrigin(1, 1);
  }
}
