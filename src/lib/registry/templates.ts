import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  INVALID_CREATE_SEED_TOOLS_MESSAGE,
  parsePackageCreateSeedInstructions,
  parsePackageCreateSeedTools,
} from '../create-seed-config.ts'
import { REGISTRY_FILENAME } from './constants.ts'
import { detectRepoName } from './repo.ts'
import type { Registry, RegistryTemplate } from './types.ts'

interface ScanTemplatesOptions {
  strictTools?: boolean
}

function isTemplate(dir: string): boolean {
  return existsSync(join(dir, 'package.json'))
}

function readTemplateInfo(dir: string, name: string, options: ScanTemplatesOptions = {}): RegistryTemplate | null {
  const pkgPath = join(dir, 'package.json')

  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return null
  }

  const { instructions } = parsePackageCreateSeedInstructions(pkg)
  const toolsResult = parsePackageCreateSeedTools(pkg)
  const description = typeof pkg.description === 'string' ? pkg.description : ''
  const templateName = typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : name

  if (options.strictTools && !toolsResult.valid) {
    throw new Error(
      `Invalid create-seed.tools in template "${templateName}" (${pkgPath}); ${toolsResult.error ?? INVALID_CREATE_SEED_TOOLS_MESSAGE}`,
    )
  }

  return {
    description,
    id: name,
    ...(instructions ? { instructions } : {}),
    name: templateName,
    path: name,
    ...(toolsResult.tools ? { tools: toolsResult.tools } : {}),
  }
}

export function scanTemplates(root: string, options: ScanTemplatesOptions = {}): RegistryTemplate[] {
  const entries = readdirSync(root, { withFileTypes: true })
  const templates: RegistryTemplate[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue
    }
    const dir = join(root, entry.name)
    if (isTemplate(dir)) {
      const info = readTemplateInfo(dir, entry.name, options)
      if (info) {
        templates.push(info)
      }
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name))
}

export function generateRegistry(root: string): Registry {
  const repoName = detectRepoName(root)
  const templates = scanTemplates(root, { strictTools: true }).map((template) => ({
    ...template,
    id: repoName ? `gh:${repoName}/${template.path}` : template.path,
  }))
  return { templates }
}

export function writeRegistry(root: string, registry: Registry): string {
  const filePath = join(root, REGISTRY_FILENAME)
  writeFileSync(filePath, `${JSON.stringify(registry, null, 2)}\n`)
  return filePath
}
