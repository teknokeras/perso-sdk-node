import { readFileSync } from 'fs'
import type { Decision } from './types.js'

interface WasmExports {
  alloc: (len: number) => number
  dealloc: (ptr: number, len: number) => void
  init: (ptr: number, len: number) => number
  evaluate: (
    tPtr: number, tLen: number,
    aPtr: number, aLen: number,
    cPtr: number, cLen: number,
  ) => number
  memory: WebAssembly.Memory
}

export class WasmBridge {
  private exports: WasmExports
  policyVersion: string = 'unknown'

  private constructor(exports: WasmExports) {
    this.exports = exports
  }

  static async load(wasmPath: string): Promise<WasmBridge> {
    const bytes = readFileSync(wasmPath)
    const { instance } = await WebAssembly.instantiate(bytes)
    return new WasmBridge(instance.exports as unknown as WasmExports)
  }

  init(policyJson: string): void {
    // Parse version on the SDK side — no need to touch Rust
    const parsed = JSON.parse(policyJson) as Record<string, unknown>
    this.policyVersion = typeof parsed['version'] === 'string'
      ? parsed['version']
      : 'unknown'

    const [ptr, len] = this.writeString(policyJson)
    const respPtr = this.exports.init(ptr, len)
    const resp = this.readResponse(respPtr)
    if (!resp['ok']) {
      throw new Error(`perso init failed: ${resp['error'] ?? 'unknown error'}`)
    }
  }

  evaluate(
    tool: string,
    argsJson: string,
    contextJson: string,
  ): Decision {
    const [tPtr, tLen] = this.writeString(tool)
    const [aPtr, aLen] = this.writeString(argsJson)
    const [cPtr, cLen] = this.writeString(contextJson)
    const respPtr = this.exports.evaluate(tPtr, tLen, aPtr, aLen, cPtr, cLen)
    return this.readResponse(respPtr) as unknown as Decision
  }

  private writeString(str: string): [number, number] {
    const bytes = new TextEncoder().encode(str)
    const ptr = this.exports.alloc(bytes.length)
    new Uint8Array(this.exports.memory.buffer, ptr, bytes.length).set(bytes)
    return [ptr, bytes.length]
  }

  private readResponse(ptr: number): Record<string, unknown> {
    const view = new DataView(this.exports.memory.buffer)
    const len = view.getUint32(ptr, true)
    const body = new Uint8Array(this.exports.memory.buffer, ptr + 4, len)
    const result = JSON.parse(new TextDecoder().decode(body))
    this.exports.dealloc(ptr, 4 + len)
    return result
  }
}