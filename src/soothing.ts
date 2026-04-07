/**
 * Soothing acknowledgment replies for FoloToy.
 *
 * 12 intent categories, ~12 candidates each (zh + en).
 * Language is auto-detected from user input.
 * Principles: convey "I heard you + I'm working on it", no time promises.
 */

type IntentRule = {
  pattern: RegExp
  zh: string[]
  en: string[]
}

const INTENT_RULES: IntentRule[] = [
  {
    // 1. 难过类
    pattern: /难过|伤心|哭|不开心|委屈|sad|upset|cry|unhappy/i,
    zh: [
      '抱抱你，我在认真听呢，让我想想怎么说...',
      '别难过，我陪着你，让我想一会儿...',
      '嗯，我听到了，给我点时间好好想想怎么帮你',
      '你说的我都记住了，让我想想...',
      '我在认真想呢，你先缓缓',
      '嗯嗯，我在呢，你先深呼吸一下',
      '我听着呢，你慢慢说，不着急',
      '有我陪你呢，我帮你想想办法',
      '你的感受我懂，让我好好想一下',
      '别着急，我正在努力帮你想呢',
      '你说的每一句我都认真听了',
      '我陪着你呢，让我想想该说什么',
    ],
    en: [
      "I hear you, let me think about what to say...",
      "I'm here with you, give me a moment...",
      "I'm listening carefully, let me think...",
      "I understand, let me figure out how to help...",
      "Take a deep breath, I'm thinking...",
      "I'm right here, just gathering my thoughts...",
      "Everything you said matters, let me think...",
      "I'm here for you, give me a second...",
      "I hear you, let me think this through...",
      "Don't worry, I'm working on a response...",
      "I'm listening, let me think of the right words...",
      "You're not alone, let me think about this...",
    ],
  },
  {
    // 2. 生气类
    pattern: /生气|愤怒|烦|讨厌|气死|angry|mad|furious|annoyed|hate/i,
    zh: [
      '我理解你，让我想想怎么帮你...',
      '消消气，我在认真想办法呢',
      '听到了，让我好好想一下...',
      '别气别气，我来帮你想想，给我一点时间',
      '嗯，你说的我记住了，我想一下',
      '我能理解你的心情，让我帮你想想',
      '先喝口水消消气，我在想办法',
      '你说得对，让我认真想一想',
      '嗯嗯，我在仔细想怎么回答你',
      '别生气了，我来帮你出出主意',
      '你说的我都听到了，我好好想想',
      '我在想呢，你先消消气',
    ],
    en: [
      "I understand how you feel, let me think...",
      "I get it, give me a moment to think...",
      "I hear you, let me figure this out...",
      "Take it easy, I'm thinking of a way to help...",
      "That makes sense, let me think about it...",
      "I totally understand, give me a second...",
      "I'm on it, just need a moment to think...",
      "I hear your frustration, let me think...",
      "Let me think about how to help with this...",
      "I understand, let me come up with something...",
      "You've got a point, let me think it through...",
      "I'm thinking of the best way to help...",
    ],
  },
  {
    // 3. 累/怕类
    pattern: /累|疲|困|害怕|怕|tired|exhausted|scared|afraid|sleepy/i,
    zh: [
      '辛苦了，让我想想怎么帮你...',
      '别怕，有我在呢，我想一下',
      '你先歇歇，让我帮你想想办法...',
      '我在想办法呢，你先放松一下',
      '嗯嗯，我在认真想怎么帮你...',
      '不用怕，我陪着你呢',
      '你先休息一下，我来想办法',
      '放轻松，我在帮你想呢',
      '嗯，我在努力想怎么让你好受一点',
      '别担心，让我帮你好好想想',
      '你辛苦了，我在认真想呢',
      '有我在呢，你不用害怕',
    ],
    en: [
      "You've been working hard, let me think...",
      "Don't worry, I'm here, let me think...",
      "Take a rest, I'll figure something out...",
      "Relax for a bit, I'm thinking...",
      "I'm here with you, no need to worry...",
      "Take it easy, I'm working on it...",
      "Don't be scared, let me think about this...",
      "Just relax, I'm coming up with something...",
      "You deserve a break, let me think...",
      "I'm right here, let me figure this out...",
      "No worries, I'm thinking of a way to help...",
      "I've got you, just give me a moment...",
    ],
  },
  {
    // 4. 故事类
    pattern: /故事|story|stories|tale/i,
    zh: [
      '让我好好想一个故事...',
      '嗯，我在想一个好听的故事呢',
      '让我想想讲什么好...',
      '我在脑子里翻故事书呢，等等我',
      '故事嘛，得好好想一个才行...',
      '我在挑一个最精彩的故事',
      '嗯嗯，让我想一个特别有趣的',
      '我翻翻我的故事宝箱...',
      '好嘞，让我想一个你没听过的',
      '我在构思一个好玩的故事呢',
      '让我给你编一个独一无二的故事',
      '我正在想一个超级棒的故事',
    ],
    en: [
      "Let me think of a good story...",
      "Hmm, I'm picking the perfect story...",
      "Let me look through my storybook...",
      "Give me a moment to find a great one...",
      "I'm thinking of something really fun...",
      "Let me come up with a special story...",
      "I'm flipping through my story collection...",
      "Ooh, let me think of one you'll love...",
      "I'm crafting a unique story for you...",
      "Let me find the most exciting one...",
      "I'm brainstorming a really cool story...",
      "Hold on, I'm picking a great adventure...",
    ],
  },
  {
    // 5. 唱歌/音乐类
    pattern: /唱|歌|音乐|播放|儿歌|sing|song|music|play/i,
    zh: [
      '让我想想唱什么好...',
      '嗯，我在选歌呢，等我一下',
      '我清清嗓子，想想唱什么...',
      '让我找一首好听的...',
      '好嘞，让我想想唱哪首',
      '我在挑选一首最适合你的歌',
      '嗯嗯，让我回忆一首好听的旋律',
      '让我先热热嗓子...',
      '我在翻我的歌单呢',
      '好的，让我想一首你会喜欢的',
      '嗯，我在想一首特别好听的歌',
      '让我找一首应景的歌...',
    ],
    en: [
      "Let me think of a good song...",
      "Hmm, I'm picking a song, hold on...",
      "Let me clear my throat first...",
      "I'm looking for the perfect song...",
      "Give me a moment to find a great tune...",
      "I'm browsing my playlist...",
      "Let me think of one you'll enjoy...",
      "I'm warming up my voice...",
      "Let me find something catchy...",
      "Hmm, what song would be perfect...",
      "I'm searching for just the right melody...",
      "Let me pick a song that fits the mood...",
    ],
  },
  {
    // 6. 笑话类
    pattern: /笑话|joke|搞笑|好笑|funny|hilarious/i,
    zh: [
      '让我想一个好笑的...',
      '嗯，我在想笑话呢，先憋住',
      '好嘞，让我想一个逗你乐的...',
      '笑话嘛，得想一个真正好笑的才行...',
      '让我翻翻我的笑话本...',
      '我在搜索我的笑话库呢',
      '嗯嗯，我在想一个能让你笑出声的',
      '好的，让我挑一个最逗的',
      '我要想一个让你哈哈大笑的',
      '让我酝酿一个绝妙的笑话',
      '我在筛选最好笑的那个呢',
      '嗯，好笑话得好好想想才行',
    ],
    en: [
      "Let me think of a good one...",
      "Hmm, I'm looking through my joke book...",
      "Hold on, this is gonna be funny...",
      "Let me find one that'll make you laugh...",
      "I'm searching for the funniest joke...",
      "Give me a sec, I want it to be really good...",
      "I'm picking the perfect joke...",
      "Okay, let me think of a real knee-slapper...",
      "I'm digging through my comedy collection...",
      "Let me come up with something hilarious...",
      "Hold tight, I'm crafting the perfect joke...",
      "A good joke takes a moment to prepare...",
    ],
  },
  {
    // 7. 知识/古诗类
    pattern: /为什么|怎么|什么是|古诗|诗|背|why|how|what is|what are|explain/i,
    zh: [
      '好问题，让我好好想想...',
      '嗯，这个问题我得想一下',
      '让我仔细想想怎么跟你解释...',
      '这个嘛，让我想一想...',
      '嗯，让我好好想想这个',
      '有意思的问题，让我理理思路',
      '嗯嗯，我在脑子里搜索答案呢',
      '让我认真想想怎么回答你',
      '这个问题很好，我得好好想一下',
      '嗯，让我把这个问题想清楚',
      '我在整理思路呢，等等我',
      '让我想想怎么说你最容易明白',
    ],
    en: [
      "Great question, let me think...",
      "Hmm, let me think about that...",
      "Let me figure out how to explain this...",
      "That's interesting, give me a moment...",
      "Let me think this through carefully...",
      "I'm searching for the best answer...",
      "Good question, let me gather my thoughts...",
      "Let me think about how to put this...",
      "I'm working through this in my head...",
      "Let me organize my thoughts on this...",
      "That's a really good question, hold on...",
      "Let me think of the clearest way to explain...",
    ],
  },
  {
    // 8. 继续/追问类
    pattern: /继续|接着|然后呢|后来|下一个|continue|go on|what next|then what|next/i,
    zh: [
      '让我接着往下想...',
      '嗯，后面的我得好好想想',
      '让我理理思路...',
      '好嘞，让我想想后面怎么接',
      '我在想呢，等一下',
      '嗯嗯，我在想接下来的部分',
      '让我把后面的内容想好',
      '好的，让我把故事往下编',
      '我在构思后面的情节呢',
      '嗯，后面的更精彩，让我想想',
      '让我想想后面该怎么说',
      '我在整理后面的内容呢',
    ],
    en: [
      "Let me think about what comes next...",
      "Hmm, let me continue from here...",
      "Give me a moment to think ahead...",
      "I'm working on the next part...",
      "Let me figure out how to continue...",
      "Hold on, I'm thinking about what's next...",
      "The next part needs some thought...",
      "I'm putting together what comes after...",
      "Let me think about how to go on...",
      "I'm working on the continuation...",
      "Let me pick up where we left off...",
      "I'm thinking about the next bit...",
    ],
  },
  {
    // 9. 打招呼/呼唤类
    pattern: /你好|嗨|hello|hi\b|hey|哈喽/i,
    zh: [
      '来啦，让我想想说什么...',
      '嘿，你来啦，让我想想...',
      '我在呢，让我想想跟你说什么好',
      '哎，来了，给我一点时间想想',
      '哈，你来啦，让我想一下...',
      '嗨，我在呢，等我一下',
      '你好呀，让我想想怎么回你',
      '来了来了，让我准备一下',
      '嗯嗯，我在呢，稍等',
      '嘿嘿，你来啦，让我想想说点什么',
      '你好，让我想想今天聊什么',
      '哈喽，等我想想该说什么',
    ],
    en: [
      "Hey there! Let me think of something...",
      "Hi! Give me a moment...",
      "Hello! Let me think about what to say...",
      "Hey! I'm here, just a sec...",
      "Hi there! Let me gather my thoughts...",
      "Hello! Let me think of something fun...",
      "Hey! Hold on, let me think...",
      "Hi! Let me figure out what to chat about...",
      "Hello there! Give me just a moment...",
      "Hey hey! Let me think...",
      "Hi! Let me come up with something good...",
      "Hello! Let me think about today's topic...",
    ],
  },
  {
    // 10. 告别/睡觉类
    pattern: /关机|睡|拜拜|再见|bye|晚安|goodbye|goodnight|good night|see you|sleep/i,
    zh: ['好嘞~', '嗯嗯~', '好的~', '哦~', '嗯~'],
    en: ['Alright~', 'Okay~', 'Sure~', 'Bye bye~', 'See you~'],
  },
  {
    // 11. 配网/技术类
    pattern: /网络|配网|wifi|蓝牙|连接|network|bluetooth|connect/i,
    zh: [
      '让我想想怎么帮你...',
      '嗯，这个我得想一下',
      '让我看看怎么办...',
      '我在想呢，等一下',
      '嗯，给我一点时间想想',
      '让我理理思路，帮你想办法',
      '嗯嗯，我在想解决方案呢',
      '好的，让我帮你看看',
      '我在想怎么处理这个问题',
      '让我帮你查查看怎么弄',
      '嗯，这个问题我来帮你想想',
      '我在想最好的解决办法',
    ],
    en: [
      "Let me think about how to help...",
      "Hmm, let me figure this out...",
      "Let me see what I can do...",
      "I'm thinking, hold on...",
      "Give me a moment to think...",
      "Let me work through this...",
      "I'm looking for a solution...",
      "Let me help you figure this out...",
      "I'm thinking about the best approach...",
      "Let me check on that for you...",
      "I'm working on a solution...",
      "Let me think of the best way to fix this...",
    ],
  },
  {
    // 12. 查询类
    pattern: /天气|新闻|时间|几点|日期|查|搜|weather|news|time|date|search|look up/i,
    zh: [
      '我去帮你查一查...',
      '好的，我来查一下',
      '稍等，我帮你看看',
      '我去查一下，等我一秒',
      '让我来查查看',
      '嗯，我帮你找找看',
      '好嘞，我来帮你查',
      '让我帮你搜一下',
      '我在查呢，等一下',
      '嗯嗯，我来帮你看看',
      '让我找找最新的信息',
      '好的，我帮你搜索一下',
    ],
    en: [
      "Let me look that up for you...",
      "I'm checking on that, one sec...",
      "Hold on, let me find out...",
      "Let me search for that...",
      "I'm looking into it...",
      "Give me a moment to check...",
      "Let me find the latest info...",
      "I'm on it, let me look...",
      "Let me check that for you...",
      "Hold on, I'm searching...",
      "Let me dig up that information...",
      "I'm looking it up right now...",
    ],
  },
]

