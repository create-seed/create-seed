import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import { createApp } from './lib/create-app.ts'
import { detectPm } from './lib/detect-pm.ts'
import { buildFinalNote } from './lib/final-note.ts'
import { getAppInfo } from './lib/get-app-info.ts'
import { getArgs } from './lib/get-args.ts'
import { getTemplates, type Template } from './lib/get-templates.ts'
import { isNoDna } from './lib/is-no-dna.ts'
import { type ProbeToolOptions, probeTool } from './lib/probe-tool.ts'
import { generateReadme, generateRegistry, validateRegistry, writeReadme, writeRegistry } from './lib/registry.ts'
import { trackEvent } from './lib/telemetry.ts'
import { validateTemplate } from './lib/validate-template.ts'

export { getAppInfo }

const CUSTOM_TEMPLATE = '__custom__'

async function promptText(options: Parameters<typeof p.text>[0]): Promise<string> {
  const value = await p.text(options)
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }
  return value.trim()
}

function promptName(): Promise<string> {
  return promptText({
    message: 'Project name',
    placeholder: 'my-app',
    validate: (v = '') => {
      if (!v.trim()) {
        return 'Project name is required'
      }
      if (/[^a-z0-9._-]/i.test(v.trim())) {
        return 'Invalid characters in project name'
      }
    },
  })
}

function promptCustomTemplate(): Promise<string> {
  return promptText({
    message: 'Template',
    placeholder: 'gh:owner/repo/path or https://github.com/owner/repo',
    validate: (v = '') => {
      if (!v.trim()) {
        return 'Template is required'
      }
    },
  })
}

async function promptTemplate(templates: Template[]): Promise<string> {
  if (templates.length === 0) {
    return promptCustomTemplate()
  }

  const value = await p.select({
    message: 'Select a template',
    options: [
      ...templates.map((t) => ({
        hint: t.description,
        label: t.name,
        value: t.id,
      })),
      { hint: 'Enter a custom template path', label: 'Custom', value: CUSTOM_TEMPLATE },
    ],
  })

  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  if (value === CUSTOM_TEMPLATE) {
    return promptCustomTemplate()
  }

  return value
}

async function fetchTemplatesSafe(url: string): Promise<Template[]> {
  try {
    return await getTemplates(url)
  } catch {
    return []
  }
}

function formatTemplateList(templates: Template[]): string {
  const maxName = Math.max(...templates.map((t) => t.name.length))
  const pad = maxName + 2
  return templates.map((t) => `  ${t.name.padEnd(pad)} ${t.description}`).join('\n')
}

async function registryGenerate(dir: string): Promise<void> {
  const { name, version } = getAppInfo()
  p.intro(`${name} ${version}`)

  const root = resolve(dir)
  let registry: ReturnType<typeof generateRegistry>

  try {
    registry = generateRegistry(root)
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error))
    p.outro('Generation failed')
    process.exit(1)
  }

  if (registry.templates.length === 0) {
    p.log.warn('No templates found. Make sure subdirectories contain a package.json.')
    p.outro('No templates.json generated.')
    return
  }

  const registryPath = writeRegistry(root, registry)
  const readmeContent = generateReadme(root, registry)
  const readmePath = writeReadme(root, readmeContent)

  p.log.success(`Found ${registry.templates.length} template(s)`)
  for (const t of registry.templates) {
    p.log.message(`  ${t.name} — ${t.description || '(no description)'}`)
  }
  p.note(`${registryPath}\n${readmePath}`, 'Files written')
  p.outro('Done!')
}

