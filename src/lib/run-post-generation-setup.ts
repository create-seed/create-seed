import { resolve } from 'node:path'
import type { PackageManager } from './detect-pm.ts'
import { execAsync } from './exec-async.ts'
import { isRecord, readPackageJson } from './package-json.ts'

export const POST_GENERATION_SETUP_SCRIPTS = ['create-seed:setup', 'setup'] as const

export type PostGenerationSetupScript = (typeof POST_GENERATION_SETUP_SCRIPTS)[number]

export type PostGenerationSetupResult =
  | { status: 'ran'; script: PostGenerationSetupScript }
  | { status: 'skipped'; reason: 'install-skipped' | 'package-json-missing' | 'script-missing' }
  | { status: 'failed'; script: PostGenerationSetupScript; message: string }

type ExecFn = typeof execAsync

export function selectPostGenerationSetupScript(pkg: Record<string, unknown>): PostGenerationSetupScript | undefined {
  const scripts = isRecord(pkg.scripts) ? pkg.scripts : undefined
  if (!scripts) {
    return undefined
  }

  return POST_GENERATION_SETUP_SCRIPTS.find((script) => typeof scripts[script] === 'string')
}

export async function runPostGenerationSetup(
  targetDir: string,
  pm: PackageManager | undefined,
  options: { exec?: ExecFn; installSkipped?: boolean; verbose?: boolean } = {},
): Promise<PostGenerationSetupResult> {
  if (options.installSkipped || !pm) {
    return { reason: 'install-skipped', status: 'skipped' }
  }

  const pkg = readPackageJson(resolve(targetDir, 'package.json'))
  if (!pkg) {
    return { reason: 'package-json-missing', status: 'skipped' }
  }

  const script = selectPostGenerationSetupScript(pkg)
  if (!script) {
    return { reason: 'script-missing', status: 'skipped' }
  }

  try {
    await (options.exec ?? execAsync)(pm, ['run', script], { cwd: targetDir, streamOutput: options.verbose })
    return { script, status: 'ran' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Warning: Failed to run post-generation setup script "${script}".`, error)
    return { message, script, status: 'failed' }
  }
}
