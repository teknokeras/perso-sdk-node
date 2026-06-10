import { appendFile } from 'fs/promises'
import type { AuditTransport } from '../types.js'

export function fileTransport(path: string): AuditTransport {
  return {
    async emit(event) {
      await appendFile(path, JSON.stringify(event) + '\n', 'utf8')
    },
  }
}
