import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Normalize a repository value (URL, object, or string) into an "owner/repo" slug.
 * Handles: git+https://..., https://github.com/..., git@github.com:..., "owner/repo", { name, url }
 */
export function normalizeRepoSlug(input: unknown): string | undefined {
  const raw = (() => {
    if (typeof input === 'string') {
      return input
    }
    if (typeof input === 'object' && input) {
      const repo = input as { name?: unknown; url?: unknown }
      if (typeof repo.name === 'string') {
        return repo.name
      }
      if (typeof repo.url === 'string') {
        return repo.url
      }
    }
    return undefined
  })()

  if (!raw) {
    return undefined
  }

  const cleaned = raw
    .replace(/^github:/, '')
    .replace(/^git\+/, '')
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')

  const match = cleaned.match(/^([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+?)(?:\.git)?(?:[#/].*)?$/)
  return match?.[1]
}

export function detectRepoName(root: string): string | undefined {
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const slug = normalizeRepoSlug(pkg.repository)
      if (slug) {
        return slug
      }
    } catch {
      // ignore
    }
  }

  try {
    const remote = execSync('git remote get-url origin', {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return normalizeRepoSlug(remote)
  } catch {
    return undefined
  }
}
