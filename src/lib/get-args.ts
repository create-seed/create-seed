import { Command } from 'commander'
import { getAppInfo } from './get-app-info.ts'
import { getTemplatesUrl } from './get-templates.ts'

export interface Args {
  allowMissingTools: boolean
  command: 'create' | 'registry-generate' | 'registry-validate' | 'tools-probe'
  dryRun: boolean
  list: boolean
  name: string | undefined
  pm: string | undefined
  probeArgs?: string[]
  probeJson?: boolean
  probeMinVersion?: string
  probePresenceOnly?: boolean
  probeTool?: string
  probeVersionPattern?: string
  registryDir: string
  skipGit: boolean
  skipInstall: boolean
  template: string | undefined
  templatesUrl: string
  verbose: boolean
}

/** Args after prompts have resolved all required fields */
export interface ResolvedArgs extends Args {
  name: string
  template: string
}

export function getArgs(argv: string[]): Args {
  const { name, version } = getAppInfo()
  const program = new Command()

  let result: Args | undefined

  const defaults: Omit<Args, 'command' | 'registryDir'> = {
    allowMissingTools: false,
    dryRun: false,
    list: false,
    name: undefined,
    pm: undefined,
    skipGit: false,
    skipInstall: false,
    template: undefined,
    templatesUrl: getTemplatesUrl(),
    verbose: false,
  }

  program.name(name).description('Scaffold a new project from a template').version(version)

  // Default command (create)
  program
    .argument('[name]', 'Project name')
    .option(
      '-t, --template <template>',
      'Template to use (gh:owner/repo/path, https://github.com/owner/repo/tree/ref/path, or local path)',
    )
    .option('--pm <pm>', 'Package manager (npm|pnpm|bun, default: auto-detect)')
    .option('--allow-missing-tools', 'Continue when create-seed.tools commands are not installed', false)
    .option('--skip-git', 'Skip git initialization', false)
    .option('--skip-install', 'Skip installing dependencies', false)
    .option('-l, --list', 'List available templates', false)
    .option('--templates-url <url>', 'URL or local path to templates.json', getTemplatesUrl())
    .option('-d, --dry-run', 'Dry run', false)
    .option('-v, --verbose', 'Verbose output', false)
    .action((_name, opts) => {
      result = {
        ...defaults,
        allowMissingTools: opts.allowMissingTools,
        command: 'create',
        dryRun: opts.dryRun,
        list: opts.list,
        name: program.args[0],
        pm: opts.pm,
        registryDir: '.',
        skipGit: opts.skipGit,
        skipInstall: opts.skipInstall,
        template: opts.template,
        templatesUrl: opts.templatesUrl,
        verbose: opts.verbose,
      }
    })

  // Registry command group
  const registry = program.command('registry').description('Manage template registries')

  registry
    .command('generate')
    .description('Scan templates and generate templates.json')
    .option('--dir <dir>', 'Directory to scan', '.')
    .action((opts) => {
      result = { ...defaults, command: 'registry-generate', registryDir: opts.dir }
    })

  registry
    .command('validate')
    .description('Validate templates.json against actual templates')
    .option('--dir <dir>', 'Directory containing templates.json', '.')
    .action((opts) => {
      result = { ...defaults, command: 'registry-validate', registryDir: opts.dir }
    })

  const tools = program.command('tools').description('Inspect tool versions used by template requirements')

  tools
    .command('probe <tool>')
    .description('Probe a tool command the same way create-seed.tools does')
    .option('--arg <value>', 'Add an argument to the probe command (repeatable)', collectOption, [])
    .option('--json', 'Output the probe result as JSON', false)
    .option('--min <version>', 'Check whether the extracted version satisfies a minimum like 1.2.3')
    .option('--pattern <regex>', 'Use a custom regular expression with one capture group to extract the version')
    .option('--presence-only', 'Only verify that the command exists and the probe command succeeds', false)
    .action((tool, opts) => {
      result = {
        ...defaults,
        command: 'tools-probe',
        probeArgs: opts.arg.length > 0 ? opts.arg : undefined,
        probeJson: opts.json,
        probeMinVersion: opts.min,
        probePresenceOnly: opts.presenceOnly,
        probeTool: tool,
        probeVersionPattern: opts.pattern,
        registryDir: '.',
      }
    })

  program.parse(argv)

  if (!result) {
    result = { ...defaults, command: 'create', registryDir: '.' }
  }

  return result
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value]
}
