import { afterEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installDeps } from '../src/lib/install-deps.ts'

describe('installDeps', () => {
  let root = ''

  afterEach(() => {
    mock.restore()

    if (root && existsSync(root)) {
      rmSync(root, { force: true, recursive: true })
    }
  })

  test('streams install output when verbose is enabled', async () => {
    root = mkdtempSync(join(tmpdir(), 'install-deps-test-'))
    writeFileSync(join(root, 'package-lock.json'), '')
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')

    const exec = mock(async () => {})
    const originalUserAgent = process.env.npm_config_user_agent
    process.env.npm_config_user_agent = 'npm/10.0.0'

    try {
      const pm = await installDeps(root, 'npm', { exec, verbose: true })

      expect(pm).toBe('npm')
      expect(exec).toHaveBeenCalledTimes(1)
      expect(exec).toHaveBeenCalledWith('npm', ['install'], {
        cwd: root,
        env: {
          ...process.env,
          npm_config_user_agent: undefined,
        },
        shell: true,
        streamOutput: true,
      })
      expect(existsSync(join(root, 'pnpm-lock.yaml'))).toBeFalse()
      expect(readFileSync(join(root, 'package-lock.json'), 'utf-8')).toBe('')
    } finally {
      if (originalUserAgent === undefined) {
        delete process.env.npm_config_user_agent
      } else {
        process.env.npm_config_user_agent = originalUserAgent
      }
    }
  })
})
