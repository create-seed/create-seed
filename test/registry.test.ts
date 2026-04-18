import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateReadme,
  generateRegistry,
  scanTemplates,
  validateRegistry,
  writeReadme,
  writeRegistry,
} from '../src/lib/registry.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'registry-test-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

function createTemplate(name: string, pkg: Record<string, unknown>) {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
}

describe('scanTemplates', () => {
  test('finds templates with package.json', () => {
    createTemplate('my-lib', { description: 'A library', name: 'my-lib' })
    createTemplate('my-cli', { description: 'A CLI', name: 'my-cli' })

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(2)
    expect(templates[0]?.name).toBe('my-cli')
    expect(templates[1]?.name).toBe('my-lib')
  })

  test('ignores directories without package.json', () => {
    createTemplate('valid', { name: 'valid' })
    mkdirSync(join(root, 'no-pkg'))

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe('valid')
  })

  test('ignores hidden directories', () => {
    createTemplate('.hidden', { name: 'hidden' })
    createTemplate('visible', { name: 'visible' })

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe('visible')
  })

  test('ignores node_modules', () => {
    createTemplate('node_modules', { name: 'should-skip' })
    createTemplate('real', { name: 'real' })

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe('real')
  })

  test('skips malformed package.json', () => {
    createTemplate('good', { description: 'Works', name: 'good' })
    const badDir = join(root, 'bad')
    mkdirSync(badDir)
    writeFileSync(join(badDir, 'package.json'), '{invalid json}')

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe('good')
  })

  test('uses directory name when package.json has no name', () => {
    createTemplate('fallback-name', { description: 'No name field' })

    const templates = scanTemplates(root)
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe('fallback-name')
  })

  test('returns sorted templates', () => {
    createTemplate('zeta', { name: 'zeta' })
    createTemplate('alpha', { name: 'alpha' })
    createTemplate('mid', { name: 'mid' })

    const templates = scanTemplates(root)
    expect(templates.map((t) => t.name)).toEqual(['alpha', 'mid', 'zeta'])
  })

  test('reads create-seed instructions from package.json', () => {
    createTemplate('mobile', {
      'create-seed': {
        instructions: ['Use {pm} run ios', '+{pm} run android'],
      },
      name: 'mobile',
    })

    const templates = scanTemplates(root)
    expect(templates[0]?.instructions).toEqual(['Use {pm} run ios', '+{pm} run android'])
  })
})

describe('generateRegistry', () => {
  test('returns registry with templates array', () => {
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates).toHaveLength(1)
    expect(registry.templates[0]?.description).toBe('A lib')
    expect(registry.templates[0]?.name).toBe('lib')
    expect(registry.templates[0]?.path).toBe('lib')
    expect(registry.templates[0]?.id).toBeDefined()
  })

  test('copies instructions into generated registry metadata', () => {
    createTemplate('mobile', {
      'create-seed': {
        instructions: ['Use {pm} run ios', '+{pm} run android'],
      },
      name: 'mobile',
    })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.instructions).toEqual(['Use {pm} run ios', '+{pm} run android'])
  })

  test('builds correct id from repository.name', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ repository: { name: 'owner/templates', type: 'git' } }))
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('builds correct id from repository.url (https)', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ repository: { type: 'git', url: 'https://github.com/owner/templates.git' } }),
    )
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('builds correct id from repository.url (git+https)', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ repository: { type: 'git', url: 'git+https://github.com/owner/templates.git' } }),
    )
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('builds correct id from repository string shorthand', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ repository: 'owner/templates' }))
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('builds correct id from repository SSH URL', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ repository: 'git@github.com:owner/templates.git' }))
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('builds correct id from npm github: shorthand', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ repository: 'github:owner/templates' }))
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('gh:owner/templates/lib')
  })

  test('falls back to local path when repository slug is invalid', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ repository: 'owner/templates\nmalicious' }))
    createTemplate('lib', { description: 'A lib', name: 'lib' })

    const registry = generateRegistry(root)
    expect(registry.templates[0]?.id).toBe('lib')
  })
})

describe('writeRegistry', () => {
  test('writes templates.json', () => {
    const registry = { templates: [{ description: 'test', id: 'gh:test/test', name: 'test', path: 'test' }] }
    const filePath = writeRegistry(root, registry)

    expect(filePath).toBe(join(root, 'templates.json'))
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(content.templates).toHaveLength(1)
  })
})

