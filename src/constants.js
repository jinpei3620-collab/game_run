'use strict';

const W = 400;
const H = 700;
const LANE_L  = 40;
const LANE_R  = 360;
const LANE_W  = LANE_R - LANE_L;
const LANE_CX = (LANE_L + LANE_R) / 2; // 200 — 左右ゾーン境界

// 左ゾーン（パネル）/ 右ゾーン（敵）
const PZ_L = LANE_L + 10;     // panel zone left
const PZ_R = LANE_CX - 14;    // panel zone right
const EZ_L = LANE_CX + 14;    // enemy zone left
const EZ_R = LANE_R - 10;     // enemy zone right

const SCROLL_SPD  = 150;
const PLAYER_LERP = 0.13;
const FORMATION_Y = H - 140;
const MAX_SOLDIERS = 99;
const MAX_DISPLAY  = 20;

const FIRE_RATE  = 0.26; // 秒/発（兵士1体あたり）
const BULLET_SPD = 530;

// ウェーブ定義（右ゾーン）
const WAVE_DEFS = [
  { count:  4, hp: 2, speed:  72 },
  { count:  6, hp: 3, speed:  84 },
  { count:  9, hp: 3, speed:  96 },
  { count: 12, hp: 4, speed: 108 },
  { count: 15, hp: 5, speed: 118 },
];

const TOTAL_WAVES = WAVE_DEFS.length;
const BOSS_HP     = 60; // 弾1発=ダメージ1
