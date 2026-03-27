import { afterEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pico from 'picocolors'

describe('main', () => {
  const originalCwd = process.cwd()
  const originalDoNotTrack = process.env.DO_NOT_TRACK
  const originalUserAgent = process.env.npm_config_user_agent
  const tmpDir = join(import.meta.dirname, 'fixtures', 'tmp-main')

  afterEach(() => {
    mock.restore()

    process.chdir(originalCwd)

    if (originalDoNotTrack === undefined) {
      delete process.env.DO_NOT_TRACK
    } else {
      process.env.DO_NOT_TRACK = originalDoNotTrack
    }

    if (originalUserAgent === undefined) {
      delete process.env.npm_config_user_agent
    } else {
      process.env.npm_config_user_agent = originalUserAgent
    }

    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true })
    }
  })

  function setupTemplate(
    pkg: Record<string, unknown> = {},
    scripts: Record<string, unknown> = { dev: 'vite' },
  ): string {
    const templateDir = join(tmpDir, 'template')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify(
        {
          ...pkg,
          name: 'template-app',
          scripts,
          version: '1.0.0',
        },
        null,
        2,
      ),
    )
    writeFileSync(join(templateDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')

    return templateDir
  }

  test('uses the cloned template lockfile for next steps', async () => {
    process.env.DO_NOT_TRACK = '1'
    process.env.npm_config_user_agent = 'npm/10.0.0'

    const note = mock(() => {})

    mock.module('@clack/prompts', () => ({
      cancel: mock(() => {}),
      confirm: mock(async () => false),
      intro: mock(() => {}),
      isCancel: () => false,
      log: {
        error: mock(() => {}),
        message: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
      },
      note,
      outro: mock(() => {}),
      select: mock(async () => ''),
      spinner: () => ({
        start() {},
        stop() {},
      }),
      text: mock(async () => ''),
    }))

    const templateDir = setupTemplate()
    process.chdir(tmpDir)

    const { main } = await import('../src/index.ts')

    await main(['bun', 'create-seed', 'my-app', '--skip-git', '--skip-install', '--template', templateDir])

    expect(note).toHaveBeenCalledWith(
      [
        'cd my-app',
        [
          'Initialize git and create the initial commit:',
          pico.bold(pico.white('git init -b main')),
          pico.bold(pico.white('git add .')),
          pico.bold(pico.white('git commit -m "chore: initial commit"')),
        ].join('\n'),
        ['Install dependencies:', pico.bold(pico.white('pnpm install'))].join('\n'),
        'pnpm run dev',
      ].join('\n\n'),
      'Next steps',
    )
  })

  test('renders extracted custom instructions and removes create-seed metadata from the scaffolded app', async () => {
    process.env.DO_NOT_TRACK = '1'
    process.env.npm_config_user_agent = 'bun/1.0.0'

    const note = mock(() => {})

    mock.module('@clack/prompts', () => ({
      cancel: mock(() => {}),
      confirm: mock(async () => false),
      intro: mock(() => {}),
      isCancel: () => false,
      log: {
        error: mock(() => {}),
        message: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
      },
      note,
      outro: mock(() => {}),
      select: mock(async () => ''),
      spinner: () => ({
        start() {},
        stop() {},
      }),
      text: mock(async () => ''),
    }))

    const templateDir = setupTemplate({
      'create-seed': {
        instructions: ['Open the simulator:', '+{pm} run ios'],
      },
    })
    process.chdir(tmpDir)

    const { main } = await import('../src/index.ts')

    await main(['bun', 'create-seed', 'my-app', '--skip-git', '--skip-install', '--template', templateDir])

    expect(note).toHaveBeenCalledWith(
      [
        'cd my-app',
        [
          'Initialize git and create the initial commit:',
          pico.bold(pico.white('git init -b main')),
          pico.bold(pico.white('git add .')),
          pico.bold(pico.white('git commit -m "chore: initial commit"')),
        ].join('\n'),
        ['Install dependencies:', pico.bold(pico.white('pnpm install'))].join('\n'),
        `Open the simulator:\n${pico.bold(pico.white('pnpm run ios'))}`,
      ].join('\n\n'),
      'Next steps',
    )

    const generatedPackageJson = JSON.parse(readFileSync(join(tmpDir, 'my-app', 'package.json'), 'utf-8'))
    expect(generatedPackageJson['create-seed']).toBeUndefined()
  })

  test('renders extracted spacer instructions in next steps', async () => {
    process.env.DO_NOT_TRACK = '1'
    process.env.npm_config_user_agent = 'bun/1.0.0'

    const note = mock(() => {})

    mock.module('@clack/prompts', () => ({
      cancel: mock(() => {}),
      confirm: mock(async () => false),
      intro: mock(() => {}),
      isCancel: () => false,
      log: {
        error: mock(() => {}),
        message: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
      },
      note,
      outro: mock(() => {}),
      select: mock(async () => ''),
      spinner: () => ({
        start() {},
        stop() {},
      }),
      text: mock(async () => ''),
    }))

    const templateDir = setupTemplate({
      'create-seed': {
        instructions: ['+{pm} run db:start', '~', 'Your database is now up and running and you can start your app'],
      },
    })
    process.chdir(tmpDir)

    const { main } = await import('../src/index.ts')

    await main(['bun', 'create-seed', 'my-app', '--skip-git', '--skip-install', '--template', templateDir])

    expect(note).toHaveBeenCalledWith(
      [
        'cd my-app',
        [
          'Initialize git and create the initial commit:',
          pico.bold(pico.white('git init -b main')),
          pico.bold(pico.white('git add .')),
          pico.bold(pico.white('git commit -m "chore: initial commit"')),
        ].join('\n'),
        ['Install dependencies:', pico.bold(pico.white('pnpm install'))].join('\n'),
        `${pico.bold(pico.white('pnpm run db:start'))}\n\nYour database is now up and running and you can start your app`,
      ].join('\n\n'),
      'Next steps',
    )
  })

  test('shows the manual setup step in next steps when install is skipped', async () => {
    process.env.DO_NOT_TRACK = '1'
    process.env.npm_config_user_agent = 'pnpm/10.0.0'

    const note = mock(() => {})

    mock.module('@clack/prompts', () => ({
      cancel: mock(() => {}),
      confirm: mock(async () => false),
      intro: mock(() => {}),
      isCancel: () => false,
      log: {
        error: mock(() => {}),
        message: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
      },
      note,
      outro: mock(() => {}),
      select: mock(async () => ''),
      spinner: () => ({
        start() {},
        stop() {},
      }),
      text: mock(async () => ''),
    }))

    const templateDir = setupTemplate(
      {},
      {
        'create-seed:setup': 'tsx scripts/setup.ts',
        dev: 'vite',
      },
    )
    process.chdir(tmpDir)

    const { main } = await import('../src/index.ts')

    await main(['bun', 'create-seed', 'my-app', '--skip-git', '--skip-install', '--template', templateDir])

    expect(note).toHaveBeenCalledWith(
      [
        'cd my-app',
        [
          'Initialize git and create the initial commit:',
          pico.bold(pico.white('git init -b main')),
          pico.bold(pico.white('git add .')),
          pico.bold(pico.white('git commit -m "chore: initial commit"')),
        ].join('\n'),
        ['Install dependencies:', pico.bold(pico.white('pnpm install'))].join('\n'),
        ['Run template setup:', pico.bold(pico.white('pnpm run create-seed:setup'))].join('\n'),
        'pnpm run dev',
      ].join('\n\n'),
      'Next steps',
    )
  })
})
