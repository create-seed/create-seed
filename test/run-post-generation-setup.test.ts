import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  POST_GENERATION_SETUP_SCRIPTS,
  runPostGenerationSetup,
  selectPostGenerationSetupScript,
} from '../src/lib/run-post-generation-setup.ts'

describe('runPostGenerationSetup', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'post-generation-setup-test-'))
  })

  afterEach(() => {
    mock.restore()
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { force: true, recursive: true })
    }
  })

  function setupPackageJson(pkg: unknown): void {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2))
  }

  test('exports the preferred script order', () => {
    expect(POST_GENERATION_SETUP_SCRIPTS).toEqual(['create-seed:setup', 'setup'])
  })

  test('selects the first matching script from the preferred order', () => {
    expect(
      selectPostGenerationSetupScript({
        scripts: {
          'create-seed:setup': 'tsx scripts/setup.ts',
          setup: 'node setup.mjs',
        },
      }),
    ).toBe('create-seed:setup')

    expect(
      selectPostGenerationSetupScript({
        scripts: {
          setup: 'node setup.mjs',
        },
      }),
    ).toBe('setup')
  })

  test('skips when install was skipped', async () => {
    const exec = mock(async () => {})
    const result = await runPostGenerationSetup(tmpDir, 'bun', { exec, installSkipped: true })

    expect(result).toEqual({ reason: 'install-skipped', status: 'skipped' })
    expect(exec).not.toHaveBeenCalled()
  })

  test('skips when package.json is missing or invalid', async () => {
    const exec = mock(async () => {})

    expect(await runPostGenerationSetup(tmpDir, 'bun', { exec })).toEqual({
      reason: 'package-json-missing',
      status: 'skipped',
    })
    expect(exec).not.toHaveBeenCalled()

    setupPackageJson(null)

    expect(await runPostGenerationSetup(tmpDir, 'bun', { exec })).toEqual({
      reason: 'package-json-missing',
      status: 'skipped',
    })
    expect(exec).not.toHaveBeenCalled()
  })

  test('skips when no matching script exists', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        dev: 'vite',
        test: 'bun test',
      },
    })

    const exec = mock(async () => {})
    const result = await runPostGenerationSetup(tmpDir, 'bun', { exec })

    expect(result).toEqual({ reason: 'script-missing', status: 'skipped' })
    expect(exec).not.toHaveBeenCalled()
  })

  test('runs the selected script with the detected package manager', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        setup: 'node setup.mjs',
      },
    })

    const exec = mock(async () => {})
    const result = await runPostGenerationSetup(tmpDir, 'pnpm', { exec })

    expect(result).toEqual({ script: 'setup', status: 'ran' })
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('pnpm', ['run', 'setup'], { cwd: tmpDir })
  })

  test('returns failed status and warns when the script runner fails', async () => {
    setupPackageJson({
      name: 'my-app',
      scripts: {
        setup: 'node setup.mjs',
      },
    })

    const exec = mock(async () => {
      throw new Error('boom')
    })
    const warn = spyOn(console, 'warn').mockImplementation(() => {})

    const result = await runPostGenerationSetup(tmpDir, 'npm', { exec })
    expect(result).toEqual({ message: 'boom', script: 'setup', status: 'failed' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
