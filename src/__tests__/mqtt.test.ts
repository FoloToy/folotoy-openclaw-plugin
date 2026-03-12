import { describe, it, expect } from 'vitest'
import { buildTopic } from '../mqtt.js'

describe('buildTopic', () => {
  it('builds the correct topic for a given SN', () => {
    expect(buildTopic('SN001')).toBe('/openapi/folotoy/SN001/thing/data/post')
  })
})
