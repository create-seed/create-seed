import { describe, expect, test } from 'bun:test'
import { getArgs } from '../src/lib/get-args.ts'

describe('getArgs', () => {
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