const DEFAULT_ZH = [
  '让我想一想...',
  '嗯嗯，让我想想怎么回答你',
  '好嘞，我想一下',
  '嗯，给我一点时间想想',
  '让我好好想想...',
  '我在认真想呢，等等我',
  '嗯嗯，让我理理思路',
  '好的，让我想一下怎么说',
  '我在想呢，稍等一下',
  '嗯，让我好好组织一下语言',
  '让我仔细想想...',
  '我在思考怎么回答你呢',
]

const DEFAULT_EN = [
  "Let me think about that...",
  "Hmm, give me a moment...",
  "Let me think for a sec...",
  "Hold on, I'm thinking...",
  "Let me figure this out...",
  "I'm thinking, just a moment...",
  "Let me gather my thoughts...",
  "Give me a second to think...",
  "I'm working on it...",
  "Let me think about how to answer...",
  "One moment, let me think...",
  "I'm putting my thoughts together...",
]

/**
 * Detects whether the input text is primarily English.
 * Uses a simple heuristic: if the majority of alphabetic characters are
 * Latin letters (a-z), the text is considered English.
 */
function isEnglish(text: string): boolean {
  const latin = text.match(/[a-zA-Z]/g)
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)
  const latinCount = latin?.length ?? 0
  const cjkCount = cjk?.length ?? 0
  if (latinCount === 0 && cjkCount === 0) return false
  return latinCount > cjkCount
}

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
 * Automatically selects English or Chinese candidates based on input.
 *
 * Usage:
 *   const picker = createSoothingPicker(text)
 *   picker() // first reply (no repeat)
 *   picker() // second reply (different from first)
 */
export function createSoothingPicker(text?: string): () => string {
  const en = text ? isEnglish(text) : false
  let candidates: string[] | undefined
  if (text) {
    for (const rule of INTENT_RULES) {
      if (rule.pattern.test(text)) {
        candidates = en ? rule.en : rule.zh
        break
      }
    }
  }
  const pool = candidates ?? (en ? DEFAULT_EN : DEFAULT_ZH)

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

/** Exported for testing */
export { isEnglish as _isEnglish }
