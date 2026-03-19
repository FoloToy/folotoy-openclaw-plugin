import { describe, it, expect } from 'vitest'
import { pickSoothingReply } from '../soothing.js'

const CATEGORIES = [
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

describe('pickSoothingReply', () => {
  it.each(CATEGORIES)('$label — returns a non-empty string', ({ input }) => {
    const reply = pickSoothingReply(input)
    expect(typeof reply).toBe('string')
    expect(reply.length).toBeGreaterThan(0)
  })

  it.each(CATEGORIES)('$label — never contains 马上', ({ input }) => {
    // Run multiple times to cover random selection
    for (let i = 0; i < 20; i++) {
      expect(pickSoothingReply(input)).not.toContain('马上')
    }
  })

  it('randomly selects from candidates (not always the same reply)', () => {
    const results = new Set(
      Array.from({ length: 40 }, () => pickSoothingReply('我今天好难过'))
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
