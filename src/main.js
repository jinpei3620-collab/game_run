'use strict';

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#0a0a0f',
  scene: [TitleScene, GameScene, ResultScene],
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};

new Phaser.Game(config);
