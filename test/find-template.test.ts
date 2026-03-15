import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { findTemplate } from '../src/lib/find-template.ts'

const originalUrl = process.env.TEMPLATES_URL

beforeAll(() => {
  process.env.TEMPLATES_URL = resolve(import.meta.dirname, 'fixtures/templates.json')
})

afterAll(() => {
  if (originalUrl !== undefined) {
    process.env.TEMPLATES_URL = originalUrl
  } else {
    delete process.env.TEMPLATES_URL
  }
})

describe('findTemplate', () => {
  test('normalizes GitHub repo URLs', async () => {
    expect(await findTemplate('https://github.com/create-seed/templates')).toEqual({
      id: 'gh:create-seed/templates',
      mode: 'external',
    })
  })

  test('normalizes GitHub repo URLs with trailing slashes', async () => {
    expect(await findTemplate('https://github.com/create-seed/templates/')).toEqual({
      id: 'gh:create-seed/templates',
      mode: 'external',
    })
  })

  test('normalizes GitHub tree URLs with nested paths', async () => {
    expect(await findTemplate('https://github.com/create-seed/templates/tree/main/bun-library')).toEqual({
      id: 'gh:create-seed/templates/bun-library#main',
      mode: 'external',
    })
  })

  test('normalizes GitHub tree URLs without nested paths', async () => {
    expect(await findTemplate('https://github.com/create-seed/templates/tree/main')).toEqual({
      id: 'gh:create-seed/templates#main',
      mode: 'external',
    })
  })

  test('treats paths starting with ./ as local', async () => {
    expect(await findTemplate('./my-template')).toEqual({ id: './my-template', mode: 'local' })
  })

  test('treats paths starting with ../ as local', async () => {
    expect(await findTemplate('../templates/foo')).toEqual({ id: '../templates/foo', mode: 'local' })
  })

  test('treats absolute paths as local', async () => {
    expect(await findTemplate('/tmp/my-template')).toEqual({ id: '/tmp/my-template', mode: 'local' })
  })

  test('treats owner/repo as external with gh: prefix', async () => {
    expect(await findTemplate('create-seed/templates')).toEqual({ id: 'gh:create-seed/templates', mode: 'external' })
  })

  test('treats gh:owner/repo as external without double-prefixing', async () => {
    expect(await findTemplate('gh:create-seed/templates')).toEqual({ id: 'gh:create-seed/templates', mode: 'external' })
  })

  test('treats owner/repo/path as external', async () => {
    expect(await findTemplate('create-seed/templates/bun-library')).toEqual({
      id: 'gh:create-seed/templates/bun-library',
      mode: 'external',
    })
  })

  test('resolves short name from registry', async () => {
    const result = await findTemplate('test-library')
    expect(result).toEqual({ id: 'gh:test-owner/templates/test-library', mode: 'external' })
  })

  test('treats Windows drive letter paths as local', async () => {
    expect(await findTemplate('C:\\Users\\dev\\template')).toEqual({
      id: 'C:\\Users\\dev\\template',
      mode: 'local',
    })
  })

  test('treats UNC paths as local', async () => {
    expect(await findTemplate('\\\\server\\share\\template')).toEqual({
      id: '\\\\server\\share\\template',
      mode: 'local',
    })
  })

  test('throws for unsupported GitHub URL shapes', async () => {
    await expect(findTemplate('https://github.com/create-seed/templates/blob/main/README.md')).rejects.toThrow(
      'Unsupported GitHub template URL',
    )
  })

  test('throws for unknown short name', async () => {
    await expect(findTemplate('nonexistent-template')).rejects.toThrow('Unknown template')
  })
})
