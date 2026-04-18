import { afterEach, describe, expect, mock, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import pico from 'picocolors'

describe('main', () => {
  const originalCwd = process.cwd()
  const originalDoNotTrack = process.env.DO_NOT_TRACK
  const originalPath = process.env.PATH
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

    if (originalPath === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = originalPath
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

  test('renders tool probe output for template authors', async () => {
    const toolPath = join(tmpDir, 'adb')
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

    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(toolPath, "#!/bin/sh\necho 'Android Debug Bridge version 1.0.41'\necho 'Version 37.0.0-14910828'\n")
    chmodSync(toolPath, 0o755)
    process.env.PATH = [tmpDir, originalPath].filter(Boolean).join(delimiter)

    const { main } = await import('../src/index.ts')

    await main([
      'bun',
      'create-seed',
      'tools',
      'probe',
      'adb',
      '--min',
      '37.0.0',
      '--pattern',
      'Version\\s+(\\d+\\.\\d+\\.\\d+)',
    ])

    expect(note).toHaveBeenCalledTimes(1)

    const [message, title] = note.mock.calls[0] as unknown as [string, string]
    expect(title).toBe('Tool probe')
    expect(message).toContain('Command: adb --version')
    expect(message).toContain('Status: ok')
    expect(message).toContain('Version source: pattern (Version\\s+(\\d+\\.\\d+\\.\\d+))')
    expect(message).toContain('Detected version-like tokens: 1.0.41, 37.0.0')
    expect(message).toContain('Parsed version: 37.0.0')
    expect(message).toContain('Requested minimum: 37.0.0')
    expect(message).toContain('Satisfies minimum: yes')
    expect(message).toContain(
      JSON.stringify(
        {
          tools: {
            adb: {
              minVersion: '37.0.0',
              versionPattern: 'Version\\s+(\\d+\\.\\d+\\.\\d+)',
            },
          },
        },
        null,
        2,
      ),
    )
    expect(message).toContain('Android Debug Bridge version 1.0.41')
    expect(message).toContain('Version 37.0.0-14910828')
  })

  test('reports invalid template tools cleanly during registry generation', async () => {
    const error = mock(() => {})
    const exit = mock((code?: number) => {
      throw new Error(`exit:${code ?? 0}`)
    })
    const outro = mock(() => {})

    mock.module('@clack/prompts', () => ({
      cancel: mock(() => {}),
      confirm: mock(async () => false),
      intro: mock(() => {}),
      isCancel: () => false,
      log: {
        error,
        message: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
      },
      note: mock(() => {}),
      outro,
      select: mock(async () => ''),
      spinner: () => ({
        start() {},
        stop() {},
      }),
      text: mock(async () => ''),
    }))

    const originalExit = process.exit
    const templateDir = join(tmpDir, 'template')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(
      join(templateDir, 'package.json'),
      JSON.stringify({
        'create-seed': {
          tools: {
            solana: '3.0',
          },
        },
        name: 'template',
      }),
    )

    process.exit = exit as typeof process.exit

    try {
      const { main } = await import('../src/index.ts')

      await expect(main(['bun', 'create-seed', 'registry', 'generate', '--dir', tmpDir])).rejects.toThrow('exit:1')
    } finally {
      process.exit = originalExit
    }

    expect(error).toHaveBeenCalledWith(
      `Invalid create-seed.tools in template "template" (${join(templateDir, 'package.json')}); tools.solana: Expected a version like "1.2.3"`,
    )
    expect(outro).toHaveBeenCalledWith('Generation failed')
  })
})
