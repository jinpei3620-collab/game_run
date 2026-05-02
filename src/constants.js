'use strict';

const W = 400;
const H = 700;
const LANE_L  = 40;
const LANE_R  = 360;
const LANE_W  = LANE_R - LANE_L;   // 320
const LANE_CX = (LANE_L + LANE_R) / 2; // 200

const SCROLL_SPD  = 155;  // px/s
const PLAYER_LERP = 0.13;

// ── 武器定義 ──────────────────────────────
const WEAPONS = [
  { name: 'ピストル',           color: 0xffee58, size: 4,  rate: 0.30, dmg: 12,  shotCount: 1, spread: 0,  splash: false },
  { name: 'マシンガン',         color: 0xff9800, size: 4,  rate: 0.14, dmg:  9,  shotCount: 1, spread: 0,  splash: false },
  { name: 'ショットガン',       color: 0xff6d00, size: 6,  rate: 0.42, dmg: 22,  shotCount: 3, spread: 15, splash: false },
  { name: 'ロケットランチャー', color: 0xff1744, size: 9,  rate: 0.60, dmg: 60,  shotCount: 1, spread: 0,  splash: true  },
];

// ── ゲートペアテンプレート（左, 右） ──────
const GATE_TEMPLATES = [
  [{ op:'add', val:10, label:'+10', good:true  }, { op:'sub', val:5,  label:'-5',  good:false }],
  [{ op:'mul', val:2,  label:'×2',  good:true  }, { op:'div', val:2,  label:'÷2',  good:false }],
  [{ op:'add', val:15, label:'+15', good:true  }, { op:'sub', val:8,  label:'-8',  good:false }],
  [{ op:'mul', val:3,  label:'×3',  good:true  }, { op:'sub', val:10, label:'-10', good:false }],
  [{ op:'add', val:8,  label:'+8',  good:true  }, { op:'div', val:2,  label:'÷2',  good:false }],
  [{ op:'add', val:5,  label:'+5',  good:true  }, { op:'mul', val:2,  label:'×2',  good:true  }], // 両方プラス
  [{ op:'sub', val:3,  label:'-3',  good:false }, { op:'div', val:2,  label:'÷2',  good:false }], // 両方マイナス
];

// ── ウェーブ定義 ───────────────────────────
const WAVE_DEFS = [
  { count:  5, hp:  28, speed:  70 },
  { count:  8, hp:  38, speed:  82 },
  { count: 12, hp:  52, speed:  94 },
  { count: 16, hp:  68, speed: 106 },
  { count: 20, hp:  85, speed: 116 },
];

// ── スポーンスケジュール（scrollY 到達で発火） ──
const SPAWN_SCHEDULE = [
  { at:  350, type: 'gate'                     },
  { at:  620, type: 'wave',     wave: 0        },
  { at:  850, type: 'obstacle'                 },
  { at:  980, type: 'gate'                     },
  { at: 1200, type: 'wave',     wave: 1        },
  { at: 1420, type: 'obstacle'                 },
  { at: 1550, type: 'gate'                     },
  { at: 1780, type: 'wave',     wave: 2        },
  { at: 1980, type: 'gate'                     },
  { at: 2100, type: 'obstacle'                 },
  { at: 2280, type: 'wave',     wave: 3        },
  { at: 2480, type: 'gate'                     },
  { at: 2700, type: 'wave',     wave: 4        },
  { at: 2900, type: 'gate'                     },
  { at: 3100, type: 'boss'                     },
];

const BOSS_HP       = 1200;
const FORMATION_Y   = H - 140;
const MAX_SOLDIERS  = 99;
const MAX_DISPLAY   = 20;  // 表示上限
