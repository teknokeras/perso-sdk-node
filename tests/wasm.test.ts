import { describe, it, expect, beforeAll } from 'vitest'
import { WasmBridge } from '../src/wasm.js'
import { existsSync, readFileSync } from 'fs'

const WASM_PATH = process.env.PERSO_WASM ?? ''
const POLICY_PATH = process.env.PERSO_POLICY ?? ''

const shouldRun = WASM_PATH && existsSync(WASM_PATH)
  && POLICY_PATH && existsSync(POLICY_PATH)

describe.skipIf(!shouldRun)('WasmBridge', () => {
  let bridge: WasmBridge
  let policyJson: string

  beforeAll(async () => {
    // Step 1 — load the engine binary (no policy baked in)
    bridge = await WasmBridge.load(WASM_PATH)
    // Step 2 — read the policy JSON from disk
    policyJson = readFileSync(POLICY_PATH, 'utf8')
    // Step 3 — initialise the engine with the policy
    bridge.init(policyJson)
  })

  // ── init ────────────────────────────────────────────────────────────────────

  it('stores policyVersion after init()', () => {
    expect(typeof bridge.policyVersion).toBe('string')
    expect(bridge.policyVersion.length).toBeGreaterThan(0)
  })

  it('throws on invalid policy JSON', async () => {
    const fresh = await WasmBridge.load(WASM_PATH)
    expect(() => fresh.init('not valid json')).toThrow()
  })

  // ── evaluate — Allow paths ──────────────────────────────────────────────────

  it('allows viewer to call read_file', () => {
    const result = bridge.evaluate(
      'read_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'viewer', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Allow')
  })

  it('allows admin to call read_file', () => {
    const result = bridge.evaluate(
      'read_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'admin', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Allow')
  })

  // ── evaluate — Deny paths ───────────────────────────────────────────────────

  it('denies viewer calling delete_file', () => {
    const result = bridge.evaluate(
      'delete_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'viewer', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Deny')
  })

  it('denies unknown tool (default Deny)', () => {
    const result = bridge.evaluate(
      'unknown_tool',
      JSON.stringify({}),
      JSON.stringify({ role: 'admin', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Deny')
  })

  // ── response shape ──────────────────────────────────────────────────────────

  it('always returns decision and reason fields', () => {
    const result = bridge.evaluate(
      'read_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'viewer', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result).toHaveProperty('decision')
    expect(result).toHaveProperty('reason')
    expect(typeof result.reason).toBe('string')
  })

  // ── hot reload ──────────────────────────────────────────────────────────────

  it('hot-reloads policy via a second init() call', () => {
    // Reload with the same policy — just verifying init() can be called again
    bridge.init(policyJson)
    expect(typeof bridge.policyVersion).toBe('string')
  })
})