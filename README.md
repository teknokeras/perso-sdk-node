# @teknokeras/perso-sdk

Node.js SDK for [perso](https://github.com/teknokeras/perso) — a WebAssembly policy enforcement engine for MCP tool calls.

Wraps the raw WASM ABI (`alloc`/`dealloc`/`init`/`evaluate`) behind a clean async API and adds structured audit logging with pluggable transports.

## Install

```bash
npm install @teknokeras/perso-sdk
```

## Quick start

```typescript
import { Perso, consoleTransport } from '@teknokeras/perso-sdk'

const perso = await Perso.load('path/to/perso.wasm', {
  policy: 'path/to/policy.json',
  audit: {
    transport: consoleTransport(),
  },
})

const decision = await perso.evaluate({
  tool: 'delete_file',
  args: { path: '/etc/passwd' },
  role: 'viewer',
  traceId: 'req-abc-123',
})

console.log(decision)
// { decision: 'Deny', reason: '...' }
```

## API

### `Perso.load(wasmPath, options)`

Loads the perso WASM engine and initialises it with a policy. Returns a `Perso` instance.

```typescript
const perso = await Perso.load('path/to/perso.wasm', {
  policy: 'path/to/policy.json', // file path or raw JSON string
  audit: {
    transport: consoleTransport(), // where to send audit events
    hashArgs: false,               // set true to SHA-256 hash args (PII protection)
    enabled: true,                 // set false to disable audit entirely
  },
})
```

### `perso.evaluate(input)`

Evaluates a tool call against the loaded policy. Emits an audit event automatically.

```typescript
const decision = await perso.evaluate({
  tool: 'delete_file',
  args: { path: '/etc/passwd' },
  role: 'viewer',
  agentAttributes: { user_id: 'u-123', mfa_verified: true },
  resourceAttributes: { owner_id: 'u-456' },
  traceId: 'req-abc-123', // optional — auto-generated if omitted
})
// { decision: 'Deny', reason: '...' }
```

### `perso.reload(policyJsonOrPath)`

Hot-reloads the policy without restarting the host. Accepts a file path or raw JSON string.

```typescript
perso.reload('path/to/updated-policy.json')
```

### `perso.policyVersion`

Returns the `version` field from the currently loaded policy.

```typescript
console.log(perso.policyVersion) // e.g. "perso-1.0.0"
```

## Transports

| Transport | Description |
|---|---|
| `consoleTransport()` | JSON to stdout — useful in development |
| `httpTransport(url, options?)` | POST events to any endpoint |
| `fileTransport(path)` | Append newline-delimited JSON to a file |

No transport is configured by default — audit events are silently dropped unless you explicitly pass one.

### `httpTransport` — connecting to a managed service

```typescript
import { Perso, httpTransport } from '@teknokeras/perso-sdk'

const perso = await Perso.load('perso.wasm', {
  policy: 'policy.json',
  audit: {
    transport: httpTransport('https://ingest.perso.dev/v1/events', {
      headers: { Authorization: `Bearer ${process.env.PERSO_API_KEY}` },
      timeoutMs: 5000,
    }),
  },
})
```

### Custom transport

Any object implementing `{ emit(event: AuditEvent): Promise<void> }` works as a transport:

```typescript
const myTransport = {
  async emit(event) {
    await db.insert('audit_events', event)
  }
}
```

## AuditEvent schema

Every evaluation emits a structured event:

```typescript
interface AuditEvent {
  id: string                                  // UUID per event
  traceId: string                             // correlates decisions across an agent run
  timestamp: string                           // ISO 8601 UTC
  tool: string                                // tool name
  args: Record<string, unknown> | string      // raw args, or SHA-256 hex if hashArgs=true
  role: string                                // caller role
  agentAttributes: Record<string, unknown>    // session data
  resourceAttributes: Record<string, unknown> // resource data
  decision: 'Allow' | 'Deny'
  reason: string                              // human-readable string from perso WASM
  sdkVersion: string                          // e.g. "0.1.0"
  policyVersion: string                       // e.g. "perso-1.0.0"
}
```

## Requirements

- Node.js 18+
- A compiled `perso.wasm` binary — see [teknokeras/perso](https://github.com/teknokeras/perso) for build instructions

## License

MIT