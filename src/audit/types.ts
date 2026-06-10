export interface AuditEvent {
  // ── Identity ───────────────────────────────────────────────
  id: string             // UUID per event — for deduplication and direct lookup
  traceId: string        // caller-supplied or auto-generated — correlates all
  // decisions in a single agent run / request chain

  // ── Timing ────────────────────────────────────────────────
  timestamp: string      // ISO 8601 UTC — when evaluate() was called

  // ── What was called ───────────────────────────────────────
  tool: string           // tool name exactly as passed to evaluate()
  args: Record<string, unknown> | string  // raw args, or SHA-256 hex if hashArgs=true

  // ── Who called it ─────────────────────────────────────────
  role: string           // caller role
  agentAttributes: Record<string, unknown>   // session data (user_id, env, mfa, etc.)
  resourceAttributes: Record<string, unknown> // resource data (owner_id, etc.)

  // ── What perso decided ────────────────────────────────────
  decision: 'Allow' | 'Deny'
  reason: string         // human-readable string from perso WASM

  // ── SDK metadata ──────────────────────────────────────────
  sdkVersion: string     // semver string from package.json
  policyVersion: string  // value of policy.version field e.g. "perso-1.0.0"
}

export interface AuditTransport {
  emit(event: AuditEvent): Promise<void>
}
