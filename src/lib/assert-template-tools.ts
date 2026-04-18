import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import {
  CREATE_SEED_TOOLS_VERSION_PATTERN,
  type CreateSeedToolRequirement,
  INVALID_CREATE_SEED_TOOLS_MESSAGE,
  parsePackageCreateSeedTools,
} from './create-seed-config.ts'
import { readPackageJson } from './package-json.ts'

const FIRST_SEMVER_PATTERN = /(?:^|[^0-9A-Za-z])v?(\d+\.\d+\.\d+)\b/
const GLOBAL_SEMVER_PATTERN = /(?:^|[^0-9A-Za-z])v?(\d+\.\d+\.\d+)\b/g
const SOLANA_INSTALL_URL = 'https://solana.com/docs/intro/installation'

interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

interface ToolProbeSpec {
  args?: string[]
  command: string
  versionPattern?: string
}

type ToolRequirementFailure =
  | { name: string; requirement: CreateSeedToolRequirement; type: 'below-min'; version: string }
  | { name: string; requirement: CreateSeedToolRequirement; type: 'missing' }
  | { name: string; requirement: CreateSeedToolRequirement; output: string; type: 'probe-failed' | 'unparseable' }

type ToolVersionProbeResult =
  | { ok: true; output: string }
  | { ok: false; output: string; type: 'missing' | 'probe-failed' }

export type ToolVersionProbe = (command: string, args: string[]) => Promise<ToolVersionProbeResult>

export interface AssertTemplateToolsResult {
  ignoredMissingTools: string[]
}

export interface ToolVersionInspectionResult {
  args: string[]
  command: string
  detectedVersions: string[]
  output: string
  status: 'missing' | 'ok' | 'probe-failed' | 'unparseable'
  version: string | undefined
  versionPattern?: string
  versionSource: 'heuristic' | 'pattern'
}

export function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) {
    return left.major - right.major
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor
  }
  return left.patch - right.patch
}

function ensureSentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`
}

function formatProbeCommand(requirement: CreateSeedToolRequirement): string {
  return [requirement.command, ...requirement.args].join(' ')
}

function formatHelpText(name: string, requirement: CreateSeedToolRequirement): string {
  const hints: string[] = []

  if (requirement.installHint) {
    hints.push(ensureSentence(requirement.installHint))
  }

  if (requirement.docsUrl) {
    hints.push(`See ${requirement.docsUrl}.`)
  }

  if (hints.length > 0) {
    return hints.join(' ')
  }

  if (name === 'solana') {
    return `Install or upgrade Solana CLI from ${SOLANA_INSTALL_URL}, then rerun create-seed.`
  }

  const probeCommand = formatProbeCommand(requirement)

  if (requirement.minVersion) {
    return `Install or upgrade ${name} so \`${probeCommand}\` reports at least ${requirement.minVersion}, then rerun create-seed.`
  }

  return `Install ${name} so \`${probeCommand}\` succeeds, then rerun create-seed.`
}

function formatToolFailure(failure: ToolRequirementFailure): string {
  const { name, requirement } = failure
  const label = requirement.minVersion ? `${name} >= ${requirement.minVersion}` : name
  const helpText = formatHelpText(name, requirement)
  const probeCommand = formatProbeCommand(requirement)

  switch (failure.type) {
    case 'below-min':
      return `Template requires ${label}. Detected ${failure.version}. ${helpText}`
    case 'missing':
      return `Template requires ${label}. \`${requirement.command}\` is not installed. ${helpText}`
    case 'probe-failed':
      return `Template requires ${label}. \`${probeCommand}\` failed${failure.output ? `: ${failure.output}` : '.'} ${helpText}`
    case 'unparseable':
      return `Template requires ${label}. \`${probeCommand}\` did not report a parseable version${failure.output ? `: ${failure.output}` : '.'} ${helpText}`
  }
}

function getValidToolRequirements(pkg: Record<string, unknown>): Record<string, CreateSeedToolRequirement> | undefined {
  const result = parsePackageCreateSeedTools(pkg)
  if (!result.valid) {
    throw new Error(
      `Invalid create-seed.tools in template package.json; ${result.error ?? INVALID_CREATE_SEED_TOOLS_MESSAGE}`,
    )
  }
  return result.tools
}

function normalizeVersionCandidate(value: string): string {
  const normalized = value.trim()

  if (normalized.startsWith('v') && CREATE_SEED_TOOLS_VERSION_PATTERN.test(normalized.slice(1))) {
    return normalized.slice(1)
  }

  return normalized
}

function readVersion(output: string, versionPattern?: string): string | undefined {
  if (versionPattern) {
    const match = output.match(new RegExp(versionPattern))
    const candidate = typeof match?.[1] === 'string' ? normalizeVersionCandidate(match[1]) : undefined
    return candidate && isValidToolVersion(candidate) ? candidate : undefined
  }

  return output.match(FIRST_SEMVER_PATTERN)?.[1]
}

