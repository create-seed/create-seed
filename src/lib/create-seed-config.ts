import { isRecord } from './package-json.ts'

export const CREATE_SEED_CONFIG_KEY = 'create-seed'

export interface CreateSeedConfigParseResult {
  instructions: string[] | undefined
  valid: boolean
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function parseCreateSeedInstructions(config: unknown): CreateSeedConfigParseResult {
  if (config === undefined) {
    return { instructions: undefined, valid: true }
  }

  if (!isRecord(config)) {
    return { instructions: undefined, valid: false }
  }

  const { instructions } = config

  if (instructions === undefined) {
    return { instructions: undefined, valid: true }
  }

  if (!isStringArray(instructions)) {
    return { instructions: undefined, valid: false }
  }

  return { instructions, valid: true }
}

export function parsePackageCreateSeedInstructions(pkg: Record<string, unknown>): CreateSeedConfigParseResult {
  return parseCreateSeedInstructions(pkg[CREATE_SEED_CONFIG_KEY])
}
