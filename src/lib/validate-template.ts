import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  type CreateSeedConfig,
  INVALID_CREATE_SEED_CONFIG_MESSAGE,
  parsePackageCreateSeedConfig,
  parsePackageCreateSeedInstructions,
  parsePackageCreateSeedTools,
} from './create-seed-config.ts'
import { readPackageJson } from './package-json.ts'

export interface TemplateValidationResult {
  config: CreateSeedConfig | undefined
  dir: string
  error: string | undefined
  packageJsonPath: string
  valid: boolean
}

export function validateTemplate(dir: string): TemplateValidationResult {
  const root = resolve(dir)
  const packageJsonPath = join(root, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return {
      config: undefined,
      dir: root,
      error: `package.json not found: ${packageJsonPath}`,
      packageJsonPath,
      valid: false,
    }
  }

  const pkg = readPackageJson(packageJsonPath)

  if (!pkg) {
    return {
      config: undefined,
      dir: root,
      error: `package.json is not a valid JSON object: ${packageJsonPath}`,
      packageJsonPath,
      valid: false,
    }
  }

  const result = parsePackageCreateSeedConfig(pkg)

  if (!result.valid) {
    const instructions = parsePackageCreateSeedInstructions(pkg)
    const tools = parsePackageCreateSeedTools(pkg)
    const detailedError = instructions.error ?? tools.error ?? result.error ?? INVALID_CREATE_SEED_CONFIG_MESSAGE

    return {
      config: undefined,
      dir: root,
      error: `Invalid create-seed in template package.json; ${detailedError}`,
      packageJsonPath,
      valid: false,
    }
  }

  return {
    config: result.config,
    dir: root,
    error: undefined,
    packageJsonPath,
    valid: true,
  }
}
