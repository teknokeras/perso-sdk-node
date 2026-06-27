# @teknokeras/perso-sdk

Node.js SDK for [perso](https://github.com/teknokeras/perso) — an embedded WebAssembly ABAC policy engine for MCP tool calls, with no control plane and no network call in the decision path.

Wraps the raw WASM ABI (`alloc`/`dealloc`/`init`/`evaluate`) behind a clean async API and adds structured audit logging with pluggable transports. The engine and policy load directly into your own Node process — `perso.evaluate()` is a function call, not a request to any service.

## Install

```bash
npm install @teknokeras/perso-sdk
```

There's nothing else to install or sign up for. No account, no API key for perso itself, no service to point this at. You need a compiled `perso.wasm` binary and a policy JSON file — both produced by the [core perso repo](https://github.com/teknokeras/perso) — and that's the whole dependency surface.

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

Loads the perso WASM engine and initialises it with a policy. Returns a `Perso` instance. Both the engine and the policy live in your process's memory after this call — there's no handshake with an external service.

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

Evaluates a tool call against the loaded policy. Emits an audit event automatically. The decision itself is computed in-process — the only thing that leaves the process is the audit event, and only if you've configured a transport for it.

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

Hot-reloads the policy without restarting the host. Accepts a file path or raw JSON string. No coordination with any external service — the new policy is loaded straight into the running WASM instance.

```typescript
perso.reload('path/to/updated-policy.json')
```

### `perso.policyVersion`

Returns the `version` field from the currently loaded policy.

```typescript
console.log(perso.policyVersion) // e.g. "perso-1.0.0"
```

## Transports

perso has no built-in audit platform — it deliberately doesn't ship a dashboard, a hosted log store, or any default destination for audit events. That's a decision, not a gap: wiring storage/observability to your own stack is the host's job, same as everything else in this SDK's design. The transports below are just shaped interfaces for plugging audit events into whatever you already use.

| Transport | Description |
|---|---|
| `consoleTransport()` | JSON to stdout — useful in development |
| `httpTransport(url, options?)` | POST events to any HTTP endpoint you control |
| `fileTransport(path)` | Append newline-delimited JSON to a file |

No transport is configured by default — audit events are silently dropped unless you explicitly pass one.

### `httpTransport` — forwarding to your own logging/observability stack

`httpTransport` just POSTs the `AuditEvent` JSON to a URL you provide. It's a generic forwarder, not a connection to a perso-operated service — point it at your own log ingestion endpoint, SIEM, or observability platform.

```typescript
import { Perso, httpTransport } from '@teknokeras/perso-sdk'

const perso = await Perso.load('perso.wasm', {
  policy: 'policy.json',
  audit: {
    transport: httpTransport('https://logs.your-company.example/events', {
      headers: { Authorization: `Bearer ${process.env.YOUR_LOGGING_API_KEY}` },
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

## Development

Install dependencies:

```bash
pnpm install
```

Run the unit tests (no `.wasm` binary required):

```bash
pnpm test
```

Watch mode during development:

```bash
pnpm test:watch
```

Run integration tests against a real WASM binary:

```bash
PERSO_WASM=path/to/perso.wasm pnpm test:wasm
```

Build the TypeScript sources:

```bash
pnpm build
```

## Requirements

- Node.js 18+
- A compiled `perso.wasm` binary — see [teknokeras/perso](https://github.com/teknokeras/perso) for build instructions

## License

MIT