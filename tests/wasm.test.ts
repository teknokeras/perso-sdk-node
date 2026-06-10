import { describe, it, expect, beforeAll } from 'vitest'
import { WasmBridge } from '../src/wasm.js'
import { existsSync } from 'fs'

const WASM_PATH = process.env.PERSO_WASM ?? ''

describe.skipIf(!WASM_PATH || !existsSync(WASM_PATH))('WasmBridge', () => {
  let bridge: WasmBridge

  beforeAll(async () => {
    bridge = await WasmBridge.load(WASM_PATH)
  })

  it('initialises with a valid policy', () => {
    const policy = JSON.stringify({
      version: 'perso-1.0.0',
      default_action: 'Deny',
      tools: ['read_file'],
      rules: [{ tool_name: 'read_file', roles: ['viewer'], condition: null }],
    })
    expect(() => bridge.init(policy)).not.toThrow()
  })

  it('allows a matching tool call', () => {
    const result = bridge.evaluate(
      'read_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'viewer', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Allow')
  })

  it('denies a non-matching tool call', () => {
    const result = bridge.evaluate(
      'delete_file',
      JSON.stringify({}),
      JSON.stringify({ role: 'viewer', agent_attrs: {}, resource_attrs: {} }),
    )
    expect(result.decision).toBe('Deny')
  })
})
