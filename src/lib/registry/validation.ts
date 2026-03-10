import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REGISTRY_FILENAME } from './constants.ts'
import { generateReadme } from './readme.ts'
import { scanTemplates } from './templates.ts'
import type { Registry, ValidationError } from './types.ts'

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
