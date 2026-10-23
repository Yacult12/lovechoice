'use strict';

/**
 * 章节启示 · 导语 · 登录页文案
 *
 * 每章结束时给玩家一段「本章启示」。这段文案是全篇的灵魂 ——
 * 前面五条剧情线只是铺垫，这段话才是玩家真正带走的东西。
 *
 * 放在 src/data/ 而不是 scripts/，因为后端要通过
 * /api/story/insights 把它发给前端。
 */

/** 各章启示，按章节号索引 */
const INSIGHTS = [
  {
    chapterNo: 1,
    title: '本章启示 · 爱人先爱己',
    content:
      '安全感不是别人施舍给你的礼物。不要把自我价值全部押在恋人身上。先接纳完整的自己，拥有属于自己的生活，再去相爱。讨好换不来长久爱情，失去自我的付出，终会变成彼此的负担。',
    illustration: 'chapter-1'
  },
  {
    chapterNo: 2,
    title: '本章启示 · 保持边界感 + 学会珍惜',
    content:
      '真正的亲密不是消灭全部距离。尊重对方的朋友圈、独处需求，不窥探隐私，不强迫对方完全活成你期待的模样。感情经不起消耗，不要把别人的温柔视作理所当然。珍惜不是不吵架，而是就算争执，也记得对方的好，守住言语的底线。',
    illustration: 'chapter-2'
  },
  {
    chapterNo: 3,
    title: '本章启示 · 敢爱敢恨',
    content:
      '勇敢热烈地去爱，也勇敢对消耗你的关系说不。爱不是一味忍受，当一段感情带给你的痛苦远大于快乐，不必死死纠缠。喜欢就真心相待，受伤害就果断抽身，不必因为不甘心而继续折磨自己。',
    illustration: 'chapter-3'
  },
  {
    chapterNo: 4,
    title: '本章启示 · 学会放下',
    content:
      '游戏可以读档重来，但现实没有回退键。分开不必非要分出谁对谁错，不必沉溺悔恨，也不要全盘否定自己。放下不是遗忘，而是不再被过去困住，接纳遗憾，好好往前走。',
    illustration: 'chapter-4'
  },
  {
    chapterNo: 5,
    title: '终章启示 · 安全感',
    content:
      '真正健康的爱情：爱人先爱己，亲密有边界，相处懂珍惜，相爱有勇气，离别懂放下。我们渴望被爱，但首先要学会如何爱自己。',
    illustration: 'chapter-5'
  }
];

/** 导语 —— 出现在选线页和登录页 */
const PROLOGUE = {
  title: '导语',
  content:
    '爱情没有标准答案。同样一段相处，男生和女生看见的世界并不相同。希望在这里，我们一起捡起被忽略的温柔，学会怎样好好去爱，也好好爱自己。'
};

/** 登录页底部小文案 */
const LOGIN_FOOTER = {
  title: '同一个故事，两种视角',
  content:
    '爱情没有完美选项，真正的爱，藏在理解、尊重与自我成长之中。',
  signature: '爱人先爱己，愿我们都能好好爱人，也好好被爱。'
};

/** 取某一章的启示 */
function getInsight(chapterNo) {
  const n = Number(chapterNo);
  return INSIGHTS.find((i) => i.chapterNo === n) || null;
}

module.exports = { INSIGHTS, PROLOGUE, LOGIN_FOOTER, getInsight };
