import { describe, it, expect, vi, beforeEach } from 'vitest'
import { httpTransport } from '../../src/audit/transports/http.js'
import type { AuditEvent } from '../../src/audit/types.js'

const mockEvent: AuditEvent = {
  timestamp: '2024-01-01T00:00:00.000Z',
  traceId: 'trace-123',
  tool: 'read_file',
  role: 'viewer',
  args: {},
  agentAttributes: {},
  resourceAttributes: {},
  decision: 'Allow',
  reason: 'rule matched',
  sdkVersion: '0.1.0',
}

describe('httpTransport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  it('POSTs the event as JSON', async () => {
    const transport = httpTransport('https://example.com/events')
    await transport.emit(mockEvent)

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(mockEvent),
      }),
    )
  })

  it('merges custom headers', async () => {
    const transport = httpTransport('https://example.com/events', {
      headers: { Authorization: 'Bearer test-key' },
    })
    await transport.emit(mockEvent)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
  })
})
