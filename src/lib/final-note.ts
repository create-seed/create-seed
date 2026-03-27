import { resolve } from 'node:path'
import pico from 'picocolors'
import type { PackageManager } from './detect-pm.ts'
import { isRecord, readPackageJson } from './package-json.ts'
import { selectPostGenerationSetupScript } from './run-post-generation-setup.ts'

const BLANK_LINE = Symbol('blank-line')
const START_SCRIPTS = ['dev', 'start', 'build'] as const
type FormattedInstruction = string | typeof BLANK_LINE

export interface FinalNoteArgs {
  instructions: string[] | undefined
  packageManager: PackageManager
  projectName: string
  skipGit: boolean
  skipInstall: boolean
  targetDir: string
}

function emphasize(message: string): string {
  return pico.bold(pico.white(message))
}

function findRunScript(scripts: Record<string, unknown> | undefined): string | undefined {
  return START_SCRIPTS.find((script) => typeof scripts?.[script] === 'string')
}

function formatInstruction(instruction: string, packageManager: PackageManager): FormattedInstruction | undefined {
  const line = instruction.trim()

  if (!line) {
    return undefined
  }

  if (line === '~') {
    return BLANK_LINE
  }

  const formattedLine = line.replaceAll('{pm}', packageManager)

  if (formattedLine.startsWith('+')) {
    const emphasizedLine = formattedLine.slice(1).trimStart()
    return emphasizedLine ? emphasize(emphasizedLine) : undefined
  }

  return formattedLine
}

export function buildFinalNote(args: FinalNoteArgs): string {
  const sections = [`cd ${args.projectName}`]
  const pkg = readPackageJson(resolve(args.targetDir, 'package.json'))
  const scripts = isRecord(pkg?.scripts) ? pkg.scripts : undefined
  const runScript = findRunScript(scripts)
  const setupScript = pkg ? selectPostGenerationSetupScript(pkg) : undefined
  const customInstructions = (args.instructions ?? [])
    .map((instruction) => formatInstruction(instruction, args.packageManager))
    .filter((instruction): instruction is FormattedInstruction => instruction !== undefined)
    .map((instruction) => (instruction === BLANK_LINE ? '' : instruction))

  if (args.skipGit) {
    sections.push(
      [
        'Initialize git and create the initial commit:',
        emphasize('git init -b main'),
        emphasize('git add .'),
        emphasize('git commit -m "chore: initial commit"'),
      ].join('\n'),
    )
  }

  if (args.skipInstall) {
    sections.push(['Install dependencies:', emphasize(`${args.packageManager} install`)].join('\n'))

    if (setupScript) {
      sections.push(['Run template setup:', emphasize(`${args.packageManager} run ${setupScript}`)].join('\n'))
    }
  }

  if (customInstructions.length > 0) {
    sections.push(customInstructions.join('\n'))
  } else if (runScript) {
    sections.push(`${args.packageManager} run ${runScript}`)
  }

  return sections.join('\n\n')
}
