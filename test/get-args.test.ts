import { describe, expect, test } from 'bun:test'
import { getArgs } from '../src/lib/get-args.ts'

describe('getArgs', () => {
  test('parses registry validate command with fail-on-warning', () => {
    expect(
      getArgs(['bun', 'create-seed', 'registry', 'validate', '--dir', './templates', '--fail-on-warning']),
    ).toMatchObject({
      command: 'registry-validate',
      registryDir: './templates',
      registryFailOnWarning: true,
    })

    expect(getArgs(['bun', 'create-seed', 'registry', 'validate'])).toMatchObject({
      command: 'registry-validate',
      registryDir: '.',
      registryFailOnWarning: false,
    })
  })

  test('parses template validate command', () => {
    expect(getArgs(['bun', 'create-seed', 'template', 'validate', '--dir', './template'])).toMatchObject({
      command: 'template-validate',
      templateDir: './template',
    })

    expect(getArgs(['bun', 'create-seed', 'template', 'validate'])).toMatchObject({
      command: 'template-validate',
      templateDir: '.',
    })
  })
})
