import { describe, it, expect } from 'vitest'
import { pickSoothingReply, _isEnglish } from '../soothing.js'

const ZH_CATEGORIES = [
  { input: '我今天好难过', label: '难过类' },
  { input: '我很生气', label: '生气类' },
  { input: '我好累', label: '累/怕类' },
  { input: '给我讲个故事', label: '故事类' },
  { input: '唱首儿歌', label: '唱歌类' },
  { input: '讲个笑话', label: '笑话类' },
  { input: '为什么天是蓝的', label: '知识类' },
  { input: '然后呢', label: '继续类' },
  { input: '你好', label: '打招呼类' },
  { input: '晚安', label: '告别类' },
  { input: '帮我连接wifi', label: '配网类' },
  { input: '帮我查天气', label: '查询类' },
  { input: '随便说点什么', label: '兜底' },
]

const EN_CATEGORIES = [
  { input: "I'm feeling sad today", label: 'sad' },
  { input: "I'm so angry", label: 'angry' },
  { input: "I'm really tired", label: 'tired' },
  { input: 'Tell me a story', label: 'story' },
  { input: 'Sing me a song', label: 'sing' },
  { input: 'Tell me a joke', label: 'joke' },
  { input: 'Why is the sky blue', label: 'why' },
  { input: 'What happens next', label: 'continue' },
  { input: 'Hello there', label: 'greeting' },
  { input: 'Goodbye', label: 'farewell' },
  { input: 'Connect to wifi', label: 'network' },
  { input: 'Search the weather', label: 'search' },
  { input: 'Just say something', label: 'default' },
]

describe('pickSoothingReply — Chinese', () => {
  it.each(ZH_CATEGORIES)('$label — returns a non-empty string', ({ input }) => {
    const reply = pickSoothingReply(input)
    expect(typeof reply).toBe('string')
    expect(reply.length).toBeGreaterThan(0)
  })

  it.each(ZH_CATEGORIES)('$label — never contains 马上', ({ input }) => {
    for (let i = 0; i < 20; i++) {
      expect(pickSoothingReply(input)).not.toContain('马上')
    }
  })

  it('randomly selects from candidates (not always the same reply)', () => {
    const results = new Set(
      Array.from({ length: 50 }, () => pickSoothingReply('我今天好难过'))
    )
    expect(results.size).toBeGreaterThan(1)
  })

  it('告别类 returns only short affirmatives', () => {
    const allowed = new Set(['好嘞~', '嗯嗯~', '好的~', '哦~', '嗯~'])
    for (let i = 0; i < 20; i++) {
      expect(allowed.has(pickSoothingReply('晚安'))).toBe(true)
    }
  })
})

describe('pickSoothingReply — English', () => {
  it.each(EN_CATEGORIES)('$label — returns a non-empty English string', ({ input }) => {
    const reply = pickSoothingReply(input)
    expect(typeof reply).toBe('string')
    expect(reply.length).toBeGreaterThan(0)
    // Should contain Latin characters (English response)
    expect(reply).toMatch(/[a-zA-Z]/)
  })

  it('randomly selects from English candidates', () => {
    const results = new Set(
      Array.from({ length: 50 }, () => pickSoothingReply("I'm feeling sad today"))
    )
    expect(results.size).toBeGreaterThan(1)
  })

  it('farewell returns only short English affirmatives', () => {
    const allowed = new Set(['Alright~', 'Okay~', 'Sure~', 'Bye bye~', 'See you~'])
    for (let i = 0; i < 20; i++) {
      expect(allowed.has(pickSoothingReply('Goodbye'))).toBe(true)
    }
  })
})

describe('isEnglish', () => {
  it('detects Chinese text', () => {
    expect(_isEnglish('我今天好难过')).toBe(false)
    expect(_isEnglish('你好')).toBe(false)
    expect(_isEnglish('帮我查天气')).toBe(false)
  })

  it('detects English text', () => {
    expect(_isEnglish('Hello there')).toBe(true)
    expect(_isEnglish("I'm feeling sad")).toBe(true)
    expect(_isEnglish('Tell me a story')).toBe(true)
  })

  it('handles mixed text — majority wins', () => {
    expect(_isEnglish('帮我连接wifi')).toBe(false) // mostly Chinese
    expect(_isEnglish('Please help 谢谢')).toBe(true) // mostly English
  })

  it('returns false for empty or symbol-only text', () => {
    expect(_isEnglish('')).toBe(false)
    expect(_isEnglish('123!@#')).toBe(false)
  })
})
