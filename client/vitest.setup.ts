import { beforeEach } from 'vitest'

/* jsdom 28 在当前 vitest 环境下提供的 localStorage/sessionStorage 缺少实例方法
   （getItem 等为 undefined），这里以内存实现覆盖，并在每个用例前清空以隔离。 */
class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function install(name: 'localStorage' | 'sessionStorage'): void {
  const value = new MemoryStorage() as unknown as Storage
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  const win = (globalThis as typeof globalThis & { window?: object }).window
  if (win && win !== globalThis) {
    Object.defineProperty(win, name, { value, configurable: true, writable: true })
  }
}

install('localStorage')
install('sessionStorage')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
