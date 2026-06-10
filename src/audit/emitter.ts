import { createHash } from 'crypto'
import { VERSION } from '../version.js'
import type { AuditEvent, AuditTransport } from './types.js'
import type { EvaluateInput, Decision } from '../types.js'

interface EmitInput {
  input: EvaluateInput & { traceId: string }
  decision: Decision
}

export class AuditEmitter {
  private transport: AuditTransport | null
  private hashArgs: boolean

  constructor(transport: AuditTransport | null, hashArgs: boolean) {
    this.transport = transport
    this.hashArgs = hashArgs
  }

  async emit({ input, decision }: EmitInput): Promise<void> {
    if (!this.transport) return

    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      traceId: input.traceId,
      tool: input.tool,
      role: input.role,
      args: this.hashArgs
        ? createHash('sha256').update(JSON.stringify(input.args)).digest('hex')
        : input.args,
      agentAttributes: input.agentAttributes ?? {},
      resourceAttributes: input.resourceAttributes ?? {},
      decision: decision.decision,
      reason: decision.reason,
      sdkVersion: VERSION,
    }

    try {
      await this.transport.emit(event)
    } catch (err) {
      // Audit failure must never block the policy decision
      console.warn('[perso-sdk] audit transport error:', err)
    }
  }
}
