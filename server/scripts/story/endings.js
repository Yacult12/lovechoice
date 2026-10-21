'use strict';

/**
 * 结局定义
 *
 * 判定顺序：非隐藏优先（按 id 升序）→ 隐藏结局。
 * 因此每条线的条件必须互斥且完备：
 *   - 互斥：任意两个条件不可能同时成立
 *   - 完备：任意一组好感数值都必须命中至少一个
 *
 * 四种结局与「他 / 她」两条线互为镜像：
 *   自己高 + 对方高 → 圆满
 *   自己高 + 对方低 → 各自安好（你把自己过好了，关系没能留下）
 *   自己低 + 对方高 → 错过（对方还惦记，你却耗在里面）
 *   自己低 + 对方低 → 一个人的体面（两边都在消耗）
 *   隐藏：自己与对方同时到位 —— 两个完整的人并肩
 *
 * ============ 阈值不能拍脑袋 ============
 *
 * 这组阈值是 scripts/search-thresholds.js 搜出来的，不是猜的。
 * 之前用「自己 >= 45 且对方 >= 45」，实测分布是：
 *   圆满 0.3% / 各自安好 13.5% / 错过 11.2% / 一个人的体面 75%
 *
 * 「圆满」几乎撞不到，「一个人的体面」吃掉四分之三 ——
 * 认真玩的人反而拿不到好结局，这是设计事故。
 *
 * 现在这组（自己 15 / 对方 25）的实测分布：
 *   圆满 9.1% / 各自安好 33.9% / 错过 26.3% / 一个人的体面 30.7%
 *   隐藏结局 1.4%（需要同时把两边都顾上）
 *
 * 「圆满」只占 9% —— 认真玩才拿得到，但不至于撞一辈子撞不上。
 *
 * ⚠️ 隐藏结局必须被 e_bond 显式排除（用 not），
 *    否则判定顺序是「非隐藏优先」，隐藏结局永远轮不到。
 *    改阈值后请重跑：
 *      node scripts/search-thresholds.js
 *      node scripts/analyze-affection.js
 */

const SELF_HIGH = 15;   // 自己这一侧的「高」线
const OTHER_HIGH = 25;  // 对方这一侧的「高」线
const HIDDEN_SELF = 40; // 隐藏结局：自己
const HIDDEN_OTHER = 30; // 隐藏结局：对方

/**
 * 排除隐藏结局区间的条件。
 *
 * ⚠️ 男女两线必须各写一份，不能共用。
 *   隐藏结局在自己的线上是「自己 >= 40 且 对方 >= 30」，
 *   但 male 线的「自己」是 affection_male、female 线是 affection_female ——
 *   共用一份就会把两根轴写反：
 *     male 线用 (male>=40 && female>=30)  → 对
 *     female 线也用它                      → 错（轴反了）
 *   轴一反，female=35/male=40 这种点就被 e_bond 排除、
 *   又不满足隐藏结局，两头落空 —— 实测有 1449 种组合无任何结局命中。
 */
const notHiddenMale = {
  not: {
    all: [
      { affection_male: { '>=': HIDDEN_SELF } },
      { affection_female: { '>=': HIDDEN_OTHER } }
    ]
  }
};

const notHiddenFemale = {
  not: {
    all: [
      { affection_female: { '>=': HIDDEN_SELF } },
      { affection_male: { '>=': HIDDEN_OTHER } }
    ]
  }
};

module.exports = {
  male: [
    {
      key: 'e_bond',
      title: '圆满',
      description:
        '你们都成了更好的自己，也还在一起。这一次，不是因为抓得紧，是因为都站稳了。',
      condition: {
        all: [
          { affection_male: { '>=': SELF_HIGH } },
          { affection_female: { '>=': OTHER_HIGH } },
          notHiddenMale
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_apart',
      title: '各自安好',
      description:
        '最后没走到一起。但你没有把自己弄丢，她也没有。分开不是谁的错，只是两条路岔开了。',
      condition: {
        all: [
          { affection_male: { '>=': SELF_HIGH } },
          { affection_female: { '<': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_miss',
      title: '错过',
      description:
        '她一直都在。只是那时候的你，太用力了，忙着围着她转，反而看不见站在旁边的人。',
      condition: {
        all: [
          { affection_male: { '<': SELF_HIGH } },
          { affection_female: { '>=': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_alone',
      title: '一个人的体面',
      description:
        '你把体面守得很好，好到只剩下体面。两个人都没做错什么，也都没得到什么。',
      condition: {
        all: [
          { affection_male: { '<': SELF_HIGH } },
          { affection_female: { '<': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_quiet',
      title: '原来那天你也在',
      description:
        '很多年后你才明白：那些你以为错过的时刻，她其实一直都在。你终于学会爱自己，却再也找不到那个愿意等你的人。',
      condition: {
        all: [
          { affection_male: { '>=': HIDDEN_SELF } },
          { affection_female: { '>=': HIDDEN_OTHER } }
        ]
      },
      isHidden: 1
    }
  ],

  female: [
    {
      key: 'e_bond',
      title: '圆满',
      description:
        '你们都成了更好的自己，也还在一起。这一次，不是因为抓得紧，是因为都站稳了。',
      condition: {
        all: [
          { affection_female: { '>=': SELF_HIGH } },
          { affection_male: { '>=': OTHER_HIGH } },
          notHiddenFemale
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_apart',
      title: '各自安好',
      description:
        '最后没走到一起。但你没有把自己弄丢，他也没有。分开不是谁的错，只是两条路岔开了。',
      condition: {
        all: [
          { affection_female: { '>=': SELF_HIGH } },
          { affection_male: { '<': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_miss',
      title: '错过',
      description:
        '他一直都在。只是那时候的你，太习惯被爱了，反而忘了看看自己还想要什么。',
      condition: {
        all: [
          { affection_female: { '<': SELF_HIGH } },
          { affection_male: { '>=': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_alone',
      title: '一个人的体面',
      description:
        '你把体面守得很好，好到只剩下体面。两个人都没做错什么，也都没得到什么。',
      condition: {
        all: [
          { affection_female: { '<': SELF_HIGH } },
          { affection_male: { '<': OTHER_HIGH } }
        ]
      },
      isHidden: 0
    },
    {
      key: 'e_umbrella',
      title: '伞一直在他那里',
      description:
        '很多年后你才明白：那些你以为错过的时刻，他其实一直都在。你终于学会爱自己，却再也找不到那个愿意等你的人。',
      condition: {
        all: [
          { affection_female: { '>=': HIDDEN_SELF } },
          { affection_male: { '>=': HIDDEN_OTHER } }
        ]
      },
      isHidden: 1
    }
  ]
};
