import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PackageManager } from './detect-pm.ts'
import { execAsync } from './exec-async.ts'

export const POST_GENERATION_FIX_SCRIPTS = ['create-seed:fix', 'lint:fix', 'format'] as const

export type PostGenerationFixScript = (typeof POST_GENERATION_FIX_SCRIPTS)[number]

export type PostGenerationFixResult =
  | { status: 'ran'; script: PostGenerationFixScript }
  | { status: 'skipped'; reason: 'install-skipped' | 'package-json-missing' | 'script-missing' }
  | { status: 'failed'; script: PostGenerationFixScript; message: string }

interface PackageJsonLike {
  scripts?: Record<string, unknown>
}

type ExecFn = typeof execAsync

export function selectPostGenerationFixScript(pkg: PackageJsonLike): PostGenerationFixScript | undefined {
  const scripts = pkg.scripts
  if (!scripts) {
    return undefined
  }

  return POST_GENERATION_FIX_SCRIPTS.find((script) => typeof scripts[script] === 'string')
}

export async function runPostGenerationFix(
  targetDir: string,
  pm: PackageManager | undefined,
  options: { exec?: ExecFn; installSkipped?: boolean; verbose?: boolean } = {},
): Promise<PostGenerationFixResult> {
  if (options.installSkipped || !pm) {
    return { reason: 'install-skipped', status: 'skipped' }
  }

  let pkg: PackageJsonLike

  try {
    const packageJson = await readFile(resolve(targetDir, 'package.json'), 'utf-8')
    const parsedPkg = JSON.parse(packageJson)
    if (typeof parsedPkg !== 'object' || parsedPkg === null) {
      return { reason: 'package-json-missing', status: 'skipped' }
    }
    pkg = parsedPkg as PackageJsonLike
  } catch {
    return { reason: 'package-json-missing', status: 'skipped' }
  }

  const script = selectPostGenerationFixScript(pkg)
  if (!script) {
    return { reason: 'script-missing', status: 'skipped' }
  }

  try {
    await (options.exec ?? execAsync)(pm, ['run', script], { cwd: targetDir, streamOutput: options.verbose })
    return { script, status: 'ran' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Warning: Failed to run post-generation fix script "${script}".`, error)
    return { message, script, status: 'failed' }
  }
}
