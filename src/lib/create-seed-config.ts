import safeRegex from 'safe-regex'
import { z } from 'zod'

export const CREATE_SEED_CONFIG_KEY = 'create-seed'
export const CREATE_SEED_TOOLS_VERSION_PATTERN = /^\d+\.\d+\.\d+$/
export const INVALID_CREATE_SEED_CONFIG_MESSAGE =
  'expected a create-seed object with optional instructions and tools fields'
export const INVALID_CREATE_SEED_TOOLS_MESSAGE =
  'expected each tool to be either a version like "1.2.3" or an object with optional command, args, minVersion, versionPattern, installHint, and docsUrl fields'

const CreateSeedInstructionsSchema = z.array(z.string()).optional()
const NonEmptyStringSchema = z.string().trim().min(1, 'Expected a non-empty string')
const ToolArgsSchema = z.array(NonEmptyStringSchema).min(1, 'Expected at least one argument')
const ToolVersionSchema = z.string().regex(CREATE_SEED_TOOLS_VERSION_PATTERN, 'Expected a version like "1.2.3"')
const ToolVersionPatternSchema = NonEmptyStringSchema.refine(
  isValidRegexPattern,
  'Expected a valid and safe regular expression',
)

export interface CreateSeedToolRequirement {
  args: string[]
  command: string
  docsUrl?: string
  installHint?: string
  minVersion?: string
  versionPattern?: string
}

export interface CreateSeedConfig {
  instructions?: string[]
  tools?: Record<string, CreateSeedToolRequirement>
}

export interface CreateSeedConfigResult {
  config: CreateSeedConfig | undefined
  error: string | undefined
  valid: boolean
}

export interface CreateSeedConfigParseResult {
  error: string | undefined
  instructions: string[] | undefined
  valid: boolean
}

export interface CreateSeedToolsParseResult {
  error: string | undefined
  tools: Record<string, CreateSeedToolRequirement> | undefined
  valid: boolean
}

const CreateSeedToolObjectSchema = z
  .object({
    args: ToolArgsSchema.optional(),
    command: NonEmptyStringSchema.optional(),
    docsUrl: z.string().url('Expected a valid URL').optional(),
    installHint: NonEmptyStringSchema.optional(),
    minVersion: ToolVersionSchema.optional(),
    versionPattern: ToolVersionPatternSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.versionPattern && !value.minVersion) {
      ctx.addIssue({
        code: 'custom',
        message: 'versionPattern requires minVersion',
        path: ['versionPattern'],
      })
    }
  })
  .transform((value) => ({
    args: value.args ?? ['--version'],
    command: value.command,
    docsUrl: value.docsUrl,
    installHint: value.installHint,
    minVersion: value.minVersion,
    versionPattern: value.versionPattern,
  }))

const CreateSeedToolValueSchema = z.union([
  ToolVersionSchema.transform((minVersion) => ({
    args: ['--version'],
    command: undefined,
    docsUrl: undefined,
    installHint: undefined,
    minVersion,
    versionPattern: undefined,
  })),
  CreateSeedToolObjectSchema,
])

const CreateSeedToolsSchema = z
  .record(z.string(), CreateSeedToolValueSchema)
  .superRefine((tools, ctx) => {
    for (const key of Object.keys(tools)) {
      if (!key.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Tool names must be non-empty',
          path: [key],
        })
      }
    }
  })
  .transform((tools): Record<string, CreateSeedToolRequirement> => {
    const normalizedTools: Record<string, CreateSeedToolRequirement> = {}
    const entries = Object.entries(tools).sort(([left], [right]) => left.localeCompare(right))

    for (const [tool, requirement] of entries) {
      normalizedTools[tool] = {
        ...requirement,
        command: requirement.command ?? tool,
      }
    }

    return normalizedTools
  })

export const CreateSeedConfigSchema = z
  .object({
    instructions: CreateSeedInstructionsSchema,
    tools: CreateSeedToolsSchema.optional(),
  })
  .strict()

const CreateSeedInstructionsConfigSchema = z
  .object({
    instructions: CreateSeedInstructionsSchema,
  })
  .passthrough()

const CreateSeedToolsConfigSchema = z
  .object({
    tools: CreateSeedToolsSchema.optional(),
  })
  .passthrough()

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isValidRegexPattern(value: string): boolean {
  try {
    return safeRegex(new RegExp(value))
  } catch {
    return false
  }
}

function formatParseError(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0]

  if (!issue) {
    return fallback
  }

  const path = issue.path.map(String).join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

export function parseCreateSeedConfig(config: unknown): CreateSeedConfigResult {
  if (config === undefined) {
    return { config: undefined, error: undefined, valid: true }
  }

  const result = CreateSeedConfigSchema.safeParse(config)

  if (!result.success) {
    return {
      config: undefined,
      error: formatParseError(result.error, INVALID_CREATE_SEED_CONFIG_MESSAGE),
      valid: false,
    }
  }

  return {
    config: result.data,
    error: undefined,
    valid: true,
  }
}

export function parsePackageCreateSeedConfig(pkg: Record<string, unknown>): CreateSeedConfigResult {
  return parseCreateSeedConfig(pkg[CREATE_SEED_CONFIG_KEY])
}

export function parseCreateSeedInstructions(config: unknown): CreateSeedConfigParseResult {
  if (config === undefined) {
    return { error: undefined, instructions: undefined, valid: true }
  }

  const result = CreateSeedInstructionsConfigSchema.safeParse(config)

  if (!result.success) {
    return {
      error: formatParseError(result.error, INVALID_CREATE_SEED_CONFIG_MESSAGE),
      instructions: undefined,
      valid: false,
    }
  }

  return {
    error: undefined,
    instructions: result.data.instructions,
    valid: true,
  }
}

export function parsePackageCreateSeedInstructions(pkg: Record<string, unknown>): CreateSeedConfigParseResult {
  return parseCreateSeedInstructions(pkg[CREATE_SEED_CONFIG_KEY])
}

export function parseCreateSeedTools(config: unknown): CreateSeedToolsParseResult {
  if (config === undefined) {
    return { error: undefined, tools: undefined, valid: true }
  }

  const result = CreateSeedToolsConfigSchema.safeParse(config)

  if (!result.success) {
    return {
      error: formatParseError(result.error, INVALID_CREATE_SEED_TOOLS_MESSAGE),
      tools: undefined,
      valid: false,
    }
  }

  return {
    error: undefined,
    tools: result.data.tools,
    valid: true,
  }
}

export function parsePackageCreateSeedTools(pkg: Record<string, unknown>): CreateSeedToolsParseResult {
  return parseCreateSeedTools(pkg[CREATE_SEED_CONFIG_KEY])
}