async function registryValidate(dir: string, options: { failOnWarning?: boolean } = {}): Promise<void> {
  const { name, version } = getAppInfo()
  p.intro(`${name} ${version}`)

  const root = resolve(dir)
  const errors = validateRegistry(root)

  let errorCount = 0
  let warningCount = 0

  for (const e of errors) {
    if (e.type === 'error') {
      errorCount++
      p.log.error(e.message)
    } else {
      warningCount++
      p.log.warn(e.message)
    }
  }

  if (errorCount > 0 || (options.failOnWarning && warningCount > 0)) {
    p.outro(`Validation failed: ${errorCount} error(s), ${warningCount} warning(s)`)
    process.exit(1)
  }

  if (warningCount > 0) {
    p.outro(`Validation passed with ${warningCount} warning(s)`)
    return
  }

  p.log.success('templates.json is valid')
  p.outro('All checks passed')
}

function formatTemplateConfig(config: unknown): string {
  return config ? JSON.stringify(config, null, 2) : '(none)'
}

async function templateValidate(dir: string): Promise<void> {
  const { name, version } = getAppInfo()
  p.intro(`${name} ${version}`)

  const result = validateTemplate(dir)

  if (!result.valid) {
    p.log.error(result.error ?? 'Template validation failed')
    p.outro('Validation failed')
    process.exit(1)
  }

  p.note(
    [
      `Directory: ${result.dir}`,
      `Package: ${result.packageJsonPath}`,
      `create-seed:\n${formatTemplateConfig(result.config)}`,
    ].join('\n\n'),
    'Template metadata',
  )
  p.log.success('Template create-seed metadata is valid')
  p.outro('All checks passed')
}

function formatProbeCommand(command: string, args: string[]): string {
  return [command, ...args].join(' ')
}

function formatProbeResult(
  tool: string,
  options: ProbeToolOptions,
  result: Awaited<ReturnType<typeof probeTool>>,
): string {
  const lines = [
    `Command: ${formatProbeCommand(tool, result.args)}`,
    `Status: ${result.status}`,
    `Version source: ${result.versionSource}${result.versionPattern ? ` (${result.versionPattern})` : ''}`,
    `Detected version-like tokens: ${result.detectedVersions.length > 0 ? result.detectedVersions.join(', ') : '(none)'}`,
    `Parsed version: ${result.version ?? '(none)'}`,
  ]

  if (options.presenceOnly) {
    lines.push('Presence only: yes')
  }

  if (options.minVersion) {
    lines.push(`Requested minimum: ${options.minVersion}`)
    lines.push(
      `Satisfies minimum: ${result.satisfiesMinVersion === undefined ? 'unknown' : result.satisfiesMinVersion ? 'yes' : 'no'}`,
    )
  }

  lines.push(
    `Suggested config:\n${result.suggestedConfig ? JSON.stringify(result.suggestedConfig, null, 2) : '(none)'}`,
  )
  lines.push(`Raw output:\n${result.output || '(no output)'}`)

  return lines.join('\n\n')
}

async function toolsProbe(
  tool: string,
  options: ProbeToolOptions & {
    json?: boolean
  },
): Promise<void> {
  const { name, version } = getAppInfo()

  if (!options.json) {
    p.intro(`${name} ${version}`)
  }

  const result = await probeTool(tool, options)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    p.note(formatProbeResult(tool, options, result), 'Tool probe')
  }

  if (result.status === 'missing') {
    if (!options.json) {
      p.outro(`Probe failed: \`${tool}\` is not installed`)
    }
    process.exit(1)
  }

  if (result.status === 'probe-failed') {
    if (!options.json) {
      p.outro(`Probe failed: \`${formatProbeCommand(tool, result.args)}\` exited unsuccessfully`)
    }
    process.exit(1)
  }

  if (result.status === 'unparseable') {
    if (!options.json) {
      p.outro(`Probe failed: could not extract a comparable version from \`${formatProbeCommand(tool, result.args)}\``)
    }
    process.exit(1)
  }

  if (options.minVersion && result.satisfiesMinVersion === false) {
    if (!options.json) {
      p.outro(`Probe complete: \`${tool}\` does not satisfy ${options.minVersion}`)
    }
    process.exit(1)
  }

  if (!options.json) {
    p.outro('Done!')
  }
}

