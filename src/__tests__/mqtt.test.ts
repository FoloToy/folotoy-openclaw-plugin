import { describe, it, expect } from 'vitest'
import { buildInboundTopic, buildOutboundTopic } from '../mqtt.js'

describe('buildInboundTopic', () => {
  it('builds the correct inbound topic for a given SN', () => {
    expect(buildInboundTopic('SN001')).toBe('/openapi/folotoy/SN001/thing/command/call')
  })
})

describe('buildOutboundTopic', () => {
  it('builds the correct outbound topic for a given SN', () => {
    expect(buildOutboundTopic('SN001')).toBe('/openapi/folotoy/SN001/thing/command/callAck')
  })
})
