import { describe, it, expect, vi } from 'vitest'
import { consoleTransport } from '../../src/audit/transports/console.js'
import type { AuditEvent } from '../../src/audit/types.js'

const mockEvent: AuditEvent = {
  timestamp: '2024-01-01T00:00:00.000Z',
  traceId: 'trace-123',
  tool: 'read_file',
  role: 'viewer',
  args: { path: '/etc/config.json' },
  agentAttributes: {},
  resourceAttributes: {},
  decision: 'Allow',
  reason: 'rule matched',
  sdkVersion: '0.1.0',
}

describe('consoleTransport', () => {
  it('writes a JSON line to stdout', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const transport = consoleTransport()
    await transport.emit(mockEvent)
    expect(spy).toHaveBeenCalledWith(JSON.stringify(mockEvent))
    spy.mockRestore()
  })
})
