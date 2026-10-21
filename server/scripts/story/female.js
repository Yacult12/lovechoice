'use strict';

/**
 * 剧情数据 · 她的视角
 *
 * 与男线严格镜像：同一组 option_key，同一组选择顺序，
 * 但数值互为镜像（男线的 (m, f) 换成女线的 (f, m)），
 * 文案换成她视角的同一件事。
 *
 * 镜像由 scripts/sync-female-values.js 强制校验 ——
 * 两个文件里的 35 个 option_key 必须完全对称，
 * 差一个就报错退出。改数值请改男线，然后跑那个脚本。
 *
 * 数值语义（女线）：
 *   f = 她自己的状态
 *   m = 他的投入度
 *
 * 四类选项对应她自己的四个象限：
 *   A  索取/依赖型   她把情绪全押在他身上 → 自己空，他还在
 *   B  自足/坦诚型   经营自己的生活，也说出口 → 两边都好
 *   C  回避/压抑型   冷战、拉黑、互相消耗
 *   D  自足但推开型  「我过得挺好」→ 她好了，关系空了
 */

module.exports = {
  route: 'female',
  chapters: [
    // ==========================================================
    // 第一章 · 初遇：被放在心上的感觉
    // ==========================================================
    {
      no: 1,
      title: '第一章 · 初遇',
      bg: 'party',
      nodes: [
        {
          key: 'n_start', speaker: '旁白', bg: 'party',
          content: '十月，朋友组的聚会。他在人群边缘看见你，好像在等谁，又好像只是站着。',
          next: 'n_f1_c1'
        },
        {
          key: 'n_f1_c1', speaker: '旁白', bg: 'party', type: 'choice',
          content: '他朝你走过来了。他有话想说，但没说出来。',
          options: [
            {
              key: 'c1_approach', text: '接住他的紧张，替他把话头接过去',
              next: 'n_f1_a1', m: 9, f: -9
            },
            {
              key: 'c1_join', text: '和他聊两句，也叫上自己的朋友一起',
              next: 'n_f1_b1', m: 6, f: 8
            },
            {
              key: 'c1_ignore', text: '他走过来的时候，你在跟别人聊',
              next: 'n_f1_d1', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f1_a1', speaker: '他', bg: 'party',
          content: '「你怕不怕冷？」他问得没头没尾。你说怕。他就笑，说那我们不合适。',
          next: 'n_f1_c2'
        },
        {
          key: 'n_f1_b1', speaker: '他', bg: 'party',
          content: '他举起杯子又放下，好像还想说什么。最后只说了句「那下次见」，转身走了。',
          next: 'n_f1_c2'
        },
        {
          key: 'n_f1_d1', speaker: '旁白', bg: 'party',
          content: '他走过来的时候你正跟别人聊得开心。等你回过头，他已经跟别人聊上了。',
          next: 'n_f1_c2'
        },
        {
          key: 'n_f1_c2', speaker: '旁白', bg: 'party', type: 'choice',
          content: '你们在一起了。他回消息很快，几乎从不让你等。',
          options: [
            {
              key: 'c2_wait', text: '把一天里所有的事都讲给他听，连天气都想说',
              next: 'n_f1_a2', m: 9, f: -9
            },
            {
              key: 'c2_sleep', text: '留一点自己的时间给朋友和爱好',
              next: 'n_f1_b2', m: 6, f: 8
            },
            {
              key: 'c2_mute', text: '把他的聊天设成免打扰，专注自己的事',
              next: 'n_f1_d2', m: -7, f: 7
            }
          ]
        },
        {
          key: 'n_f1_a2', speaker: '你', bg: 'party',
          content: '你把一天里所有的事都讲给他听。他说「傻瓜」，你听了整个晚上都高兴。你不知道的是，他开始觉得喘不过气。',
          next: 'n_f1_end'
        },
        {
          key: 'n_f1_b2', speaker: '你', bg: 'party',
          content: '你还是喜欢告诉他今天的事，只是也留了一点给自己。你发现，这样反而更想说话。',
          next: 'n_f1_end'
        },
        {
          key: 'n_f1_d2', speaker: '你', bg: 'party',
          content: '你把他设成了免打扰。头几天你总想去解除设置，后来就没再管过。',
          next: 'n_f1_end'
        },
        {
          key: 'n_f1_end', speaker: '旁白', bg: 'party',
          content: '被人放在心上的感觉太好了，好到你开始把喜怒哀乐都系在他身上。'
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
          content: '在一起三个月。他记得你所有的喜好，也记得你所有的坏脾气。他对你好得没有一丝保留。',
          next: 'n_f2_c1'
        },
        {
          key: 'n_f2_c1', speaker: '旁白', bg: 'street', type: 'choice',
          content: '他今晚要和朋友吃饭。你想问他在做什么。',
          options: [
            {
              key: 'c3_check', text: '要求他事事报备，空闲时间都留给我',
              next: 'n_f2_a1', m: 9, f: -9
            },
            {
              key: 'c3_trust', text: '只说一句「玩得开心」，然后去陪自己的朋友',
              next: 'n_f2_b1', m: 7, f: 8
            },
            {
              key: 'c3_cold', text: '直接说「你去吧，不用解释」',
              next: 'n_f2_c1x', m: -6, f: -7
            },
            {
              key: 'c3_alone', text: '算了，他忙他的，我也忙我的',
              next: 'n_f2_d1', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f2_a1', speaker: '你', bg: 'street',
          content: '他真的把整个晚上的行程发给了你。你盯着屏幕等他每一条回复，心里踏实了一点，也没踏实多少。',
          next: 'n_f2_c2'
        },
        {
          key: 'n_f2_b1', speaker: '你', bg: 'street',
          content: '他回了个「好」。你放下手机去见了老同学，笑了好几次。回家时他在门口等，手里拎着你爱吃的。',
          next: 'n_f2_c2'
        },
        {
          key: 'n_f2_c1x', speaker: '旁白', bg: 'street',
          content: '他愣了一下，说「好」。那之后他报备的次数反而变少了。',
          next: 'n_f2_c2'
        },
        {
          key: 'n_f2_d1', speaker: '你', bg: 'street',
          content: '你放下手机。他后来发来的消息你隔了几个小时才回，回的时候已经不太记得他说了什么。',
          next: 'n_f2_c2'
        },
        {
          key: 'n_f2_c2', speaker: '旁白', bg: 'street', type: 'choice',
          content: '他抱怨工作。你想安慰他。',
          options: [
            {
              key: 'c4_solve', text: '急着替他分析，帮他骂那个不讲理的人',
              next: 'n_f2_a2', m: 9, f: -9
            },
            {
              key: 'c4_listen', text: '安静听完，只说「我在」',
              next: 'n_f2_b2', m: 7, f: 8
            },
            {
              key: 'c4_brief', text: '嗯两声，说「我有点累，先这样」',
              next: 'n_f2_c2x', m: -6, f: -7
            },
            {
              key: 'c4_alone', text: '「我也挺累的，改天再说」',
              next: 'n_f2_d2', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f2_a2', speaker: '你', bg: 'street',
          content: '你们一起骂到十二点，很解气。可第二天他还是很累，而且不太想跟你说话了。',
          next: 'n_f2_end'
        },
        {
          key: 'n_f2_b2', speaker: '你', bg: 'street',
          content: '「我在。」你说。他沉默了一会儿，说「嗯，我知道」。那晚他睡得比平时好。',
          next: 'n_f2_end'
        },
        {
          key: 'n_f2_c2x', speaker: '旁白', bg: 'street',
          content: '电话挂了。他没有再打过来，你也没有再问。',
          next: 'n_f2_end'
        },
        {
          key: 'n_f2_d2', speaker: '你', bg: 'street',
          content: '你挂了电话，翻身睡了。醒来的时候你想起他昨天好像找过你，但你想不起是什么事。',
          next: 'n_f2_end'
        },
        {
          key: 'n_f2_end', speaker: '旁白', bg: 'street',
          content: '你把亲密理解成了完全重合。而他的世界在悄悄变小。'
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
          content: '同一件事，第三次出现了。你已经知道他会怎么解释，也知道你们会怎么吵。',
          next: 'n_f3_c1'
        },
        {
          key: 'n_f3_c1', speaker: '旁白', bg: 'cafe', type: 'choice',
          content: '这一次，你特别累。',
          options: [
            {
              key: 'c5_endure', text: '再等等吧，也许他以后会改',
              next: 'n_f3_a1', m: 9, f: -9
            },
            {
              key: 'c5_speak', text: '说出来：我也有需要被照顾的地方',
              next: 'n_f3_b1', m: 6, f: 8
            },
            {
              key: 'c5_quiet', text: '谁也不先开口，看谁先低头',
              next: 'n_f3_c1x', m: -6, f: -7
            },
            {
              key: 'c5_leave', text: '算了，我先一个人待一会儿',
              next: 'n_f3_d1', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f3_a1', speaker: '你', bg: 'cafe',
          content: '你又替他找了个理由：他工作压力大。你一次次降低底线，心里那笔账你不敢去算。',
          next: 'n_f3_c2'
        },
        {
          key: 'n_f3_b1', speaker: '你', bg: 'cafe',
          content: '「我也会累的。」你说。他愣住了，说「我以为你不会累」。原来他也以为你不会。',
          next: 'n_f3_c2'
        },
        {
          key: 'n_f3_c1x', speaker: '旁白', bg: 'cafe',
          content: '你们隔着一张小桌，谁都没动面前的咖啡。空气比上一次更冷。',
          next: 'n_f3_c2'
        },
        {
          key: 'n_f3_d1', speaker: '旁白', bg: 'cafe',
          content: '你站起来走了。他在后面叫了你一声，你没回头。',
          next: 'n_f3_c2'
        },
        {
          key: 'n_f3_c2', speaker: '旁白', bg: 'cafe', type: 'choice',
          content: '你想起他说过「我可能给不了你想要的」。',
          options: [
            {
              key: 'c6_hold', text: '假装没事，说「我什么都不要」',
              next: 'n_f3_a2', m: 9, f: -9
            },
            {
              key: 'c6_admit', text: '承认这段关系在消耗我',
              next: 'n_f3_b2', m: 5, f: 8
            },
            {
              key: 'c6_leave', text: '想清楚了，我该走了',
              next: 'n_f3_d2', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f3_a2', speaker: '你', bg: 'cafe',
          content: '你说了「我什么都不要」。他握住了你的手。你们都很久没这么近过——因为谁都不敢再往前一步。',
          next: 'n_f3_end'
        },
        {
          key: 'n_f3_b2', speaker: '你', bg: 'cafe',
          content: '「我爱过你，但我不能这样消耗自己。」你说完，第一次觉得心里是亮的，不是空的。',
          next: 'n_f3_end'
        },
        {
          key: 'n_f3_d2', speaker: '你', bg: 'cafe',
          content: '你把要说的话删掉，把他的联系方式删掉，然后好好睡了一觉。醒来心里空空的，但也安静。',
          next: 'n_f3_end'
        },
        {
          key: 'n_f3_end', speaker: '旁白', bg: 'cafe',
          content: '害怕分开之后遇不到更好的，所以一直妥协。可真正的勇敢，是敢在痛的时候说不。'
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
          next: 'n_f4_c1'
        },
        {
          key: 'n_f4_c1', speaker: '旁白', bg: 'rain', type: 'choice',
          content: '分开后的第一周，你把他所有的聊天记录翻到了最开始。',
          options: [
            {
              key: 'c7_scroll', text: '翻遍记录，想找一句话把他叫回来',
              next: 'n_f4_a1', m: 9, f: -9
            },
            {
              key: 'c7_stop', text: '关掉手机，把这一周留给自己',
              next: 'n_f4_b1', m: 4, f: 8
            },
            {
              key: 'c7_erase', text: '删掉所有联系方式，清得干干净净',
              next: 'n_f4_c1x', m: -6, f: -7
            },
            {
              key: 'c7_alone', text: '这周我想一个人过，谁也不见',
              next: 'n_f4_d1', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f4_a1', speaker: '你', bg: 'rain',
          content: '你翻到很早以前的一条语音，那天他说「今天特别开心，因为下雨了」。你听着听着就哭了。',
          next: 'n_f4_c2'
        },
        {
          key: 'n_f4_b1', speaker: '你', bg: 'rain',
          content: '你把手机放进口袋，出了门。外面在下雨，你没带伞，走着走着反而舒服了一点。',
          next: 'n_f4_c2'
        },
        {
          key: 'n_f4_c1x', speaker: '你', bg: 'rain',
          content: '删得很干净，干净到第二天你想发消息时，手指停在「发送」上面，不知道该发给谁。',
          next: 'n_f4_c2'
        },
        {
          key: 'n_f4_d1', speaker: '你', bg: 'rain',
          content: '这一周你谁也没见。第八天你想起他，发现自己已经想不起他说话的样子了。',
          next: 'n_f4_c2'
        },
        {
          key: 'n_f4_c2', speaker: '旁白', bg: 'rain', type: 'choice',
          content: '你开始怀疑，是不是自己不够好。',
          options: [
            {
              key: 'c8_blame', text: '否定自己，觉得是自己不够好才走到这步',
              next: 'n_f4_a2', m: 9, f: -9
            },
            {
              key: 'c8_fact', text: '承认只是不合适，不是我不值得被爱',
              next: 'n_f4_b2', m: 6, f: 8
            },
            {
              key: 'c8_cut', text: '把他也拉黑，假装从没存在过',
              next: 'n_f4_c2x', m: -7, f: -7
            },
            {
              key: 'c8_alone', text: '我一个人也挺好的，不用谁来证明',
              next: 'n_f4_d2', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f4_a2', speaker: '你', bg: 'rain',
          content: '你把所有的错都揽到自己身上。你想，如果当时再好一点，是不是就不用走到这里。',
          next: 'n_f4_end'
        },
        {
          key: 'n_f4_b2', speaker: '你', bg: 'rain',
          content: '一段感情落幕，不等于你不值得被爱。允许自己难过，但别把一次失败当成整个人生的定论。',
          next: 'n_f4_end'
        },
        {
          key: 'n_f4_c2x', speaker: '旁白', bg: 'rain',
          content: '你把他从所有列表里删掉，最后一个长按确认的时候，你的手指停了很久。',
          next: 'n_f4_end'
        },
        {
          key: 'n_f4_d2', speaker: '你', bg: 'rain',
          content: '你把他的照片从手机里移走，也从心里移走。移走的时候你以为会疼，结果只是空。',
          next: 'n_f4_end'
        },
        {
          key: 'n_f4_end', speaker: '旁白', bg: 'rain',
          content: '放下不是遗忘，是不再被过去困住。'
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
          content: '一年后。你有常约的饭局，有重拾起来的爱好，有几个睡不着的晚上，也有几个睡得很好的早上。',
          next: 'n_f5_c1'
        },
        {
          key: 'n_f5_c1', speaker: '旁白', bg: 'dailylife', type: 'choice',
          content: '新认识的人问你在忙什么。你想了想。',
          options: [
            {
              key: 'c9_depend', text: '「等一个人回消息」',
              next: 'n_f5_a1', m: 9, f: -9
            },
            {
              key: 'c9_balanced', text: '把自己的日子过好，也给他留了位置',
              next: 'n_f5_b1', m: 8, f: 8
            },
            {
              key: 'c9_alone', text: '「没什么，我过得挺好的」',
              next: 'n_f5_d1', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f5_a1', speaker: '你', bg: 'dailylife',
          content: '你说完自己就笑了。笑得很轻，像在承认一件有点丢人、但也不打算改的事。',
          next: 'n_f5_c2'
        },
        {
          key: 'n_f5_b1', speaker: '你', bg: 'dailylife',
          content: '「朋友、爱好、还有一个人。」你数着说，「都在。」他听完点点头，说「听起来不错」。',
          next: 'n_f5_c2'
        },
        {
          key: 'n_f5_d1', speaker: '你', bg: 'dailylife',
          content: '「过得挺好的。」你说。这话是真的，只是你没提他。他也没问。',
          next: 'n_f5_c2'
        },
        {
          key: 'n_f5_c2', speaker: '旁白', bg: 'dailylife', type: 'choice',
          content: '有些不安已经到了嘴边。',
          options: [
            {
              key: 'c10_swallow', text: '什么都不说，猜忌试探，看他什么反应',
              next: 'n_f5_a2', m: 9, f: -9
            },
            {
              key: 'c10_tell', text: '坦诚说出来：我有点不安，讲给你听',
              next: 'n_f5_b2', m: 8, f: 8
            },
            {
              key: 'c10_silent', text: '算了，不说也没关系',
              next: 'n_f5_d2', m: -7, f: 8
            }
          ]
        },
        {
          key: 'n_f5_a2', speaker: '你', bg: 'dailylife',
          content: '你用一句「你今天怎么没找我」代替了真正想问的那句。他困惑地看着你，你把话咽了回去。',
          next: 'n_f5_end'
        },
        {
          key: 'n_f5_b2', speaker: '你', bg: 'dailylife',
          content: '「我有点不安。」你说得有点笨。他放下手机，认真听完了。两个人都是完整的，也都愿意为对方挪一点位置。',
          next: 'n_f5_end'
        },
        {
          key: 'n_f5_d2', speaker: '你', bg: 'dailylife',
          content: '你把想说的话咽了回去，继续过你的日子。日子过得挺好，就是偶尔会觉得少了点什么。',
          next: 'n_f5_end'
        },
        {
          key: 'n_f5_end', speaker: '旁白', bg: 'dailylife',
          content: '好的安全感，一半来自伴侣的真诚坚定，一半源于内心的自足。相爱是两个完整独立的人，互相靠近。'
        }
      ]
    }
  ]
};
