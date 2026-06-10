# perso-sdk

Node.js SDK for [perso](https://github.com/teknokeras/perso) — a WebAssembly policy enforcement engine for MCP tool calls.

Wraps the raw WASM ABI (`alloc`/`dealloc`/`init`/`evaluate`) behind a clean async API and adds structured audit logging with pluggable transports.

## Install

```bash
npm install perso-sdk
```

## Quick start

```typescript
import { Perso, consoleTransport } from 'perso-sdk'

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

## Transports

| Transport | Description |
|---|---|
| `consoleTransport()` | JSON to stdout — default in development |
| `httpTransport(url, options?)` | POST events to any endpoint |
| `fileTransport(path)` | Append newline-delimited JSON to a file |

## License

MIT
