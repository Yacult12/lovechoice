'use strict';

const config = require('../config');

/** 把好感度裁剪到 [min, max] 区间内。 */
function clampAffection(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(config.game.affectionMax, Math.max(config.game.affectionMin, n));
}

module.exports = { clampAffection };
