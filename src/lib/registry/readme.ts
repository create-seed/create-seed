import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Registry } from './types.ts'

interface RegistryMeta {
  description: string
  name: string
}

function readRegistryMeta(root: string): RegistryMeta {
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return {
        description: pkg.description ?? '',
        name: pkg.name ?? 'Templates',
      }
    } catch {
      // Fall through to defaults if package.json is malformed
    }
  }
  return { description: '', name: 'Templates' }
}

function sanitizeMarkdownText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function sanitizeInlineCode(value: string): string {
  return sanitizeMarkdownText(value).replace(/`/g, '\\`')
}

function shellQuote(value: string): string {
  const singleLine = value.replace(/[\r\n]+/g, '')
  return `'${singleLine.replace(/'/g, `'"'"'`)}'`
}

export function generateReadme(root: string, registry: Registry): string {
  const meta = readRegistryMeta(root)
  const lines: string[] = []

  lines.push(`# ${sanitizeMarkdownText(meta.name)}`)
  lines.push('')
  if (meta.description) {
    lines.push(sanitizeMarkdownText(meta.description))
    lines.push('')
  }

  lines.push('## Available Templates')
  lines.push('')

  for (const template of registry.templates) {
    const path = sanitizeInlineCode(template.path ?? '')
    const description = sanitizeMarkdownText(template.description ?? '')
    const templateId = shellQuote(template.id ?? '')

    lines.push(`### \`${path}\``)
    lines.push('')
    if (description) {
      lines.push(description)
      lines.push('')
    }
    lines.push('```bash')
    lines.push(`bun x create-seed@latest my-app -t ${templateId}`)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

export function writeReadme(root: string, content: string): string {
  const filePath = join(root, 'README.md')
  writeFileSync(filePath, content)
  return filePath
}
