import { afterEach, describe, expect, mock, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('createApp', () => {
  let root = ''

  afterEach(() => {
    mock.restore()

    if (root && existsSync(root)) {
      rmSync(root, { force: true, recursive: true })
    }
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
