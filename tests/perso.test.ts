import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { Perso } from '../src/perso.js'

// ── Unit tests (mocked WASM bridge) ──────────────────────────────────────────

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

describe('Perso (unit)', () => {
  it('loads and returns a Perso instance', async () => {
    const perso = await Perso.load(MOCK_WASM, { policy: MOCK_POLICY })
    expect(perso).toBeInstanceOf(Perso)
  })

  it('evaluate() returns a decision', async () => {
    const perso = await Perso.load(MOCK_WASM, {
      policy: MOCK_POLICY,
      audit: { enabled: false },
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

  it('exposes policyVersion getter', async () => {
    const perso = await Perso.load(MOCK_WASM, { policy: MOCK_POLICY })
    expect(perso.policyVersion).toBe('perso-1.0.0')
  })

  it('does not emit when no transport is configured', async () => {
    // Default — no transport, audit enabled — should not throw
    const perso = await Perso.load(MOCK_WASM, { policy: MOCK_POLICY })
    await expect(
      perso.evaluate({ tool: 'read_file', args: {}, role: 'viewer' })
    ).resolves.toBeDefined()
  })
})

// ── Integration tests (real WASM binary) ─────────────────────────────────────

const WASM_PATH = process.env.PERSO_WASM ?? ''
const POLICY_PATH = process.env.PERSO_POLICY ?? ''

const shouldRun = WASM_PATH && existsSync(WASM_PATH)
  && POLICY_PATH && existsSync(POLICY_PATH)

describe.skipIf(!shouldRun)('Perso (integration)', () => {
  it('loads with a policy file path', async () => {
    const perso = await Perso.load(WASM_PATH, { policy: POLICY_PATH })
    expect(perso).toBeInstanceOf(Perso)
    expect(typeof perso.policyVersion).toBe('string')
    expect(perso.policyVersion.length).toBeGreaterThan(0)
  })

  it('evaluate() returns Allow for a permitted tool + role', async () => {
    const perso = await Perso.load(WASM_PATH, {
      policy: POLICY_PATH,
      audit: { enabled: false },
    })
    const result = await perso.evaluate({
      tool: 'read_file',
      args: {},
      role: 'viewer',
    })
    expect(result.decision).toBe('Allow')
    expect(typeof result.reason).toBe('string')
  })

  it('evaluate() returns Deny for a blocked tool + role', async () => {
    const perso = await Perso.load(WASM_PATH, {
      policy: POLICY_PATH,
      audit: { enabled: false },
    })
    const result = await perso.evaluate({
      tool: 'delete_file',
      args: {},
      role: 'viewer',
    })
    expect(result.decision).toBe('Deny')
  })

  it('evaluate() emits a correctly shaped audit event', async () => {
    const emitted: unknown[] = []
    const transport = { emit: vi.fn(async (e) => { emitted.push(e) }) }

    const perso = await Perso.load(WASM_PATH, {
      policy: POLICY_PATH,
      audit: { transport },
    })

    await perso.evaluate({
      tool: 'read_file',
      args: { path: '/etc/config.json' },
      role: 'viewer',
      traceId: 'test-trace-001',
    })

    expect(transport.emit).toHaveBeenCalledOnce()
    const event = emitted[0] as Record<string, unknown>

    expect(typeof event.id).toBe('string')
    expect(event.traceId).toBe('test-trace-001')
    expect(event.tool).toBe('read_file')
    expect(event.role).toBe('viewer')
    expect(event.decision).toBe('Allow')
    expect(typeof event.reason).toBe('string')
    expect(typeof event.policyVersion).toBe('string')
    expect(typeof event.sdkVersion).toBe('string')
    expect(typeof event.timestamp).toBe('string')
  })

  it('reload() switches the active policy', async () => {
    const perso = await Perso.load(WASM_PATH, {
      policy: POLICY_PATH,
      audit: { enabled: false },
    })

    // Reload with a permissive policy
    perso.reload(JSON.stringify({
      version: 'perso-test-reload',
      default_action: 'Allow',
      tools: ['read_file'],
      rules: [],
    }))

    expect(perso.policyVersion).toBe('perso-test-reload')

    const result = await perso.evaluate({
      tool: 'anything',
      args: {},
      role: 'anyone',
    })
    expect(result.decision).toBe('Allow')

    // Restore original policy
    perso.reload(POLICY_PATH)
  })
})