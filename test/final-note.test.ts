import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pico from 'picocolors'
import { buildFinalNote } from '../src/lib/final-note.ts'

describe('buildFinalNote', () => {
  let root: string

  afterEach(() => {
    if (root) {
      rmSync(root, { force: true, recursive: true })
    }
  })

  function setupPackageJson(pkg: Record<string, unknown>): string {
    root = mkdtempSync(join(tmpdir(), 'final-note-test-'))
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2))
    return root
  }

  function emphasize(message: string): string {
    return pico.bold(pico.white(message))
  }

  test('falls back to the detected run script when no custom instructions exist', () => {
    const targetDir = setupPackageJson({
      name: 'template-app',
      scripts: {
        dev: 'vite',
      },
    })

    expect(
      buildFinalNote({
        instructions: undefined,
        packageManager: 'pnpm',
        projectName: 'my-app',
        skipGit: false,
        skipInstall: false,
        targetDir,
      }),
    ).toBe('cd my-app\n\npnpm run dev')
  })

  test('uses custom instructions instead of the fallback run script', () => {
    const targetDir = setupPackageJson({
      name: 'template-app',
      scripts: {
        dev: 'vite',
      },
    })

    expect(
      buildFinalNote({
        instructions: ['To build the Android app locally, run this:', '+{pm} run android'],
        packageManager: 'bun',
        projectName: 'my-app',
        skipGit: false,
        skipInstall: false,
        targetDir,
      }),
    ).toBe(['cd my-app', `To build the Android app locally, run this:\n${emphasize('bun run android')}`].join('\n\n'))
  })

  test('ignores blank custom instructions and falls back when none remain', () => {
    const targetDir = setupPackageJson({
      name: 'template-app',
      scripts: {
        start: 'vite preview',
      },
    })

    expect(
      buildFinalNote({
        instructions: ['   ', ''],
        packageManager: 'npm',
        projectName: 'my-app',
        skipGit: false,
        skipInstall: false,
        targetDir,
      }),
    ).toBe('cd my-app\n\nnpm run start')
  })

  test('adds skipped git and install instructions before the run step', () => {
    const targetDir = setupPackageJson({
      name: 'template-app',
      scripts: {
        build: 'tsc -b',
      },
    })

    expect(
      buildFinalNote({
        instructions: undefined,
        packageManager: 'pnpm',
        projectName: 'my-app',
        skipGit: true,
        skipInstall: true,
        targetDir,
      }),
    ).toBe(
      [
        'cd my-app',
        [
          'Initialize git and create the initial commit:',
          emphasize('git init -b main'),
          emphasize('git add .'),
          emphasize('git commit -m "chore: initial commit"'),
        ].join('\n'),
        ['Install dependencies:', emphasize('pnpm install')].join('\n'),
        'pnpm run build',
      ].join('\n\n'),
    )
  })

  test('adds the manual setup step after install when install was skipped', () => {
    const targetDir = setupPackageJson({
      name: 'template-app',
      scripts: {
        'create-seed:setup': 'tsx scripts/setup.ts',
        dev: 'vite',
        setup: 'node setup.mjs',
      },
    })

    expect(
      buildFinalNote({
        instructions: undefined,
        packageManager: 'pnpm',
        projectName: 'my-app',
        skipGit: false,
        skipInstall: true,
        targetDir,
      }),
    ).toBe(
      [
        'cd my-app',
        ['Install dependencies:', emphasize('pnpm install')].join('\n'),
        ['Run template setup:', emphasize('pnpm run create-seed:setup')].join('\n'),
        'pnpm run dev',
      ].join('\n\n'),
    )
  })
})
