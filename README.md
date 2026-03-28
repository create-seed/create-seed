# create-seed 🌱

Scaffold a new project from a template. Fast, portable, zero config.

## Usage

```bash
# With bun
bun x create-seed@latest my-app -t bun-library

# With npx
npx create-seed@latest my-app -t bun-library

# With pnpx
pnpx create-seed@latest my-app -t bun-library
```

## Options

```
Usage: create-seed [options] [name]

Scaffold a new project from a template

Arguments:
  name                         Project name

Options:
  -V, --version                output the version number
  -t, --template <template>    Template to use (gh:owner/repo/path, https://github.com/owner/repo/tree/ref/path, or local path)
  --pm <pm>                    Package manager (npm|pnpm|bun, default: auto-detect)
  --skip-git                   Skip git initialization (default: false)
  --skip-install               Skip installing dependencies (default: false)
  -d, --dry-run                Dry run (default: false)
  -v, --verbose                Verbose output (default: false)
  -h, --help                   display help for command
```

## Templates

Browse available templates at [create-seed/templates](https://github.com/create-seed/templates).

You can also use any GitHub repo, GitHub web URL, subdirectory, or local path as a template:

```bash
# Short name (from the default registry)
bun x create-seed@latest my-app -t bun-library

# GitHub repo
bun x create-seed@latest my-app -t gh:owner/repo

# GitHub repo URL
bun x create-seed@latest my-app -t https://github.com/owner/repo

# GitHub subdirectory
bun x create-seed@latest my-app -t gh:owner/repo/path

# GitHub branch
bun x create-seed@latest my-app -t gh:owner/repo#my-branch

# GitHub tree URL
bun x create-seed@latest my-app -t https://github.com/owner/repo/tree/my-branch/path

# GitHub subdirectory on a specific branch
bun x create-seed@latest my-app -t gh:owner/repo/path#my-branch

# Local path
bun x create-seed@latest my-app -t ./my-local-template
```

GitHub tree URLs treat the first segment after `/tree/` as the ref. If your branch or tag name contains `/`, use `gh:owner/repo/path#ref/with/slash` instead.

Template authors can also add `create-seed.instructions` in `package.json` to customize the final note:

- Prefix a line with `+` to render it in bold
- Use a standalone `~` line to insert an empty line

## What it does

1. **Clones the template** — downloads from GitHub (via [giget](https://github.com/unjs/giget)) or copies from a local path
2. **Configures the package** — rewrites `package.json` and renames in-template references to your new app name
3. **Initializes git** — runs `git init` before install so prepare scripts can see the repo (skips gracefully if git is not installed)
4. **Installs dependencies** — auto-detects your package manager (bun/npm/pnpm)
5. **Runs one post-generation setup script** — first match wins from `create-seed:setup`, then `setup` (skipped if install was skipped or no matching script exists)
6. **Runs one post-generation fix script** — first match wins from `create-seed:fix`, `lint:fix`, then `format` (skipped if install was skipped or no matching script exists)
7. **Creates the initial commit** — if git is enabled and available

## Package manager detection

`create-seed` auto-detects which package manager you're using based on how you ran it:

| Command | Detected PM |
|---------|-------------|
| `bun x create-seed@latest` | bun |
| `npx create-seed@latest` | npm |
| `pnpx create-seed@latest` | pnpm |

Override with `--pm`:

```bash
bun x create-seed@latest my-app -t gh:owner/repo --pm bun
```

## NO_DNA support

`create-seed` supports the [`NO_DNA`](https://no-dna.org/) convention for non-human operators.

When `NO_DNA` is set to a non-empty value, `create-seed` will never prompt interactively:

- Project name must be passed as a positional argument
- Template must be passed with `--template`
- Existing target directories are not overwritten (command fails instead)

Example:

```bash
NO_DNA=1 bun x create-seed@latest my-app -t bun-library
```

## Analytics

Anonymous usage statistics are collected via [Umami](https://umami.is) to help improve the tool. No personally identifiable information is collected.

Data collected: OS, architecture, Node version, package manager, template name, and success/failure status.

To opt out, set the `DO_NOT_TRACK` environment variable:

```bash
DO_NOT_TRACK=1 bun x create-seed@latest my-app -t gh:owner/repo
```

Analytics are also automatically disabled in CI environments.

## Agent skill

This repo includes an AgentSkill for consistent usage patterns:

- `skills/create-seed/SKILL.md`

Install/discover it with the skills CLI:

```bash
# Discover skills in this repo
bun x skills add create-seed/create-seed --list

# Install the 'create-seed' skill
bun x skills add create-seed/create-seed --skill create-seed --yes
```

## Development

```bash
bun install
bun run build
bun run test
bun run lint
```

## License

MIT – see [LICENSE](./LICENSE).
