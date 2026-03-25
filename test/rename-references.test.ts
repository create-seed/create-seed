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

  test('renames common name variants', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'README.md')
    writeFileSync(filePath, ['# Bun Monorepo', '', 'Package: bun-monorepo', 'Identifier: bunmonorepo'].join('\n'))

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toBe(
      ['# Beadhub Playground', '', 'Package: beadhub-playground', 'Identifier: beadhubplayground'].join('\n'),
    )
  })

  test('renames snake_case variants in json files', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'app.json')
    writeFileSync(filePath, JSON.stringify({ androidPackage: 'com.anonymous.kit_expo_minimal' }, null, 2))

    const result = await renameReferences(tmpDir, ['kit-expo-minimal'], 'some-new-app')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toBe(
      JSON.stringify({ androidPackage: 'com.anonymous.some_new_app' }, null, 2),
    )
  })

  test('renames camelCase and PascalCase variants', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'App.tsx')
    writeFileSync(
      filePath,
      [
        'const kitExpoMinimal = createApp("kitExpoMinimal")',
        'export function KitExpoMinimal() {',
        '  return <KitExpoMinimal />',
        '}',
      ].join('\n'),
    )

    const result = await renameReferences(tmpDir, ['kit-expo-minimal'], 'some-new-app')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toBe(
      [
        'const someNewApp = createApp("someNewApp")',
        'export function SomeNewApp() {',
        '  return <SomeNewApp />',
        '}',
      ].join('\n'),
    )
  })

  test('renames SCREAMING_SNAKE_CASE variants', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, '.env.example')
    writeFileSync(filePath, 'KIT_EXPO_MINIMAL=kit-expo-minimal\n')

    const result = await renameReferences(tmpDir, ['kit-expo-minimal'], 'some-new-app')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toBe('SOME_NEW_APP=some-new-app\n')
  })

  test('does not rename inside larger words', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'notes.txt')
    writeFileSync(
      filePath,
      ['prefixbunmonoreposuffix', 'prefix Bun Monorepo suffix', 'prefix bun-monorepo suffix'].join('\n'),
    )

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(1)
    expect(result.files).toEqual([filePath])
    expect(readFileSync(filePath, 'utf-8')).toBe(
      ['prefixbunmonoreposuffix', 'prefix Beadhub Playground suffix', 'prefix beadhub-playground suffix'].join('\n'),
    )
  })

  test('skips binary files with null bytes', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const filePath = join(tmpDir, 'logo.png')

    // Includes null bytes and the old name in ASCII to verify binary detection skips it.
    writeFileSync(filePath, Buffer.from([0, 1, 2, ...Buffer.from('bun-monorepo'), 0, 255]))

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(0)
    expect(result.files).toEqual([])
    expect(readFileSync(filePath)).toEqual(Buffer.from([0, 1, 2, ...Buffer.from('bun-monorepo'), 0, 255]))
  })

  test('skips files with many control characters', async () => {
    mkdirSync(tmpDir, { recursive: true })
    const content = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, ...Buffer.from('bun-monorepo')])
    const filePath = join(tmpDir, 'control.bin')

    writeFileSync(filePath, content)

    const result = await renameReferences(tmpDir, ['bun-monorepo'], 'beadhub-playground')

    expect(result.count).toBe(0)
    expect(result.files).toEqual([])
    expect(readFileSync(filePath)).toEqual(content)
  })
})