export function parseVersion(version: string): ParsedVersion {
  const [major = '0', minor = '0', patch = '0'] = version.split('.')

  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
  }
}

export function isValidToolVersion(version: string): boolean {
  return CREATE_SEED_TOOLS_VERSION_PATTERN.test(version)
}

export function readVersions(output: string): string[] {
  GLOBAL_SEMVER_PATTERN.lastIndex = 0
  return Array.from(output.matchAll(GLOBAL_SEMVER_PATTERN), (match) => normalizeVersionCandidate(match[1] ?? ''))
}

export async function inspectToolVersion(
  spec: ToolProbeSpec,
  options: { probe?: ToolVersionProbe } = {},
): Promise<ToolVersionInspectionResult> {
  const args = spec.args ?? ['--version']
  const result = await (options.probe ?? probeToolVersion)(spec.command, args)
  const detectedVersions = readVersions(result.output)
  const versionSource = spec.versionPattern ? 'pattern' : 'heuristic'

  if (!result.ok) {
    return {
      args,
      command: spec.command,
      detectedVersions,
      output: result.output,
      status: result.type,
      version: undefined,
      versionPattern: spec.versionPattern,
      versionSource,
    }
  }

  const version = readVersion(result.output, spec.versionPattern)

  if (!version) {
    return {
      args,
      command: spec.command,
      detectedVersions,
      output: result.output,
      status: 'unparseable',
      version: undefined,
      versionPattern: spec.versionPattern,
      versionSource,
    }
  }

  return {
    args,
    command: spec.command,
    detectedVersions,
    output: result.output,
    status: 'ok',
    version,
    versionPattern: spec.versionPattern,
    versionSource,
  }
}

export async function assertTemplateTools(
  targetDir: string,
  options: { allowMissingTools?: boolean; probe?: ToolVersionProbe } = {},
): Promise<AssertTemplateToolsResult> {
  const pkg = readPackageJson(resolve(targetDir, 'package.json'))
  if (!pkg) {
    return { ignoredMissingTools: [] }
  }

  const tools = getValidToolRequirements(pkg)
  if (!tools) {
    return { ignoredMissingTools: [] }
  }

  const failures: ToolRequirementFailure[] = []
  const ignoredMissingTools: string[] = []

  for (const [name, requirement] of Object.entries(tools)) {
    const inspection = await inspectToolVersion(
      {
        args: requirement.args,
        command: requirement.command,
        versionPattern: requirement.versionPattern,
      },
      { probe: options.probe },
    )

    if (inspection.status === 'missing') {
      if (options.allowMissingTools) {
        ignoredMissingTools.push(name)
        continue
      }

      failures.push({ name, requirement, type: 'missing' })
      continue
    }

    if (inspection.status === 'probe-failed') {
      failures.push({ name, output: inspection.output, requirement, type: 'probe-failed' })
      continue
    }

    if (!requirement.minVersion) {
      continue
    }

    if (inspection.status === 'unparseable') {
      failures.push({ name, output: inspection.output, requirement, type: 'unparseable' })
      continue
    }

    const version = inspection.version

    if (!version) {
      failures.push({ name, output: inspection.output, requirement, type: 'unparseable' })
      continue
    }

    if (compareVersions(parseVersion(version), parseVersion(requirement.minVersion)) < 0) {
      failures.push({ name, requirement, type: 'below-min', version })
    }
  }

  if (failures.length === 0) {
    return { ignoredMissingTools }
  }

  const lines = failures.map((failure) => `- ${formatToolFailure(failure)}`)
  throw new Error(['Template tool requirements not met:', ...lines].join('\n'))
}

export async function probeToolVersion(command: string, args: string[]): Promise<ToolVersionProbeResult> {
  return new Promise<ToolVersionProbeResult>((resolvePromise) => {
    const chunks: Buffer[] = []
    let settled = false

    const finalize = (result: ToolVersionProbeResult) => {
      if (settled) {
        return
      }
      settled = true
      resolvePromise(result)
    }

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout?.on('data', (data) => {
      chunks.push(Buffer.from(data))
    })

    child.stderr?.on('data', (data) => {
      chunks.push(Buffer.from(data))
    })

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        finalize({ ok: false, output: '', type: 'missing' })
        return
      }

      finalize({
        ok: false,
        output: error.message.trim(),
        type: 'probe-failed',
      })
    })

    child.on('close', (code) => {
      const output = Buffer.concat(chunks).toString().trim()

      if (code === 0) {
        finalize({ ok: true, output })
        return
      }

      finalize({
        ok: false,
        output,
        type: 'probe-failed',
      })
    })
  })
}
