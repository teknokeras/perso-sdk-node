import type { AuditTransport } from '../types.js'

export interface HttpTransportOptions {
  headers?: Record<string, string>
  timeoutMs?: number
}

export function httpTransport(
  url: string,
  options: HttpTransportOptions = {},
): AuditTransport {
  return {
    async emit(event) {
      const controller = new AbortController()
      const timer = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 5000,
      )

      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
