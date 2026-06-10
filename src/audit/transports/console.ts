import type { AuditTransport } from '../types.js'

export function consoleTransport(): AuditTransport {
  return {
    async emit(event) {
      console.log(JSON.stringify(event))
    },
  }
}
