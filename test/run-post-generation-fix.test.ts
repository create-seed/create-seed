import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  POST_GENERATION_FIX_SCRIPTS,
  runPostGenerationFix,
  selectPostGenerationFixScript,
} from '../src/lib/run-post-generation-fix.ts'

describe('runPostGenerationFix', () => {
  const tmpDir = join(import.meta.dirname, 'fixtures', 'tmp-post-generation-fix')

  afterEach(() => {
    mock.restore()
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true })
    }
  })

  function setupPackageJson(pkg: unknown): void {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2))
  }

  test('exports the preferred script order', () => {
    expect(POST_GENERATION_FIX_SCRIPTS).toEqual(['create-seed:fix', 'lint:fix', 'format'])
  })

  test('selects the first matching script from the preferred order', () => {
    expect(
      selectPostGenerationFixScript({
        scripts: {
          'create-seed:fix': 'custom-fix',
          format: 'prettier --write .',
          'lint:fix': 'biome check --write .',
        },
      }),
    ).toBe('create-seed:fix')

    expect(
      selectPostGenerationFixScript({
        scripts: {
          format: 'prettier --write .',
          'lint:fix': 'biome check --write .',
        },
      }),
    ).toBe('lint:fix')

    expect(
      selectPostGenerationFixScript({
        scripts: {
          format: 'prettier --write .',
        },
      }),
    ).toBe('format')
  })

  test('skips when install was skipped', async () => {
    const exec = mock(async () => {})
    const result = await runPostGenerationFix(tmpDir, 'bun', { exec, installSkipped: true })

    expect(result).toEqual({ reason: 'install-skipped', status: 'skipped' })
    expect(exec).not.toHaveBeenCalled()
  })

  test('skips when package.json is missing or invalid', async () => {
    const exec = mock(async () => {})

    expect(await runPostGenerationFix(tmpDir, 'bun', { exec })).toEqual({
      reason: 'package-json-missing',
      status: 'skipped',
    })
    expect(exec).not.toHaveBeenCalled()

    setupPackageJson(null)

    expect(await runPostGenerationFix(tmpDir, 'bun', { exec })).toEqual({
      reason: 'package-json-missing',
      status: 'skipped',
    })
    expect(exec).not.toHaveBeenCalled()
  })

  test('skips when no matching script exists', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        lint: 'biome check .',
        test: 'bun test',
      },
    })

    const exec = mock(async () => {})
    const result = await runPostGenerationFix(tmpDir, 'bun', { exec })

    expect(result).toEqual({ reason: 'script-missing', status: 'skipped' })
    expect(exec).not.toHaveBeenCalled()
  })

  test('runs the selected script with the detected package manager', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        format: 'prettier --write .',
        'lint:fix': 'biome check --write .',
      },
    })

    const exec = mock(async () => {})
    const result = await runPostGenerationFix(tmpDir, 'pnpm', { exec })

    expect(result).toEqual({ script: 'lint:fix', status: 'ran' })
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('pnpm', ['run', 'lint:fix'], { cwd: tmpDir })
  })

  test('returns failed status and warns when the script runner fails', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        format: 'prettier --write .',
      },
    })

    const exec = mock(async () => {
      throw new Error('boom')
    })
    const warn = spyOn(console, 'warn').mockImplementation(() => {})

    const result = await runPostGenerationFix(tmpDir, 'npm', { exec })
    expect(result).toEqual({ message: 'boom', script: 'format', status: 'failed' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
