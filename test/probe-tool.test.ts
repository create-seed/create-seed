import { describe, expect, test } from 'bun:test'
import { probeTool } from '../src/lib/probe-tool.ts'

describe('probeTool', () => {
  test('extracts a comparable version from v-prefixed output', async () => {
    await expect(
      probeTool('node', {
        probe: async () => ({ ok: true, output: 'v24.5.0' }),
      }),
    ).resolves.toMatchObject({
      command: 'node',
      detectedVersions: ['24.5.0'],
      status: 'ok',
      version: '24.5.0',
    })
  })

  test('surfaces multiple detected versions and uses the first one', async () => {
    await expect(
      probeTool('adb', {
        probe: async () => ({
          ok: true,
          output: ['Android Debug Bridge version 1.0.41', 'Version 37.0.0-14910828'].join('\n'),
        }),
      }),
    ).resolves.toMatchObject({
      command: 'adb',
      detectedVersions: ['1.0.41', '37.0.0'],
      status: 'ok',
      version: '1.0.41',
    })
  })

  test('supports a custom pattern to select the intended version token', async () => {
    await expect(
      probeTool('adb', {
        minVersion: '37.0.0',
        probe: async () => ({
          ok: true,
          output: ['Android Debug Bridge version 1.0.41', 'Version 37.0.0-14910828'].join('\n'),
        }),
        versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
      }),
    ).resolves.toMatchObject({
      detectedVersions: ['1.0.41', '37.0.0'],
      minVersion: '37.0.0',
      satisfiesMinVersion: true,
      version: '37.0.0',
      versionSource: 'pattern',
    })
  })

  test('checks the extracted version against a minimum when provided', async () => {
    await expect(
      probeTool('solana', {
        minVersion: '3.0.0',
        probe: async () => ({ ok: true, output: 'solana-cli 3.1.13' }),
      }),
    ).resolves.toMatchObject({
      minVersion: '3.0.0',
      satisfiesMinVersion: true,
      version: '3.1.13',
    })
  })

  test('supports presence-only checks without a parseable version', async () => {
    await expect(
      probeTool('avm', {
        presenceOnly: true,
        probe: async () => ({ ok: true, output: 'avm ready' }),
      }),
    ).resolves.toMatchObject({
      status: 'ok',
      suggestedConfig: {
        tools: {
          avm: {},
        },
      },
      version: undefined,
    })
  })

  test('throws when the requested minimum version is invalid', async () => {
    await expect(probeTool('solana', { minVersion: '3.0' })).rejects.toThrow(
      'Invalid minimum version: "3.0". Expected a version like "1.2.3"',
    )
  })

  test('throws when presenceOnly is combined with a version pattern', async () => {
    await expect(
      probeTool('adb', {
        presenceOnly: true,
        versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
      }),
    ).rejects.toThrow('presenceOnly cannot be combined with versionPattern')
  })
})
