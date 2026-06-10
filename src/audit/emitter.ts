import { createHash, randomUUID } from 'crypto'
import { VERSION } from '../version.js'
import type { AuditEvent, AuditTransport } from './types.js'
import type { EvaluateInput, Decision } from '../types.js'

interface EmitInput {
  input: EvaluateInput & { traceId: string }
  decision: Decision
  policyVersion: string
}

export class AuditEmitter {
  private transport: AuditTransport | null
  private hashArgs: boolean

  constructor(transport: AuditTransport | null, hashArgs: boolean) {
    this.transport = transport
    this.hashArgs = hashArgs
  }

  async emit({ input, decision, policyVersion }: EmitInput): Promise<void> {
    if (!this.transport) return

    const event: AuditEvent = {
      id: randomUUID(),
      traceId: input.traceId,
      timestamp: new Date().toISOString(),
      tool: input.tool,
      args: this.hashArgs
        ? createHash('sha256').update(JSON.stringify(input.args)).digest('hex')
        : input.args,
      role: input.role,
      agentAttributes: input.agentAttributes ?? {},
      resourceAttributes: input.resourceAttributes ?? {},
      decision: decision.decision,
      reason: decision.reason,
      sdkVersion: VERSION,
      policyVersion,
    }

    try {
      await this.transport.emit(event)
    } catch (err) {
      // Audit failure must never block the policy decision
      console.warn('[perso-sdk] audit transport error:', err)
    }
  }
}