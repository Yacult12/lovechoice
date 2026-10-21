'use strict';

/**
 * 剧情数据 · 他的视角
 *
 * ============ 数值模型（改数值前必读） ============
 *
 *   m = 他自己的状态（有没有把自己耗空）
 *   f = 她的投入度（她还在不在这段关系里）
 *
 * 四类选项，铺满好感平面的四个象限：
 *
 *   A  讨好/索取型     m -9 / f +9
 *       围着她转、事事迁就。她很开心，他慢慢空了。
 *       → 走到底是「错过」：她一直都在，只是他把自己弄丢了。
 *
 *   B  爱己/边界型     m +8 / f +6
 *       先把自己的生活过好，同时留出位置给她。
 *       → 全篇想推的路线。走到底是「圆满」。
 *
 *   C  逃避/压抑型     m -7 / f -6
 *       冷战、敷衍、假装没事。两边一起烂掉。
 *       → 走到底是「一个人的体面」。
 *
 *   D  爱己但推开型    m +8 / f -7
 *       「我过得很好，不需要你了。」
 *       自己确实好了，关系却空了。
 *       → 走到底是「各自安好」。
 *
 * ⚠️ 之前踩的坑（别再犯）
 *   1. 只设了三类（A/B/C），好感值两维高度正相关，
 *      「自己高 + 对方低」那个象限完全是空的 ——
 *      对应结局命中率 0.1%，玩家根本遇不到。
 *      D 类必须出现在**每一个**抉择点，
 *      否则「全选 D」这条路根本走不通（m 攒不起来）。
 *   2. 把 B 类设成「只涨 m、f 几乎不涨」，
 *      等于在数值上说「讨好是留住她的唯一办法」，
 *      跟本章启示「讨好换不来长久爱情」完全相反。
 *      正确结构是 B 两边都涨，A 拿 m 换 f。
 *
 * option_key 全局唯一（不是章内唯一），
 * 这样 sync-female-values.js 才能按 key 做镜像。
 */

