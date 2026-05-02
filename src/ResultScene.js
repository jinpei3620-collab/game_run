'use strict';

class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  create(data) {
    const win = data.win;

    const bg = this.add.graphics();
    bg.fillGradientStyle(
      win ? 0x1b5e20 : 0x7f0000, win ? 0x1b5e20 : 0x7f0000,
      win ? 0x0a2e0a : 0x2c0000, win ? 0x0a2e0a : 0x2c0000, 1
    );
    bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 160, win ? '🏆' : '💀', { fontSize:'88px' }).setOrigin(0.5);

    this.add.text(W/2, 270, win ? 'VICTORY!' : 'DEFEAT...', {
      fontSize:'52px', fontFamily:'"Arial Black", Arial',
      color: win ? '#ffd600' : '#ff5252', stroke:'#000', strokeThickness:7,
    }).setOrigin(0.5);

    this.add.text(W/2, 350, win ? `残り兵士: ${data.soldiers} 人` : '兵士が全滅した…', {
      fontSize:'22px', fontFamily:'Arial', color:'#ffffffcc',
    }).setOrigin(0.5);

    this._btn(W/2, 450, '▶  もう一度', '#0288d1', '#0277bd', () => {
      this.cameras.main.fade(280,0,0,0);
      this.time.delayedCall(280, () => this.scene.start('GameScene'));
    });
    this._btn(W/2, 525, 'タイトルへ', '#424242', '#333333', () => {
      this.cameras.main.fade(280,0,0,0);
      this.time.delayedCall(280, () => this.scene.start('TitleScene'));
    });
  }

  _btn(x, y, label, bg, hover, cb) {
    const b = this.add.text(x, y, label, {
      fontSize:'26px', fontFamily:'"Arial Black", Arial',
      color:'#fff', backgroundColor:bg, padding:{x:28, y:13},
    }).setOrigin(0.5).setInteractive({ useHandCursor:true });
    b.on('pointerover', () => b.setStyle({ backgroundColor:hover }));
    b.on('pointerout',  () => b.setStyle({ backgroundColor:bg   }));
    b.on('pointerdown', cb);
  }
}
