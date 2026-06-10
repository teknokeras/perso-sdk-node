import { describe, it, expect, vi } from 'vitest'
import { fileTransport } from '../../src/audit/transports/file.js'
import type { AuditEvent } from '../../src/audit/types.js'

vi.mock('fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
}))

import { appendFile } from 'fs/promises'

const mockEvent: AuditEvent = {
  id: 'evt-uuid-123',
  traceId: 'trace-123',
  timestamp: '2024-01-01T00:00:00.000Z',
  tool: 'read_file',
  role: 'viewer',
  args: {},
  agentAttributes: {},
  resourceAttributes: {},
  decision: 'Allow',
  reason: 'rule matched',
  sdkVersion: '0.1.0',
  policyVersion: 'perso-1.0.0',
}

describe('fileTransport', () => {
  it('appends a newline-delimited JSON line to the file', async () => {
    const transport = fileTransport('/tmp/audit.log')
    await transport.emit(mockEvent)

    expect(appendFile).toHaveBeenCalledWith(
      '/tmp/audit.log',
      JSON.stringify(mockEvent) + '\n',
      'utf8',
    )
  })
})