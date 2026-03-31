/**
 * Soothing acknowledgment replies for FoloToy.
 *
 * 12 intent categories, 5 candidates each — one is chosen at random.
 * Principles: convey "I heard you + I'm working on it", no time promises.
 */

const INTENT_RULES: Array<{ pattern: RegExp; candidates: string[] }> = [
  {
    // 1. 难过类
    pattern: /难过|伤心|哭|不开心|委屈/,
    candidates: [
      '抱抱你，我在认真听呢，让我想想怎么说...',
      '别难过，我陪着你，让我想一会儿...',
      '嗯，我听到了，给我点时间好好想想怎么帮你',
      '你说的我都记住了，让我想想...',
      '我在认真想呢，你先缓缓',
    ],
  },
  {
    // 2. 生气类
    pattern: /生气|愤怒|烦|讨厌|气死/,
    candidates: [
      '我理解你，让我想想怎么帮你...',
      '消消气，我在认真想办法呢',
      '听到了，让我好好想一下...',
      '别气别气，我来帮你想想，给我一点时间',
      '嗯，你说的我记住了，我想一下',
    ],
  },
  {
    // 3. 累/怕类
    pattern: /累|疲|困|害怕|怕/,
    candidates: [
      '辛苦了，让我想想怎么帮你...',
      '别怕，有我在呢，我想一下',
      '你先歇歇，让我帮你想想办法...',
      '我在想办法呢，你先放松一下',
      '嗯嗯，我在认真想怎么帮你...',
    ],
  },
  {
    // 4. 故事类
    pattern: /故事|story/i,
    candidates: [
      '让我好好想一个故事...',
      '嗯，我在想一个好听的故事呢',
      '让我想想讲什么好...',
      '我在脑子里翻故事书呢，等等我',
      '故事嘛，得好好想一个才行...',
    ],
  },
  {
    // 5. 唱歌/音乐类
    pattern: /唱|歌|音乐|播放|儿歌/,
    candidates: [
      '让我想想唱什么好...',
      '嗯，我在选歌呢，等我一下',
      '我清清嗓子，想想唱什么...',
      '让我找一首好听的...',
      '好嘞，让我想想唱哪首',
    ],
  },
  {
    // 6. 笑话类
    pattern: /笑话|joke|搞笑|好笑/i,
    candidates: [
      '让我想一个好笑的...',
      '嗯，我在想笑话呢，先憋住',
      '好嘞，让我想一个逗你乐的...',
      '笑话嘛，得想一个真正好笑的才行...',
      '让我翻翻我的笑话本...',
    ],
  },
  {
    // 7. 知识/古诗类
    pattern: /为什么|怎么|什么是|古诗|诗|背/,
    candidates: [
      '好问题，让我好好想想...',
      '嗯，这个问题我得想一下',
      '让我仔细想想怎么跟你解释...',
      '这个嘛，让我想一想...',
      '嗯，让我好好想想这个',
    ],
  },
  {
    // 8. 继续/追问类
    pattern: /继续|接着|然后呢|后来|下一个/,
    candidates: [
      '让我接着往下想...',
      '嗯，后面的我得好好想想',
      '让我理理思路...',
      '好嘞，让我想想后面怎么接',
      '我在想呢，等一下',
    ],
  },
  {
    // 9. 打招呼/呼唤类
    pattern: /你好|嗨|hello|hi\b|hey|哈喽/i,
    candidates: [
      '来啦，让我想想说什么...',
      '嘿，你来啦，让我想想...',
      '我在呢，让我想想跟你说什么好',
      '哎，来了，给我一点时间想想',
      '哈，你来啦，让我想一下...',
    ],
  },
  {
    // 10. 告别/睡觉类
    pattern: /关机|睡|拜拜|再见|bye|晚安/i,
    candidates: ['好嘞~', '嗯嗯~', '好的~', '哦~', '嗯~'],
  },
  {
    // 11. 配网/技术类
    pattern: /网络|配网|wifi|蓝牙|连接/i,
    candidates: [
      '让我想想怎么帮你...',
      '嗯，这个我得想一下',
      '让我看看怎么办...',
      '我在想呢，等一下',
      '嗯，给我一点时间想想',
    ],
  },
  {
    // 12. 查询类
    pattern: /天气|新闻|时间|几点|日期|查|搜/,
    candidates: [
      '我去帮你查一查...',
      '好的，我来查一下',
      '稍等，我帮你看看',
      '我去查一下，等我一秒',
      '让我来查查看',
    ],
  },
]

const DEFAULT_CANDIDATES = [
  '让我想一想...',
  '嗯嗯，让我想想怎么回答你',
  '好嘞，我想一下',
  '嗯，给我一点时间想想',
  '让我好好想想...',
]

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Creates a soothing reply picker that guarantees no repeats until all
 * candidates in the matched category are exhausted, then reshuffles.
 *
 * Usage:
 *   const picker = createSoothingPicker(text)
 *   picker() // first reply (no repeat)
 *   picker() // second reply (different from first)
 */
export function createSoothingPicker(text?: string): () => string {
  let candidates: string[] | undefined
  if (text) {
    for (const rule of INTENT_RULES) {
      if (rule.pattern.test(text)) {
        candidates = rule.candidates
        break
      }
    }
  }
  const pool = candidates ?? DEFAULT_CANDIDATES

  let queue: string[] = []
  return () => {
    if (queue.length === 0) {
      queue = shuffle([...pool])
    }
    return queue.pop()!
  }
}

/** Returns one randomly chosen soothing reply matching the input intent. */
export function pickSoothingReply(text?: string): string {
  return createSoothingPicker(text)()
}
