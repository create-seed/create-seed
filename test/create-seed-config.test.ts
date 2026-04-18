import { describe, expect, test } from 'bun:test'
import { parseCreateSeedTools } from '../src/lib/create-seed-config.ts'

describe('parseCreateSeedTools', () => {
  test('returns normalized and sorted tool requirements when valid', () => {
    const tools = {
      adb: {
        args: ['version'],
        docsUrl: 'https://developer.android.com/tools/adb',
        installHint: 'Install Android platform-tools',
        minVersion: '37.0.0',
        versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
      },
      solana: '3.0.0',
      turbo: {},
    }

    expect(
      parseCreateSeedTools({
        tools,
      }),
    ).toEqual({
      error: undefined,
      tools: {
        adb: {
          args: ['version'],
          command: 'adb',
          docsUrl: 'https://developer.android.com/tools/adb',
          installHint: 'Install Android platform-tools',
          minVersion: '37.0.0',
          versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
        },
        solana: {
          args: ['--version'],
          command: 'solana',
          docsUrl: undefined,
          installHint: undefined,
          minVersion: '3.0.0',
          versionPattern: undefined,
        },
        turbo: {
          args: ['--version'],
          command: 'turbo',
          docsUrl: undefined,
          installHint: undefined,
          minVersion: undefined,
          versionPattern: undefined,
        },
      },
      valid: true,
    })
  })

  test('accepts missing tools', () => {
    expect(parseCreateSeedTools({})).toEqual({
      error: undefined,
      tools: undefined,
      valid: true,
    })
  })

  test('rejects non-object tools config', () => {
    expect(parseCreateSeedTools({ tools: ['solana'] })).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })

  test('rejects empty command names', () => {
    expect(parseCreateSeedTools({ tools: { '': '3.0.0' } })).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })

  test('rejects invalid tool object fields', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          adb: {
            args: ['version'],
            minVersion: '3.0',
          },
        },
      }),
    ).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })

  test('rejects invalid regex patterns', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          adb: {
            minVersion: '37.0.0',
            versionPattern: '(',
          },
        },
      }),
    ).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })

  test('rejects unsafe regex patterns', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          adb: {
            minVersion: '37.0.0',
            versionPattern: '(a+)+$',
          },
        },
      }),
    ).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })

  test('rejects versionPattern without minVersion', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          adb: {
            versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
          },
        },
      }),
    ).toMatchObject({
      tools: undefined,
      valid: false,
    })
  })
})
