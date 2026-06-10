import type { AuditTransport } from './audit/types.js'

export interface EvaluateInput {
  tool: string
  args: Record<string, unknown>
  role: string
  agentAttributes?: Record<string, unknown>
  resourceAttributes?: Record<string, unknown>
  traceId?: string
}

export interface Decision {
  decision: 'Allow' | 'Deny'
  reason: string
}

export interface AuditOptions {
  transport?: AuditTransport
  /** Replace args with a SHA-256 hash — useful when args contain PII */
  hashArgs?: boolean
  /** Disable audit entirely */
  enabled?: boolean
}

export interface PersoOptions {
  /** Path to policy JSON file, or a raw JSON string */
  policy: string
  audit?: AuditOptions
}