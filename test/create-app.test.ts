import { afterEach, describe, expect, mock, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

describe('createApp', () => {
  let root = ''
  const originalPath = process.env.PATH

  afterEach(() => {
    mock.restore()

    if (root && existsSync(root)) {
      rmSync(root, { force: true, recursive: true })
    }

    if (originalPath === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = originalPath
    }
  })

  test('fails before rewrite, install, git, setup, and fix when tool requirements are not met', async () => {
    root = mkdtempSync(join(tmpdir(), 'create-app-test-'))
    const targetDir = join(root, 'my-app')
    const templateDir = join(root, 'template')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify(
        {
          'create-seed': {
            instructions: ['+bun run dev'],
            tools: {
              'missing-tool': '1.0.0',
            },
          },
          name: 'template-app',
          scripts: {
            'create-seed:fix':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'fix\\n')\"",
            'create-seed:setup':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'setup\\n')\"",
            postinstall:
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'install\\n')\"",
          },
          version: '1.0.0',
        },
        null,
        2,
      ),
    )

    const { createApp } = await import('../src/lib/create-app.ts')

    await expect(
      createApp({
        args: {
          allowMissingTools: false,
          command: 'create',
          dryRun: false,
          list: false,
          name: 'my-app',
          pm: 'bun',
          registryDir: '.',
          skipGit: false,
          skipInstall: false,
          template: templateDir,
          templatesUrl: 'https://example.com/templates.json',
          verbose: false,
        },
        targetDir,
      }),
    ).rejects.toThrow('Checking template tool requirements: Template tool requirements not met:')

    expect(JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf-8')).name).toBe('template-app')
    expect(existsSync(join(targetDir, '.git'))).toBe(false)
    expect(existsSync(join(targetDir, 'lifecycle.log'))).toBe(false)
  })

  test('runs tool checks before install and continues the existing lifecycle when they pass', async () => {
    root = mkdtempSync(join(tmpdir(), 'create-app-test-'))
    const targetDir = join(root, 'my-app')
    const templateDir = join(root, 'template')
    const toolPath = join(root, 'seed-tool')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(toolPath, "#!/bin/sh\necho 'seed-tool 1.0.0'\n")
    chmodSync(toolPath, 0o755)
    process.env.PATH = [root, originalPath].filter(Boolean).join(delimiter)

    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify(
        {
          'create-seed': {
            tools: {
              'seed-tool': '1.0.0',
            },
          },
          name: 'template-app',
          scripts: {
            'create-seed:fix':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'fix\\n')\"",
            'create-seed:setup':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'setup\\n')\"",
            postinstall:
              "bun -e \"import { appendFileSync, existsSync } from 'node:fs'; appendFileSync('lifecycle.log', existsSync('.git') ? 'install:git\\n' : 'install:no-git\\n')\"",
          },
          version: '1.0.0',
        },
        null,
        2,
      ),
    )

    const { createApp } = await import('../src/lib/create-app.ts')

    await createApp({
      args: {
        allowMissingTools: false,
        command: 'create',
        dryRun: false,
        list: false,
        name: 'my-app',
        pm: 'bun',
        registryDir: '.',
        skipGit: false,
        skipInstall: false,
        template: templateDir,
        templatesUrl: 'https://example.com/templates.json',
        verbose: false,
      },
      targetDir,
    })

    expect(readFileSync(join(targetDir, 'lifecycle.log'), 'utf-8')).toBe('install:git\nsetup\nfix\n')
  })

  test('continues when required tools are missing and allowMissingTools is enabled', async () => {
    root = mkdtempSync(join(tmpdir(), 'create-app-test-'))
    const targetDir = join(root, 'my-app')
    const templateDir = join(root, 'template')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify(
        {
          'create-seed': {
            tools: {
              'missing-tool': '1.0.0',
            },
          },
          name: 'template-app',
          scripts: {
            'create-seed:fix':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'fix\\n')\"",
            'create-seed:setup':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'setup\\n')\"",
            postinstall:
              "bun -e \"import { appendFileSync, existsSync } from 'node:fs'; appendFileSync('lifecycle.log', existsSync('.git') ? 'install:git\\n' : 'install:no-git\\n')\"",
          },
          version: '1.0.0',
        },
        null,
        2,
      ),
    )

    const { createApp } = await import('../src/lib/create-app.ts')

    await createApp({
      args: {
        allowMissingTools: true,
        command: 'create',
        dryRun: false,
        list: false,
        name: 'my-app',
        pm: 'bun',
        registryDir: '.',
        skipGit: false,
        skipInstall: false,
        template: templateDir,
        templatesUrl: 'https://example.com/templates.json',
        verbose: false,
      },
      targetDir,
    })

    expect(readFileSync(join(targetDir, 'lifecycle.log'), 'utf-8')).toBe('install:git\nsetup\nfix\n')
  })

  test('runs setup after install and before fix and the initial commit', async () => {
    root = mkdtempSync(join(tmpdir(), 'create-app-test-'))
    const targetDir = join(root, 'my-app')
    const templateDir = join(root, 'template')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify(
        {
          name: 'template-app',
          scripts: {
            'create-seed:fix':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'fix\\n')\"",
            'create-seed:setup':
              "bun -e \"import { appendFileSync } from 'node:fs'; appendFileSync('lifecycle.log', 'setup\\n')\"",
            postinstall:
              "bun -e \"import { appendFileSync, existsSync } from 'node:fs'; appendFileSync('lifecycle.log', existsSync('.git') ? 'install:git\\n' : 'install:no-git\\n')\"",
          },
          version: '1.0.0',
        },
        null,
        2,
      ),
    )

    const { createApp } = await import('../src/lib/create-app.ts')

    await createApp({
      args: {
        allowMissingTools: false,
        command: 'create',
        dryRun: false,
        list: false,
        name: 'my-app',
        pm: 'bun',
        registryDir: '.',
        skipGit: false,
        skipInstall: false,
        template: templateDir,
        templatesUrl: 'https://example.com/templates.json',
        verbose: false,
      },
      targetDir,
    })

    expect(readFileSync(join(targetDir, 'lifecycle.log'), 'utf-8')).toBe('install:git\nsetup\nfix\n')
    expect(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: targetDir, encoding: 'utf-8' }).trim()).toBe('1')
    expect(execFileSync('git', ['show', 'HEAD:lifecycle.log'], { cwd: targetDir, encoding: 'utf-8' })).toBe(
      'install:git\nsetup\nfix\n',
    )
  })
})
