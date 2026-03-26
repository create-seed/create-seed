import { existsSync, readFileSync } from 'node:fs'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readPackageJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) {
    return undefined
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