export async function main(argv: string[]): Promise<void> {
  const args = getArgs(argv)

  if (args.command === 'registry-generate') {
    return registryGenerate(args.registryDir)
  }

  if (args.command === 'registry-validate') {
    return registryValidate(args.registryDir, { failOnWarning: args.registryFailOnWarning })
  }

  if (args.command === 'template-validate') {
    return templateValidate(args.templateDir ?? '.')
  }

  if (args.command === 'tools-probe') {
    return toolsProbe(args.probeTool ?? '', {
      args: args.probeArgs,
      json: args.probeJson,
      minVersion: args.probeMinVersion,
      presenceOnly: args.probePresenceOnly,
      versionPattern: args.probeVersionPattern,
    })
  }

  const { name, version } = getAppInfo()

  p.intro(`${name} ${version}`)

  // Handle --list
  if (args.list) {
    try {
      const templates = await getTemplates(args.templatesUrl)
      if (templates.length === 0) {
        p.log.warn('No templates found.')
      } else {
        p.note(formatTemplateList(templates), 'Available templates')
      }
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : String(error))
    }
    p.outro(`Use: ${name} <project> -t <template-name-or-repo>`)
    return
  }

  const noDna = isNoDna()

  if (noDna) {
    const errors: string[] = []

    if (!args.name) {
      errors.push('project name is required (pass as positional argument).')
    }

    if (!args.template) {
      errors.push('template is required (pass with --template).')
    }

    if (errors.length > 0) {
      p.log.error('NO_DNA is set, but required arguments are missing.')
      for (const error of errors) {
        p.log.message(`- ${error}`)
      }
      process.exit(1)
    }
  }

  const projectName = args.name ?? (await promptName())

  // Resolve template: CLI arg, or interactive select from registry
  let template = args.template
  if (!template) {
    const templates = await fetchTemplatesSafe(args.templatesUrl)
    template = await promptTemplate(templates)
  }

  const targetDir = resolve(projectName)
  const cwd = resolve('.')
  const safePrefix = resolve(cwd, 'a').replace(/a$/, '')

  if (targetDir === cwd || !targetDir.startsWith(safePrefix)) {
    p.cancel(`Invalid project name: "${projectName}" would target files outside the current directory.`)
    process.exit(1)
  }

  if (existsSync(targetDir)) {
    if (noDna) {
      p.log.error(`NO_DNA is set: target directory already exists: "${projectName}".`)
      process.exit(1)
    }

    const overwrite = await p.confirm({
      initialValue: false,
      message: `Directory "${projectName}" already exists. Overwrite?`,
    })
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    rmSync(targetDir, { recursive: true })
  }

  if (args.dryRun) {
    p.note(
      [
        `Name:       ${projectName}`,
        `Template:   ${template}`,
        `Target:     ${targetDir}`,
        `PM:         ${args.pm ?? 'auto-detect'}`,
        `Allow missing tools: ${args.allowMissingTools}`,
        `Skip git:   ${args.skipGit}`,
        `Skip install: ${args.skipInstall}`,
      ].join('\n'),
      'Dry run',
    )
    p.outro('Dry run complete — no files were created.')
    return
  }

  const telemetryData = {
    pm: args.pm ?? detectPm(),
    skipGit: args.skipGit,
    skipInstall: args.skipInstall,
    template,
    version,
  }

  let createAppResult: Awaited<ReturnType<typeof createApp>> | undefined

  try {
    createAppResult = await createApp({ args: { ...args, name: projectName, template }, targetDir })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await trackEvent({ data: { ...telemetryData, error: message }, event: 'create-failed' })
    p.cancel(`Failed: ${message}`)
    if (args.verbose && error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }

  await trackEvent({ data: telemetryData, event: 'create' })

  p.note(
    buildFinalNote({
      instructions: createAppResult?.instructions,
      packageManager: detectPm(args.pm, targetDir),
      projectName,
      skipGit: args.skipGit,
      skipInstall: args.skipInstall,
      targetDir,
    }),
    'Next steps',
  )

  p.outro('Done! 🌱')
}
