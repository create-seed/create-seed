import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateTemplate } from '../src/lib/validate-template.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'validate-template-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('validateTemplate', () => {
  test('fails when create-seed metadata is invalid', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        'create-seed': {
          tools: {
            solana: '3.0',
          },
        },
        name: 'template-app',
      }),
    )

    expect(validateTemplate(root)).toMatchObject({
      error: 'Invalid create-seed in template package.json; tools.solana: Expected a version like "1.2.3"',
      valid: false,
    })
  })

  test('fails when tool metadata contains unknown keys', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        'create-seed': {
          tools: {
            solana: {
              docsUrsl: 'https://docs.anza.xyz/cli/install',
              minVerssion: '3.0.0',
            },
          },
        },
        name: 'template-app',
      }),
    )

    expect(validateTemplate(root)).toMatchObject({
      error: 'Invalid create-seed in template package.json; tools.solana: Unrecognized keys: "docsUrsl", "minVerssion"',
      valid: false,
    })
  })

  test('fails when package.json is missing', () => {
    expect(validateTemplate(root)).toMatchObject({
      error: `package.json not found: ${join(root, 'package.json')}`,
      valid: false,
    })
  })

  test('fails when package.json is not a valid JSON object', () => {
    writeFileSync(join(root, 'package.json'), '[]')

    expect(validateTemplate(root)).toMatchObject({
      error: `package.json is not a valid JSON object: ${join(root, 'package.json')}`,
      valid: false,
    })
  })

  test('passes when package.json has no create-seed metadata', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'template-app' }))

    expect(validateTemplate(root)).toEqual({
      config: undefined,
      dir: root,
      error: undefined,
      packageJsonPath: join(root, 'package.json'),
      valid: true,
    })
  })

  test('returns normalized create-seed metadata when valid', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        'create-seed': {
          instructions: ['+bun run ios'],
          tools: {
            node: {
              minVersion: '24.5.0',
            },
            solana: '3.0.0',
          },
        },
        name: 'template-app',
      }),
    )

    expect(validateTemplate(root)).toEqual({
      config: {
        instructions: ['+bun run ios'],
        tools: {
          node: {
            args: ['--version'],
            command: 'node',
            docsUrl: undefined,
            installHint: undefined,
            minVersion: '24.5.0',
            versionPattern: undefined,
          },
          solana: {
            args: ['--version'],
            command: 'solana',
            docsUrl: undefined,
            installHint: undefined,
            minVersion: '3.0.0',
            versionPattern: undefined,
          },
        },
      },
      dir: root,
      error: undefined,
      packageJsonPath: join(root, 'package.json'),
      valid: true,
    })
  })
})
