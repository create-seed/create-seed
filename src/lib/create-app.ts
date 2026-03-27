import { relative } from 'node:path'
import * as p from '@clack/prompts'
import { cloneTemplate } from './clone-template.ts'
import type { PackageManager } from './detect-pm.ts'
import { findTemplate } from './find-template.ts'
import type { ResolvedArgs } from './get-args.ts'
import { commitGitRepo, initGitRepo } from './init-git.ts'
import { installDeps } from './install-deps.ts'
import { renameReferences } from './rename-references.ts'
import { rewritePackageJson } from './rewrite-package-json.ts'
import { runPostGenerationFix } from './run-post-generation-fix.ts'
import { runPostGenerationSetup } from './run-post-generation-setup.ts'

export interface CreateAppOptions {
  args: ResolvedArgs
  targetDir: string
}

export interface CreateAppResult {
  instructions: string[] | undefined
}

async function runStep(title: string, fn: () => Promise<string>): Promise<void> {
  const s = p.spinner()
  s.start(title)
  try {
    const message = await fn()
    s.stop(message)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    s.stop(`${title} — failed`)
    throw new Error(`${title}: ${msg}`, { cause: error })
  }
}

export async function createApp({ args, targetDir }: CreateAppOptions): Promise<CreateAppResult> {
  let template: Awaited<ReturnType<typeof findTemplate>>
  let instructions: string[] | undefined

  await runStep('Resolving template', async () => {
    template = await findTemplate(args.template)
    return `Template resolved to ${template.id}`
  })

  await runStep('Cloning template', async () => {
    await cloneTemplate(template, targetDir)
    return 'Template cloned'
  })

  let originalName: string | undefined
  let newName: string

  await runStep('Rewriting package.json', async () => {
    const result = await rewritePackageJson(targetDir, args.name)
    instructions = result.instructions
    originalName = result.originalName
    newName = result.newName
    return 'Package configured'
  })

  await runStep('Renaming references', async () => {
    if (!originalName || originalName === newName) {
      return 'Skipped — no rename needed'
    }
    const { count, files } = await renameReferences(targetDir, [originalName], newName)
    if (args.verbose && files.length > 0) {
      const relativePaths = files.map((f) => relative(targetDir, f))
      p.note(relativePaths.join('\n'), `${originalName} → ${newName}`)
    }
    return `Renamed in ${count} file${count === 1 ? '' : 's'} (${originalName} → ${newName})`
  })

  // Git init must happen before install so prepare scripts (e.g. lefthook) can find the repo
  if (!args.skipGit) {
    await runStep('Initializing git repository', async () => {
      const result = await initGitRepo(targetDir)
      return result === 'skipped' ? 'Skipped — git not found' : 'Git initialized'
    })
  }

  let selectedPm: PackageManager | undefined

  if (!args.skipInstall) {
    await runStep('Installing dependencies', async () => {
      selectedPm = await installDeps(targetDir, args.pm)
      return `Installed with ${selectedPm}`
    })
  }

  await runStep('Running post-generation setup script', async () => {
    const result = await runPostGenerationSetup(targetDir, selectedPm, { installSkipped: args.skipInstall })
    switch (result.status) {
      case 'ran':
        return `Ran \`${result.script}\``
      case 'failed':
        return `\`${result.script}\` failed (see warning)`
      case 'skipped':
        switch (result.reason) {
          case 'install-skipped':
            return 'Skipped — install was skipped'
          case 'package-json-missing':
            return 'Skipped — package.json not found or invalid'
          case 'script-missing':
            return 'Skipped — no matching setup script found'
        }
    }
  })

  await runStep('Running post-generation fix script', async () => {
    const result = await runPostGenerationFix(targetDir, selectedPm, { installSkipped: args.skipInstall })
    switch (result.status) {
      case 'ran':
        return `Ran \`${result.script}\``
      case 'failed':
        return `\`${result.script}\` failed (see warning)`
      case 'skipped':
        switch (result.reason) {
          case 'install-skipped':
            return 'Skipped — install was skipped'
          case 'package-json-missing':
            return 'Skipped — package.json not found or invalid'
          case 'script-missing':
            return 'Skipped — no matching fix script found'
        }
    }
  })

  if (!args.skipGit) {
    await runStep('Creating initial commit', async () => {
      const result = await commitGitRepo(targetDir)
      return result === 'skipped' ? 'Skipped — git not found' : 'Initial commit created'
    })
  }

  return { instructions }
}
