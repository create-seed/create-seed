import { open, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const IGNORE_DIRS = new Set(['.git', '.next', '.nuxt', '.output', '.turbo', 'dist', 'node_modules'])
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

async function readFilePrefix(file: string, size: number): Promise<Buffer> {
  const handle = await open(file, 'r')

  try {
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
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

function getNameTokens(name: string): string[] {
  return name.match(/[a-z0-9]+/gi)?.map((token) => token.toLowerCase()) ?? []
}

function toTitleCase(tokens: string[]): string | undefined {
  if (tokens.length === 0) {
    return undefined
  }

  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ')
}

function toConcatenatedLowercase(tokens: string[]): string | undefined {
  if (tokens.length === 0) {
    return undefined
  }

  return tokens.join('')
}

function buildReplacementPairs(oldNames: string[], newName: string): Array<[from: string, to: string]> {
  const pairs = new Map<string, string>()
  const newTokens = getNameTokens(newName)
  const titleNewName = toTitleCase(newTokens)
  const concatenatedNewName = toConcatenatedLowercase(newTokens)

  for (const oldName of oldNames) {
    if (!oldName || oldName === newName) {
      continue
    }

    pairs.set(oldName, newName)

    const oldTokens = getNameTokens(oldName)
    const titleOldName = toTitleCase(oldTokens)
    if (titleOldName && titleNewName && titleOldName !== titleNewName) {
      pairs.set(titleOldName, titleNewName)
    }

    const concatenatedOldName = toConcatenatedLowercase(oldTokens)
    if (concatenatedOldName && concatenatedNewName && concatenatedOldName !== concatenatedNewName) {
      pairs.set(concatenatedOldName, concatenatedNewName)
    }
  }

  return [...pairs.entries()].sort((a, b) => b[0].length - a[0].length)
}

export interface RenameResult {
  count: number
  files: string[]
}

export async function renameReferences(targetDir: string, oldNames: string[], newName: string): Promise<RenameResult> {
  const replacements = buildReplacementPairs(oldNames, newName)
  if (replacements.length === 0) {
    return { count: 0, files: [] }
  }

  const patterns = replacements.map(([from, to]) => ({
    pattern: buildPattern(from),
    replacement: to,
  }))
  const files = await walkFiles(targetDir)
  const renamed: string[] = []

  for (const file of files) {
    const prefix = await readFilePrefix(file, BINARY_DETECTION_CHUNK_SIZE)
    if (isLikelyBinary(prefix)) {
      continue
    }

    const content = await readFile(file, 'utf-8')
    let updated = content

    for (const { pattern, replacement } of patterns) {
      pattern.lastIndex = 0
      updated = updated.replace(pattern, () => replacement)
    }

    if (updated !== content) {
      await writeFile(file, updated)
      renamed.push(file)
    }
  }

  return { count: renamed.length, files: renamed }
}
