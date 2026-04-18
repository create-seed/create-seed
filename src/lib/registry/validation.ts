import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  INVALID_CREATE_SEED_TOOLS_MESSAGE,
  isStringArray,
  parsePackageCreateSeedInstructions,
  parsePackageCreateSeedTools,
} from '../create-seed-config.ts'
import { readPackageJson } from '../package-json.ts'
import { REGISTRY_FILENAME } from './constants.ts'
import { generateReadme } from './readme.ts'
import { scanTemplates } from './templates.ts'
import type { Registry, ValidationError } from './types.ts'

function instructionsMatch(left: string[] | undefined, right: string[] | undefined): boolean {
  if (!left && !right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export function validateRegistry(root: string): ValidationError[] {
  const errors: ValidationError[] = []
  const filePath = join(root, REGISTRY_FILENAME)

  if (!existsSync(filePath)) {
    errors.push({ message: `${REGISTRY_FILENAME} not found`, type: 'error' })
    return errors
  }

  let registry: Registry
  try {
    registry = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    errors.push({ message: `${REGISTRY_FILENAME} is not valid JSON`, type: 'error' })
    return errors
  }

  if (!registry.templates || !Array.isArray(registry.templates)) {
    errors.push({ message: '`templates` property is missing or not an array', type: 'error' })
    return errors
  }

  for (const template of registry.templates) {
    if (!template.name) {
      errors.push({ message: 'Template missing required field: name', type: 'error' })
      continue
    }
    if (!template.path) {
      errors.push({ message: `Template "${template.name}" missing required field: path`, type: 'error' })
      continue
    }
    if (!template.id) {
      errors.push({ message: `Template "${template.name}" missing required field: id`, type: 'error' })
    }
    if (template.instructions !== undefined && !isStringArray(template.instructions)) {
      errors.push({
        message: `Template "${template.name}" has invalid instructions in ${REGISTRY_FILENAME}; expected an array of strings`,
        type: 'error',
      })
    }
    if (!template.description) {
      errors.push({ message: `Template "${template.name}" missing description`, type: 'warning' })
    }
    const dir = resolve(root, template.path)
    if (!existsSync(dir)) {
      errors.push({ message: `Template "${template.name}" path does not exist: ${template.path}`, type: 'error' })
    } else if (!existsSync(join(dir, 'package.json'))) {
      errors.push({
        message: `Template "${template.name}" has no package.json in: ${template.path}`,
        type: 'error',
      })
    } else {
      const pkg = readPackageJson(join(dir, 'package.json'))
      if (pkg) {
        const actualInstructions = parsePackageCreateSeedInstructions(pkg)
        const actualTools = parsePackageCreateSeedTools(pkg)

        if (!actualInstructions.valid) {
          errors.push({
            message: `Template "${template.name}" has invalid create-seed.instructions in package.json; expected an array of strings`,
            type: 'error',
          })
        } else if (!instructionsMatch(template.instructions, actualInstructions.instructions)) {
          errors.push({
            message: `${REGISTRY_FILENAME} instructions for "${template.name}" are out of date — run \`create-seed registry generate\` to update`,
            type: 'warning',
          })
        }

        if (!actualTools.valid) {
          errors.push({
            message: `Template "${template.name}" has invalid create-seed.tools in package.json; ${INVALID_CREATE_SEED_TOOLS_MESSAGE}`,
            type: 'error',
          })
        }
      }
    }
  }

  const readmePath = join(root, 'README.md')
  if (existsSync(readmePath)) {
    const currentReadme = readFileSync(readmePath, 'utf-8')
    const expectedReadme = generateReadme(root, registry)
    if (currentReadme !== expectedReadme) {
      errors.push({
        message: 'README.md is out of date — run `create-seed registry generate` to update',
        type: 'warning',
      })
    }
  } else {
    errors.push({ message: 'README.md not found — run `create-seed registry generate` to create', type: 'warning' })
  }

  const registeredPaths = new Set(registry.templates.map((template) => template.path))
  const actualTemplates = scanTemplates(root)
  for (const template of actualTemplates) {
    if (!registeredPaths.has(template.path)) {
      errors.push({ message: `Orphaned template not in registry: ${template.path}`, type: 'error' })
    }
  }

  return errors
}
