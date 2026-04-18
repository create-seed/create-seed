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

  test('creates a null-prototype tools map when valid', () => {
    const result = parseCreateSeedTools({
      tools: {
        solana: '3.0.0',
      },
    })

    expect(result.valid).toBe(true)
    expect(Object.getPrototypeOf(result.tools)).toBeNull()
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

  test('rejects reserved object keys', () => {
    expect(parseCreateSeedTools(JSON.parse('{"tools":{"__proto__":"3.0.0"}}'))).toEqual({
      error: 'tools.__proto__: Tool names must not use reserved object keys',
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

  test('rejects unknown tool object fields', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          solana: {
            docsUrsl: 'https://docs.anza.xyz/cli/install',
            minVerssion: '3.0.0',
          },
        },
      }),
    ).toEqual({
      error: 'tools.solana: Unrecognized keys: "docsUrsl", "minVerssion"',
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

  test('rejects versionPattern without a capture group', () => {
    expect(
      parseCreateSeedTools({
        tools: {
          adb: {
            minVersion: '37.0.0',
            versionPattern: 'Version\\s+\\d+\\.\\d+\\.\\d+',
          },
        },
      }),
    ).toEqual({
      error: 'tools.adb: versionPattern: versionPattern must contain a capture group',
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
