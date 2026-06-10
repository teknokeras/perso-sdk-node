import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Perso } from '../src/perso.js'

vi.mock('../src/wasm.js', () => ({
  WasmBridge: {
    load: vi.fn().mockResolvedValue({
      init: vi.fn(),
      policyVersion: 'perso-1.0.0',
      evaluate: vi.fn().mockReturnValue({ decision: 'Allow', reason: 'mocked' }),
    }),
  },
}))

const MOCK_WASM = 'mock.wasm'
const MOCK_POLICY = JSON.stringify({
  version: 'perso-1.0.0',
  default_action: 'Deny',
  tools: ['read_file'],
  rules: [{ tool_name: 'read_file', roles: ['viewer'], condition: null }],
})

describe('Perso', () => {
  it('loads and returns a Perso instance', async () => {
    const perso = await Perso.load(MOCK_WASM, { policy: MOCK_POLICY })
    expect(perso).toBeInstanceOf(Perso)
  })

  it('evaluate() returns a decision', async () => {
    const perso = await Perso.load(MOCK_WASM, {
      policy: MOCK_POLICY,
      audit: { enabled: false },  // add this
    })
    const result = await perso.evaluate({ tool: 'read_file', args: {}, role: 'viewer' })
    expect(result.decision).toBe('Allow')
  })

  it('evaluate() emits an audit event via transport', async () => {
    const emitted: unknown[] = []
    const transport = { emit: vi.fn(async (e) => { emitted.push(e) }) }

    const perso = await Perso.load(MOCK_WASM, {
      policy: MOCK_POLICY,
      audit: { transport },
    })

    await perso.evaluate({ tool: 'read_file', args: {}, role: 'viewer' })
    expect(transport.emit).toHaveBeenCalledOnce()

    const event = emitted[0] as Record<string, unknown>
    expect(event.tool).toBe('read_file')
    expect(event.role).toBe('viewer')
    expect(event.decision).toBe('Allow')
    expect(event.policyVersion).toBe('perso-1.0.0')
    expect(typeof event.id).toBe('string')
  })

  it('evaluate() auto-generates a traceId when not supplied', async () => {
    const emitted: unknown[] = []
    const transport = { emit: vi.fn(async (e) => { emitted.push(e) }) }

    const perso = await Perso.load(MOCK_WASM, {
      policy: MOCK_POLICY,
      audit: { transport },
    })

    await perso.evaluate({ tool: 'read_file', args: {}, role: 'viewer' })
    const event = emitted[0] as Record<string, unknown>
    expect(typeof event.traceId).toBe('string')
    expect((event.traceId as string).length).toBeGreaterThan(0)
  })

  it('evaluate() hashes args when hashArgs is true', async () => {
    const emitted: unknown[] = []
    const transport = { emit: vi.fn(async (e) => { emitted.push(e) }) }

    const perso = await Perso.load(MOCK_WASM, {
      policy: MOCK_POLICY,
      audit: { transport, hashArgs: true },
    })

    await perso.evaluate({ tool: 'read_file', args: { path: '/secret' }, role: 'viewer' })
    const event = emitted[0] as Record<string, unknown>
    expect(typeof event.args).toBe('string')
    expect((event.args as string).length).toBe(64) // SHA-256 hex = 64 chars
  })
})