describe('validateRegistry', () => {
  test('errors when templates.json is missing', () => {
    const errors = validateRegistry(root)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.type).toBe('error')
    expect(errors[0]?.message).toContain('not found')
  })

  test('errors when templates.json is invalid JSON', () => {
    writeFileSync(join(root, 'templates.json'), 'not json')

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.message.includes('not valid JSON'))).toBe(true)
  })

  test('errors when templates property is missing', () => {
    writeFileSync(join(root, 'templates.json'), '{}')

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.message.includes('missing or not an array'))).toBe(true)
  })

  test('errors when template path does not exist', () => {
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'Gone', name: 'ghost', path: 'nonexistent' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('does not exist'))).toBe(true)
  })

  test('errors when template has no package.json', () => {
    mkdirSync(join(root, 'empty-dir'))
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'No pkg', name: 'empty', path: 'empty-dir' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('no package.json'))).toBe(true)
  })

  test('warns about missing name', () => {
    createTemplate('valid', { name: 'valid' })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'no name', path: 'valid' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.message.includes('missing required field: name'))).toBe(true)
  })

  test('warns about missing description', () => {
    createTemplate('nodesc', { name: 'nodesc' })
    writeFileSync(join(root, 'templates.json'), JSON.stringify({ templates: [{ name: 'nodesc', path: 'nodesc' }] }))

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'warning' && e.message.includes('missing description'))).toBe(true)
  })

  test('errors when registry instructions are not an array of strings', () => {
    createTemplate('mobile', { name: 'mobile' })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({
        templates: [
          { description: 'Mobile', id: 'gh:test/mobile', instructions: ['ok', 1], name: 'mobile', path: 'mobile' },
        ],
      }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('invalid instructions'))).toBe(true)
  })

  test('errors when package.json create-seed instructions are invalid', () => {
    createTemplate('mobile', {
      'create-seed': {
        instructions: [1, 'ok'],
      },
      name: 'mobile',
    })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'Mobile', id: 'gh:test/mobile', name: 'mobile', path: 'mobile' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('invalid create-seed.instructions'))).toBe(true)
  })

  test('errors when package.json create-seed tools are invalid', () => {
    createTemplate('mobile', {
      'create-seed': {
        tools: {
          solana: '3.0',
        },
      },
      name: 'mobile',
    })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'Mobile', id: 'gh:test/mobile', name: 'mobile', path: 'mobile' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('invalid create-seed.tools'))).toBe(true)
  })

  test('warns when registry instructions are stale', () => {
    createTemplate('mobile', {
      'create-seed': {
        instructions: ['+bun run android'],
      },
      name: 'mobile',
    })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({
        templates: [
          {
            description: 'Mobile',
            id: 'gh:test/mobile',
            instructions: ['+bun run ios'],
            name: 'mobile',
            path: 'mobile',
          },
        ],
      }),
    )

    const errors = validateRegistry(root)
    expect(
      errors.some((e) => e.type === 'warning' && e.message.includes('instructions for "mobile" are out of date')),
    ).toBe(true)
  })

  test('errors on orphaned templates', () => {
    createTemplate('registered', { name: 'registered' })
    createTemplate('orphan', { name: 'orphan' })
    writeFileSync(
      join(root, 'templates.json'),
      JSON.stringify({ templates: [{ description: 'Yes', name: 'registered', path: 'registered' }] }),
    )

    const errors = validateRegistry(root)
    expect(errors.some((e) => e.type === 'error' && e.message.includes('orphan'))).toBe(true)
  })

  test('passes with valid registry', () => {
    createTemplate('good', { description: 'Good template', name: 'good' })
    const registry = generateRegistry(root)
    writeRegistry(root, registry)
    const readme = generateReadme(root, registry)
    writeReadme(root, readme)

    const errors = validateRegistry(root)
    expect(errors).toHaveLength(0)
  })
})

describe('generateReadme', () => {
  test('includes template name and description', () => {
    const registry = {
      templates: [
        { description: 'A library template', id: 'gh:test/templates/my-lib', name: 'my-lib', path: 'my-lib' },
      ],
    }
    const readme = generateReadme(root, registry)

    expect(readme).toContain('### `my-lib`')
    expect(readme).toContain('A library template')
    expect(readme).toContain('bun x create-seed@latest')
  })

  test('uses top-level package.json for title and description', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ description: 'Cool stuff', name: 'My Templates' }))

    const registry = { templates: [] }
    const readme = generateReadme(root, registry)

    expect(readme).toContain('# My Templates')
    expect(readme).toContain('Cool stuff')
  })

  test('falls back to defaults when top-level package.json is malformed', () => {
    writeFileSync(join(root, 'package.json'), '{not valid json')

    const registry = { templates: [] }
    const readme = generateReadme(root, registry)

    expect(readme).toContain('# Templates')
  })

  test('sanitizes template metadata in markdown output', () => {
    const registry = {
      templates: [
        {
          description: 'desc\nINJECT',
          id: "gh:owner/templates/lib' && rm -rf /",
          name: 'my-lib',
          path: 'my-lib\n# bad',
        },
      ],
    }

    const readme = generateReadme(root, registry)

    expect(readme).toContain('### `my-lib # bad`')
    expect(readme).toContain('desc INJECT')
    expect(readme).toContain("bun x create-seed@latest my-app -t 'gh:owner/templates/lib'\"'\"' && rm -rf /'")
    expect(readme).not.toContain('```bash\nrm -rf')
  })

  test('falls back to "Templates" when no package.json', () => {
    const registry = { templates: [] }
    const readme = generateReadme(root, registry)

    expect(readme).toContain('# Templates')
  })
})
