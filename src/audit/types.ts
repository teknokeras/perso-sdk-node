export interface AuditEvent {
  timestamp: string
  traceId: string
  tool: string
  role: string
  /** Raw args object, or a SHA-256 hex string when hashArgs is enabled */
  args: Record<string, unknown> | string
  agentAttributes: Record<string, unknown>
  resourceAttributes: Record<string, unknown>
  decision: 'Allow' | 'Deny'
  reason: string
  sdkVersion: string
}

export interface AuditTransport {
  emit(event: AuditEvent): Promise<void>
}
