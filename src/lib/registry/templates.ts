import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePackageCreateSeedInstructions } from '../create-seed-config.ts'
import { REGISTRY_FILENAME } from './constants.ts'
import { detectRepoName } from './repo.ts'
import type { Registry, RegistryTemplate } from './types.ts'

function isTemplate(dir: string): boolean {
  return existsSync(join(dir, 'package.json'))
}

function readTemplateInfo(dir: string, name: string): RegistryTemplate | null {
  const pkgPath = join(dir, 'package.json')
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const { instructions } = parsePackageCreateSeedInstructions(pkg)
    return {
      description: pkg.description ?? '',
      id: name,
      ...(instructions ? { instructions } : {}),
      name: pkg.name ?? name,
      path: name,
    }
  } catch {
    return null
  }
}

export function scanTemplates(root: string): RegistryTemplate[] {
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
      const info = readTemplateInfo(dir, entry.name)
      if (info) {
        templates.push(info)
      }
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name))
}

export function generateRegistry(root: string): Registry {
  const repoName = detectRepoName(root)
  const templates = scanTemplates(root).map((template) => ({
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
