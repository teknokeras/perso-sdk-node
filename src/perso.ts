import { existsSync, readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { WasmBridge } from './wasm.js'
import { AuditEmitter } from './audit/emitter.js'
import { consoleTransport } from './audit/transports/console.js'
import type { EvaluateInput, Decision, PersoOptions } from './types.js'

export class Perso {
  private wasm: WasmBridge
  private emitter: AuditEmitter

  private constructor(wasm: WasmBridge, emitter: AuditEmitter) {
    this.wasm = wasm
    this.emitter = emitter
  }

  /**
   * Load the perso WASM engine and initialise it with a policy.
   *
   * @param wasmPath - Path to the compiled perso.wasm binary
   * @param options  - Policy source and audit configuration
   */
  static async load(wasmPath: string, options: PersoOptions): Promise<Perso> {
    const wasm = await WasmBridge.load(wasmPath)

    const policyJson = existsSync(options.policy)
      ? readFileSync(options.policy, 'utf8')
      : options.policy

    wasm.init(policyJson)

    const auditEnabled = options.audit?.enabled ?? true
    const transport = options.audit?.transport ?? consoleTransport()
    const emitter = new AuditEmitter(
      auditEnabled ? transport : null,
      options.audit?.hashArgs ?? false,
    )

    return new Perso(wasm, emitter)
  }

  /**
   * Evaluate a tool call against the loaded policy.
   * An audit event is emitted automatically after every evaluation.
   */
  async evaluate(input: EvaluateInput): Promise<Decision> {
    const traceId = input.traceId ?? randomUUID()

    const contextJson = JSON.stringify({
      role: input.role,
      agent_attrs: input.agentAttributes ?? {},
      resource_attrs: input.resourceAttributes ?? {},
    })

    const decision = this.wasm.evaluate(
      input.tool,
      JSON.stringify(input.args),
      contextJson,
    )

    await this.emitter.emit({
      input: { ...input, traceId },
      decision,
    })

    return decision
  }

  /**
   * Hot-reload the policy without restarting the host.
   * Accepts a file path or a raw JSON string.
   */
  reload(policyJsonOrPath: string): void {
    const policyJson = existsSync(policyJsonOrPath)
      ? readFileSync(policyJsonOrPath, 'utf8')
      : policyJsonOrPath
    this.wasm.init(policyJson)
  }
}
