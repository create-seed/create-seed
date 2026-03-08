import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', '.output', '.nuxt', '.turbo'])
const BINARY_DETECTION_CHUNK_SIZE = 8000
const BINARY_DETECTION_SUSPICIOUS_BYTE_THRESHOLD = 0.1

function isLikelyBinary(content: Buffer): boolean {
  if (content.length === 0) {
    return false
  }

  // To avoid poor performance on very large files, inspect only a prefix.
  const chunk = content.subarray(0, BINARY_DETECTION_CHUNK_SIZE)

  // Fast path: null bytes are a strong binary signal.
  if (chunk.includes(0)) {
    return true
  }

  // Heuristic: if too many control bytes are present, treat as binary.
  // Allow common text control chars: tab(9), lf(10), cr(13).
  let suspiciousByteCount = 0
  for (const byte of chunk) {
    const isAllowedControl = byte === 9 || byte === 10 || byte === 13
    const isControl = byte < 32 && !isAllowedControl

    if (isControl) {
      suspiciousByteCount += 1
    }
  }

  return suspiciousByteCount / chunk.length > BINARY_DETECTION_SUSPICIOUS_BYTE_THRESHOLD
}

async function walkFiles(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map(async (dirent) => {
      if (IGNORE_DIRS.has(dirent.name)) {
        return []
      }
      const fullPath = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        return walkFiles(fullPath)
      }
      if (dirent.isFile()) {
        return [fullPath]
      }
      return []
    }),
  )
  return files.flat()
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(name: string): RegExp {
  // Package names can contain @, /, - which aren't word chars,
  // so we use lookahead/lookbehind for word-char boundaries only
  // when the name starts/ends with a word character.
  const escaped = escapeRegExp(name)
  const prefix = /\w/.test(name.charAt(0)) ? '\\b' : ''
  const suffix = /\w/.test(name.charAt(name.length - 1)) ? '\\b' : ''
  return new RegExp(`${prefix}${escaped}${suffix}`, 'g')
}

export interface RenameResult {
  count: number
  files: string[]
}

export async function renameReferences(targetDir: string, oldNames: string[], newName: string): Promise<RenameResult> {
  // Deduplicate and filter out empty/identical names
  const names = [...new Set(oldNames.filter((n) => n && n !== newName))]
  if (names.length === 0) {
    return { count: 0, files: [] }
  }

  const patterns = names.map((name) => buildPattern(name))
  const files = await walkFiles(targetDir)
  const renamed: string[] = []

  for (const file of files) {
    const rawContent = await readFile(file)
    if (isLikelyBinary(rawContent)) {
      continue
    }

    const content = rawContent.toString('utf-8')
    let updated = content

    for (const pattern of patterns) {
      pattern.lastIndex = 0
      updated = updated.replace(pattern, () => newName)
    }

    if (updated !== content) {
      await writeFile(file, updated)
      renamed.push(file)
    }
  }

  return { count: renamed.length, files: renamed }
}