module.exports = {
  route: 'male',
  chapters: [
    // ==========================================================
    // 第一章 · 初遇：心动的开始
    // ==========================================================
    {
      no: 1,
      title: '第一章 · 初遇',
      bg: 'party',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'party',
          content: '十月，朋友组的聚会。你在人群边缘看见一个女生，好像在等谁，又好像只是站着。',
          next: 'n_m1_c1'
        },
        {
          key: 'n_m1_c1', speaker: '旁白', bg: 'party', type: 'choice',
          content: '她朝你这边看了一眼。你有三秒钟决定要不要过去。',
          options: [
            {
              key: 'c1_approach', text: '走过去，把她随口说过的喜好都记下来',
              next: 'n_m1_a1', m: -9, f: 9
            },
            {
              key: 'c1_join', text: '走过去聊两句，也顺手约上了自己的朋友',
              next: 'n_m1_b1', m: 8, f: 6
            },
            {
              key: 'c1_ignore', text: '继续跟朋友聊，她来不来都无所谓',
              next: 'n_m1_d1', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m1_a1', speaker: '你', bg: 'party',
          content: '你走过去，把「你喜欢猫还是狗」「你怕不怕冷」这类问题提前排好顺序。她笑着听完，说你怎么跟背课文似的。你说没有啊，我只是记性好。',
          next: 'n_m1_c2'
        },
        {
          key: 'n_m1_b1', speaker: '你', bg: 'party',
          content: '你走过去，聊了几句，转头把刚才约的朋友也叫了过来。她愣了一下，说这样挺好的。',
          next: 'n_m1_c2'
        },
        {
          key: 'n_m1_d1', speaker: '你', bg: 'party',
          content: '你没动。整晚你都在跟老同学聊从前的事，散场时回头，她已经不在了。',
          next: 'n_m1_c2'
        },
        {
          key: 'n_m1_c2', speaker: '旁白', bg: 'party', type: 'choice',
          content: '那天之后，你开始等她的消息。她的回复通常在两分钟以内，偶尔会晚一点。',
          options: [
            {
              key: 'c2_wait', text: '每晚刷新，确认她最后一条动态的时间',
              next: 'n_m1_a2', m: -9, f: 9
            },
            {
              key: 'c2_sleep', text: '把手机扣在桌上，先睡够',
              next: 'n_m1_b2', m: 8, f: 6
            },
            {
              key: 'c2_mute', text: '把她的聊天设成免打扰，专心做自己的事',
              next: 'n_m1_d2', m: 7, f: -7
            }
          ]
        },
        {
          key: 'n_m1_a2', speaker: '你', bg: 'party',
          content: '你算过，她的活跃时间在二十一点前后。你把晚上的事都推了，手机放在枕边，屏幕亮一次你看一次。',
          next: 'n_m1_end'
        },
        {
          key: 'n_m1_b2', speaker: '你', bg: 'party',
          content: '你第一次在十二点前睡着，醒来发现她发来三条消息。你回得比以前慢，但心情很好。',
          next: 'n_m1_end'
        },
        {
          key: 'n_m1_d2', speaker: '你', bg: 'party',
          content: '你把她设成了免打扰。头几天你总想去解除设置，后来就没再管过。',
          next: 'n_m1_end'
        },
        {
          key: 'n_m1_end', speaker: '旁白', bg: 'party',
          content: '你以为你在追一个人。后来才发现，你追的是她给你的那种被需要的感觉。'
        }
      ]
    },

    // ==========================================================
    // 第二章 · 相处：边界与珍惜
    // ==========================================================
    {
      no: 2,
      title: '第二章 · 相处',
      bg: 'street',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'street',
          content: '在一起三个月。约会你提前做好攻略，礼物你提前一个月订，她的口味你记得比自己的还清楚。',
          next: 'n_m2_c1'
        },
        {
          key: 'n_m2_c1', speaker: '旁白', bg: 'street', type: 'choice',
          content: '她最近常在忙。你想知道她在忙什么。',
          options: [
            {
              key: 'c3_check', text: '翻她手机，看她今天都和谁在一起',
              next: 'n_m2_a1', m: -9, f: 9
            },
            {
              key: 'c3_trust', text: '只发一句「玩得开心吗」，然后去做自己的事',
              next: 'n_m2_b1', m: 8, f: 7
            },
            {
              key: 'c3_cold', text: '直接说「你去吧，不用解释」',
              next: 'n_m2_c1x', m: -7, f: -6
            },
            {
              key: 'c3_alone', text: '算了，她忙她的，我也忙我的',
              next: 'n_m2_d1', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m2_a1', speaker: '你', bg: 'street',
          content: '屏幕在你手里亮着。你看得很仔细，连她和谁用同一个表情包都记住了。你把手机还回去的时候，手心是汗。',
          next: 'n_m2_c2'
        },
        {
          key: 'n_m2_b1', speaker: '你', bg: 'street',
          content: '你发完那句「玩得开心吗」，把手机扣下，去把拖了两周的球打了。她回了一个表情，你笑了一下。',
          next: 'n_m2_c2'
        },
        {
          key: 'n_m2_c1x', speaker: '旁白', bg: 'street',
          content: '她愣了一下，说「好」。那之后她报备的次数反而变少了。',
          next: 'n_m2_c2'
        },
        {
          key: 'n_m2_d1', speaker: '你', bg: 'street',
          content: '你把手机放回口袋。她后来发来的消息你隔了几个小时才回，回的时候已经不太记得她说了什么。',
          next: 'n_m2_c2'
        },
        {
          key: 'n_m2_c2', speaker: '旁白', bg: 'street', type: 'choice',
          content: '晚上她给你打电话，一开口就是「我好累」。你很想帮她。',
          options: [
            {
              key: 'c4_solve', text: '立刻讲道理，给她三套解决方案',
              next: 'n_m2_a2', m: -9, f: 9
            },
            {
              key: 'c4_listen', text: '先安静听完，再问一句「然后呢」',
              next: 'n_m2_b2', m: 8, f: 7
            },
            {
              key: 'c4_brief', text: '嗯两声，说「我有点累，先这样」',
              next: 'n_m2_c2x', m: -7, f: -6
            },
            {
              key: 'c4_alone', text: '「我也挺累的，改天再说」',
              next: 'n_m2_d2', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m2_a2', speaker: '你', bg: 'street',
          content: '你说得很在理，还帮她把明天该怎么跟对方说都想好了。她「嗯」了一声，然后说「我知道了」。',
          next: 'n_m2_end'
        },
        {
          key: 'n_m2_b2', speaker: '你', bg: 'street',
          content: '你什么都没建议，只是一直「嗯嗯」。挂了电话她说「谢谢你听我说完」。这句话你记了很久。',
          next: 'n_m2_end'
        },
        {
          key: 'n_m2_c2x', speaker: '旁白', bg: 'street',
          content: '电话挂了。她没有再打过来，你也没有再问。',
          next: 'n_m2_end'
        },
        {
          key: 'n_m2_d2', speaker: '你', bg: 'street',
          content: '你挂了电话，翻身睡了。醒来的时候你想起她昨天好像找过你，但你想不起是什么事。',
          next: 'n_m2_end'
        },
        {
          key: 'n_m2_end', speaker: '旁白', bg: 'street',
          content: '你把在乎变成了管，把体贴变成了安排。她一开始觉得被珍惜，后来只觉得喘不过气。'
        }
      ]
    },

    // ==========================================================
    // 第三章 · 矛盾：敢爱也敢止损
    // ==========================================================
    {
      no: 3,
      title: '第三章 · 矛盾',
      bg: 'cafe',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'cafe',
          content: '同一件事，第三次出现了。你已经能预见她会怎么开头。',
          next: 'n_m3_c1'
        },
        {
          key: 'n_m3_c1', speaker: '旁白', bg: 'cafe', type: 'choice',
          content: '你很累。',
          options: [
            {
              key: 'c5_endure', text: '再忍忍，也许以后她会变好',
              next: 'n_m3_a1', m: -9, f: 9
            },
            {
              key: 'c5_speak', text: '说出来：我最近需要一点自己的空间',
              next: 'n_m3_b1', m: 8, f: 6
            },
            {
              key: 'c5_quiet', text: '谁也不说话，看谁先低头',
              next: 'n_m3_c1x', m: -7, f: -6
            },
            {
              key: 'c5_leave', text: '算了，我先去一个人待会儿',
              next: 'n_m3_d1', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m3_a1', speaker: '你', bg: 'cafe',
          content: '你说「没事的，我不介意」。她松了口气。你也松了口气——虽然你知道自己很介意。',
          next: 'n_m3_c2'
        },
        {
          key: 'n_m3_b1', speaker: '你', bg: 'cafe',
          content: '你说完就后悔了，怕她觉得你在推开她。她沉默了几秒，说「好，我给你空间」。这句话你听不出是松了口气还是失望。',
          next: 'n_m3_c2'
        },
        {
          key: 'n_m3_c1x', speaker: '旁白', bg: 'cafe',
          content: '你们各坐一边，咖啡凉透了。谁也没开口，因为开口就意味着先承认自己受不了。',
          next: 'n_m3_c2'
        },
        {
          key: 'n_m3_d1', speaker: '旁白', bg: 'cafe',
          content: '你结了账，起身走了。她在后面叫了你一声，你没回头。',
          next: 'n_m3_c2'
        },
        {
          key: 'n_m3_c2', speaker: '旁白', bg: 'cafe', type: 'choice',
          content: '深夜你翻来覆去，脑子里只有一句：也许我们真的不合适。',
          options: [
            {
              key: 'c6_hold', text: '假装没事，把所有的念头都咽下去',
              next: 'n_m3_a2', m: -9, f: 9
            },
            {
              key: 'c6_admit', text: '承认这段关系在消耗我',
              next: 'n_m3_b2', m: 8, f: 5
            },
            {
              key: 'c6_leave', text: '想清楚了，我该走了',
              next: 'n_m3_d2', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m3_a2', speaker: '你', bg: 'cafe',
          content: '你把话说得很轻，说她最近工作太忙了。她信了，或者说，她选择信了。',
          next: 'n_m3_end'
        },
        {
          key: 'n_m3_b2', speaker: '你', bg: 'cafe',
          content: '「我好像在这段关系里，越活越不像我自己。」你说完，手在抖。但说出来的那一刻，你轻了一点。',
          next: 'n_m3_end'
        },
        {
          key: 'n_m3_d2', speaker: '你', bg: 'cafe',
          content: '你把要说的话删掉，把她的联系方式删掉，然后好好睡了一觉。醒来心里空空的，但也安静。',
          next: 'n_m3_end'
        },
        {
          key: 'n_m3_end', speaker: '旁白', bg: 'cafe',
          content: '喜欢的时候要勇敢，被消耗的时候也要勇敢。拖着不放手，不叫坚持，叫舍不得自己。'
        }
      ]
    },

    // ==========================================================
    // 第四章 · 别离：学会放下
    // ==========================================================
    {
      no: 4,
      title: '第四章 · 别离',
      bg: 'rain',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'rain',
          content: '最后还是分开了。理由很杂，但你们都知道是什么。',
          next: 'n_m4_c1'
        },
        {
          key: 'n_m4_c1', speaker: '旁白', bg: 'rain', type: 'choice',
          content: '分开后的第一周，你把聊天记录翻到了最开始。',
          options: [
            {
              key: 'c7_scroll', text: '翻遍记录，想找一句话把她劝回来',
              next: 'n_m4_a1', m: -9, f: 9
            },
            {
              key: 'c7_stop', text: '关掉手机，去过自己的这一周',
              next: 'n_m4_b1', m: 8, f: 4
            },
            {
              key: 'c7_erase', text: '删掉所有联系方式，清得干干净净',
              next: 'n_m4_c1x', m: -7, f: -6
            },
            {
              key: 'c7_alone', text: '这周我想一个人过，谁也不见',
              next: 'n_m4_d1', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m4_a1', speaker: '你', bg: 'rain',
          content: '你翻到很早以前的一条语音，那天她说「今天特别开心，因为下雨了」。你听着听着就哭了。',
          next: 'n_m4_c2'
        },
        {
          key: 'n_m4_b1', speaker: '你', bg: 'rain',
          content: '你把手机放进口袋，出了门。外面在下雨，你没带伞，走着走着反而舒服了一点。',
          next: 'n_m4_c2'
        },
        {
          key: 'n_m4_c1x', speaker: '你', bg: 'rain',
          content: '删得很干净，干净到第二天你想发消息时，手指停在「发送」上面，不知道该发给谁。',
          next: 'n_m4_c2'
        },
        {
          key: 'n_m4_d1', speaker: '你', bg: 'rain',
          content: '这一周你谁也没见。第八天你想起她，发现自己已经想不起她说话的样子了。',
          next: 'n_m4_c2'
        },
        {
          key: 'n_m4_c2', speaker: '旁白', bg: 'rain', type: 'choice',
          content: '你开始怀疑，是不是自己不够好。',
          options: [
            {
              key: 'c8_blame', text: '认定是自己失败，自己不配被喜欢',
              next: 'n_m4_a2', m: -9, f: 9
            },
            {
              key: 'c8_fact', text: '承认只是不合适，不是谁的错',
              next: 'n_m4_b2', m: 8, f: 6
            },
            {
              key: 'c8_cut', text: '把她的号码也删掉，假装从没存在过',
              next: 'n_m4_c2x', m: -7, f: -7
            },
            {
              key: 'c8_alone', text: '我一个人也挺好的，不用谁来证明',
              next: 'n_m4_d2', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m4_a2', speaker: '你', bg: 'rain',
          content: '你把所有错都揽到自己身上，像揽一件行李，仿佛只要你足够自责，结局就能重来一次。',
          next: 'n_m4_end'
        },
        {
          key: 'n_m4_b2', speaker: '你', bg: 'rain',
          content: '不是所有相爱都能走到最后。有些人不是不好，只是不适合并肩。放过她，也是放过那个困住的你。',
          next: 'n_m4_end'
        },
        {
          key: 'n_m4_c2x', speaker: '旁白', bg: 'rain',
          content: '你把门关上得很响，然后站在门后很久，一句话也说不出来。',
          next: 'n_m4_end'
        },
        {
          key: 'n_m4_d2', speaker: '你', bg: 'rain',
          content: '你把她的照片从手机里移走，也从心里移走。移走的时候你以为会疼，结果只是空。',
          next: 'n_m4_end'
        },
        {
          key: 'n_m4_end', speaker: '旁白', bg: 'rain',
          content: '放下不是遗忘。你把回忆收好，然后继续走。'
        }
      ]
    },

    // ==========================================================
    // 第五章 · 圆满：什么是真正的安全感
    // ==========================================================
    {
      no: 5,
      title: '第五章 · 圆满',
      bg: 'dailylife',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'dailylife',
          content: '一年后。你有固定的朋友，有雷打不动的球场，有几个睡不着的晚上，也有几个睡得很好的早上。',
          next: 'n_m5_c1'
        },
        {
          key: 'n_m5_c1', speaker: '旁白', bg: 'dailylife', type: 'choice',
          content: '新认识的人问你在忙什么。你想了想。',
          options: [
            {
              key: 'c9_depend', text: '「等一个人回消息」',
              next: 'n_m5_a1', m: -9, f: 9
            },
            {
              key: 'c9_balanced', text: '把自己的日子过好，也给她留了位置',
              next: 'n_m5_b1', m: 8, f: 8
            },
            {
              key: 'c9_alone', text: '「没什么，我过得挺好的」',
              next: 'n_m5_d1', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m5_a1', speaker: '你', bg: 'dailylife',
          content: '你说完自己就笑了。笑得很轻，像在承认一件有点丢人、但也不打算改的事。',
          next: 'n_m5_c2'
        },
        {
          key: 'n_m5_b1', speaker: '你', bg: 'dailylife',
          content: '「球场、朋友、还有一个人。」你数着说，「都在。」她听完点点头，说「听起来不错」。',
          next: 'n_m5_c2'
        },
        {
          key: 'n_m5_d1', speaker: '你', bg: 'dailylife',
          content: '「过得挺好的。」你说。这话是真的，只是你没提她。她也没问。',
          next: 'n_m5_c2'
        },
        {
          key: 'n_m5_c2', speaker: '旁白', bg: 'dailylife', type: 'choice',
          content: '有些话到了嘴边，你还在想要不要讲。',
          options: [
            {
              key: 'c10_swallow', text: '什么都不说，等她发现',
              next: 'n_m5_a2', m: -9, f: 9
            },
            {
              key: 'c10_tell', text: '说出来：我需要你，我想你了',
              next: 'n_m5_b2', m: 8, f: 8
            },
            {
              key: 'c10_silent', text: '算了，不说也没关系',
              next: 'n_m5_d2', m: 8, f: -7
            }
          ]
        },
        {
          key: 'n_m5_a2', speaker: '你', bg: 'dailylife',
          content: '你没讲。她问了一句「你最近怎么了」，你说「没什么」，话题就过去了。',
          next: 'n_m5_end'
        },
        {
          key: 'n_m5_b2', speaker: '你', bg: 'dailylife',
          content: '「我今天很想你。」你说得有点笨。她笑了一下，说「我也是」。就这么简单。',
          next: 'n_m5_end'
        },
        {
          key: 'n_m5_d2', speaker: '你', bg: 'dailylife',
          content: '你把想说的话咽了回去，继续过你的日子。日子过得挺好，就是偶尔会觉得少了点什么。',
          next: 'n_m5_end'
        },
        {
          key: 'n_m5_end', speaker: '旁白', bg: 'dailylife',
          content: '安全感不是把谁牢牢捆住，是你先站稳了，再伸出手。完整的你，才接得住另一个人。'
        }
      ]
    }
  ]
};
