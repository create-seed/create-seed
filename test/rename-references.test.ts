import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renameReferences } from '../src/lib/rename-references.ts'

describe('renameReferences', () => {
  const tmpDir = join(import.meta.dirname, 'fixtures', 'tmp-rename-references')

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true })
    }
  })

  test('renames references in .mts files', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'cspell.config.mts')
    writeFileSync(filePath, "export default ['bun-monorepo']\n")

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toContain('beadhub-playground')
  })

  test('skips binary files', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'logo.png')

    // Includes null bytes and the old name in ASCII to verify binary detection skips it.
    writeFileSync(filePath, Buffer.from([0, 1, 2, ...Buffer.from('bun-monorepo'), 0, 255]))

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(0)
    expect(result.files).toEqual([])
    expect(readFileSync(filePath)).toEqual(Buffer.from([0, 1, 2, ...Buffer.from('bun-monorepo'), 0, 255]))
  })
})
