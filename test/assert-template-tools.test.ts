import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertTemplateTools } from '../src/lib/assert-template-tools.ts'

describe('assertTemplateTools', () => {
  let root = ''

  afterEach(() => {
    if (root) {
      rmSync(root, { force: true, recursive: true })
    }
  })

  function createTemplate(pkg: Record<string, unknown> = {}): string {
    root = mkdtempSync(join(tmpdir(), 'assert-template-tools-'))
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2))
    return root
  }

  test('does nothing when package.json is missing', async () => {
    root = mkdtempSync(join(tmpdir(), 'assert-template-tools-'))

    await expect(assertTemplateTools(root)).resolves.toEqual({ ignoredMissingTools: [] })
  })

  test('does nothing when tool requirements are missing', async () => {
    const targetDir = createTemplate({ name: 'template-app' })

    await expect(assertTemplateTools(targetDir)).resolves.toEqual({ ignoredMissingTools: [] })
  })

  test('passes when every requirement is satisfied', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          solana: '3.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: true, output: 'solana-cli 3.1.13' }),
      }),
    ).resolves.toEqual({ ignoredMissingTools: [] })
  })

  test('passes for presence-only requirements when the probe succeeds', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          avm: {},
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: true, output: 'avm ready' }),
      }),
    ).resolves.toEqual({ ignoredMissingTools: [] })
  })

  test('passes when a custom pattern and args extract a matching version', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          adb: {
            args: ['version'],
            minVersion: '37.0.0',
            versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
          },
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async (command, args) => {
          expect(command).toBe('adb')
          expect(args).toEqual(['version'])
          return {
            ok: true,
            output: ['Android Debug Bridge version 1.0.41', 'Version 37.0.0-14910828'].join('\n'),
          }
        },
      }),
    ).resolves.toEqual({ ignoredMissingTools: [] })
  })

  test('ignores missing commands when allowMissingTools is enabled', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          turbo: '2.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        allowMissingTools: true,
        probe: async () => ({ ok: false, output: '', type: 'missing' }),
      }),
    ).resolves.toEqual({ ignoredMissingTools: ['turbo'] })
  })

  test('still fails for non-missing tool requirement errors when allowMissingTools is enabled', async () => {
    const tools: Record<string, string> = {}
    tools.turbo = '2.0.0'
    tools.zed = '1.0.0'

    const targetDir = createTemplate({
      'create-seed': {
        tools,
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        allowMissingTools: true,
        probe: async (command) => {
          if (command === 'turbo') {
            return { ok: false, output: '', type: 'missing' }
          }

          return { ok: true, output: 'zed 0.9.0' }
        },
      }),
    ).rejects.toThrow('Template requires zed >= 1.0.0.')
  })

  test('throws when tool requirements are invalid', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          solana: '3.0',
        },
      },
    })

    await expect(assertTemplateTools(targetDir)).rejects.toThrow('Invalid create-seed.tools in template package.json;')
  })

  test('throws when a required command is missing', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          turbo: '2.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: false, output: '', type: 'missing' }),
      }),
    ).rejects.toThrow(
      'Template requires turbo >= 2.0.0. `turbo` is not installed. Install or upgrade turbo so `turbo --version` reports at least 2.0.0, then rerun create-seed.',
    )
  })

  test('throws when the installed version is below the minimum', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          turbo: '2.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: true, output: 'turbo 1.9.0' }),
      }),
    ).rejects.toThrow('Detected 1.9.0.')
  })

  test('throws when version probing fails', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          turbo: '2.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: false, output: 'permission denied', type: 'probe-failed' }),
      }),
    ).rejects.toThrow('`turbo --version` failed: permission denied')
  })

  test('throws when the version output is not parseable', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          turbo: '2.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: true, output: 'turbo version unknown' }),
      }),
    ).rejects.toThrow('`turbo --version` did not report a parseable version: turbo version unknown')
  })

  test('aggregates failures in alphabetical order', async () => {
    const tools: Record<string, string> = {}
    tools.zed = '1.0.0'
    tools.alpha = '1.0.0'

    const targetDir = createTemplate({
      'create-seed': {
        tools,
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async (command) => {
          if (command === 'alpha') {
            return { ok: false, output: '', type: 'missing' }
          }

          return { ok: true, output: 'zed 0.9.0' }
        },
      }),
    ).rejects.toThrow(/Template tool requirements not met:[\s\S]*alpha >= 1\.0\.0[\s\S]*zed >= 1\.0\.0/)
  })

  test('uses the Solana-specific help message', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          solana: '3.0.0',
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: false, output: '', type: 'missing' }),
      }),
    ).rejects.toThrow('https://solana.com/docs/intro/installation')
  })

  test('uses custom install guidance when provided', async () => {
    const targetDir = createTemplate({
      'create-seed': {
        tools: {
          adb: {
            docsUrl: 'https://developer.android.com/tools/adb',
            installHint: 'Install Android platform-tools',
          },
        },
      },
    })

    await expect(
      assertTemplateTools(targetDir, {
        probe: async () => ({ ok: false, output: '', type: 'missing' }),
      }),
    ).rejects.toThrow(
      'Template requires adb. `adb` is not installed. Install Android platform-tools. See https://developer.android.com/tools/adb.',
    )
  })
})
