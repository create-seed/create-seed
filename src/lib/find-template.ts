import { isAbsolute } from 'node:path'
import { getTemplates, getTemplatesUrl, type Template } from './get-templates.ts'

export interface TemplateInfo {
  id: string
  mode: 'external' | 'local'
}

function normalizeGitHubTemplateUrl(template: string): string | undefined {
  let url: URL

  try {
    url = new URL(template)
  } catch {
    return undefined
  }

  if (url.hostname !== 'github.com' || url.protocol !== 'https:') {
    return undefined
  }

  if (url.hash || url.search) {
    throw new Error(
      `Unsupported GitHub template URL: "${template}". Use https://github.com/owner/repo, https://github.com/owner/repo/tree/ref/path, or gh:owner/repo/path#ref.`,
    )
  }

  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const [owner, repo, segment, ref, ...pathParts] = parts

  if (owner && repo && parts.length === 2) {
    return `gh:${owner}/${repo}`
  }

  if (owner && repo && ref && segment === 'tree') {
    const path = pathParts.length === 0 ? '' : `/${pathParts.join('/')}`
    return `gh:${owner}/${repo}${path}#${ref}`
  }

  throw new Error(
    `Unsupported GitHub template URL: "${template}". Use https://github.com/owner/repo, https://github.com/owner/repo/tree/ref/path, or gh:owner/repo/path#ref.`,
  )
}

function isLocalTemplate(template: string): boolean {
  return (
    template.startsWith('./') ||
    template.startsWith('../') ||
    isAbsolute(template) ||
    /^[a-zA-Z]:[\\/]/.test(template) ||
    template.startsWith('\\\\')
  )
}

export async function findTemplate(template: string): Promise<TemplateInfo> {
  // Local path (POSIX, Windows drive letter, UNC)
  if (isLocalTemplate(template)) {
    return { id: template, mode: 'local' }
  }

  const githubTemplate = normalizeGitHubTemplateUrl(template)
  if (githubTemplate) {
    return { id: githubTemplate, mode: 'external' }
  }

  // External template (contains a slash, e.g. "owner/repo" or "gh:owner/repo")
  if (template.includes('/')) {
    const id = template.includes(':') ? template : `gh:${template}`
    return { id, mode: 'external' }
  }

  // Short name — look up in the registry
  const templates = await getTemplates(getTemplatesUrl())
  const match = templates.find((t: Template) => t.name === template)
  if (match?.id) {
    return { id: match.id, mode: 'external' }
  }

  const available = templates.map((t: Template) => t.name).join(', ')
  throw new Error(
    `Unknown template: "${template}". Available templates: ${available || 'none'}. Or use a GitHub path (e.g. gh:owner/repo/path) or GitHub URL (e.g. https://github.com/owner/repo).`,
  )
}
