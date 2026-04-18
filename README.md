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
Usage: create-seed [options] [command] [name]

Scaffold a new project from a template

Arguments:
  name                         Project name

Options:
  -V, --version                output the version number
  -t, --template <template>    Template to use (gh:owner/repo/path, https://github.com/owner/repo/tree/ref/path, or local path)
  --pm <pm>                    Package manager (npm|pnpm|bun, default: auto-detect)
  --allow-missing-tools        Continue when create-seed.tools commands are not installed (default: false)
  --skip-git                   Skip git initialization (default: false)
  --skip-install               Skip installing dependencies (default: false)
  -l, --list                   List available templates (default: false)
  --templates-url <url>        URL or local path to templates.json (default:
                               "https://raw.githubusercontent.com/create-seed/templates/main/templates.json")
  -d, --dry-run                Dry run (default: false)
  -v, --verbose                Verbose output (default: false)
  -h, --help                   display help for command

Commands:
  registry                     Manage template registries
  template                     Manage local templates
  tools                        Inspect tool versions used by template requirements
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

Template authors can add `create-seed.instructions` in `package.json` to customize the final note:

- Prefix a line with `+` to render it in bold
- Use a standalone `~` line to insert an empty line

Templates can also declare external CLI requirements with `create-seed.tools`.

String values are shorthand for "this command must exist and report at least this version":

```json
{
  "create-seed": {
    "tools": {
      "solana": "3.0.0"
    }
  }
}
```

If you need more control, each tool can also use an object:

```json
{
  "create-seed": {
    "tools": {
      "adb": {
        "args": ["version"],
        "docsUrl": "https://developer.android.com/tools/adb",
        "installHint": "Install Android platform-tools.",
        "minVersion": "37.0.0",
        "versionPattern": "Version\\s+(\\d+\\.\\d+\\.\\d+)"
      },
      "avm": {},
      "node": {
        "minVersion": "24.5.0"
      }
    }
  }
}
```

Supported object fields:

- `args` — probe arguments; defaults to `["--version"]`
- `command` — override the executable name; defaults to the tool key
- `docsUrl` — documentation link appended to the error
- `installHint` — custom error text shown when the requirement is not met
- `minVersion` — minimum required `x.y.z` version; omit it for a presence-only check
- `versionPattern` — valid and safe regular expression with one capture group for the version to compare; requires `minVersion`

If a required tool is missing, below the minimum version, or its configured probe does not return a parseable `x.y.z` version, scaffolding stops before install and tells the user how to fix it. If `minVersion` is omitted, `create-seed` only requires the command to exist and the configured probe command to succeed. `solana` gets a Solana-specific install hint by default; other tools use a generic upgrade message unless you provide `installHint` or `docsUrl`.

If you need to scaffold in an environment that intentionally does not have those tools installed yet, pass `--allow-missing-tools`. That only ignores missing commands; installed-but-too-old tools and other probe failures still stop generation.

If you want to see exactly what `create-seed` would compare for a command before writing template metadata, use the probe command:

```bash
create-seed tools probe node
create-seed tools probe adb --min 37.0.0 --pattern 'Version\s+(\d+\.\d+\.\d+)'
create-seed tools probe avm --presence-only
```

Probe options:

- `--arg <value>` — add a custom probe argument; repeatable
- `--json` — print the structured probe result as JSON
- `--min <version>` — check a minimum version
- `--pattern <regex>` — use a custom regex with one capture group
- `--presence-only` — only verify that the command exists and the probe succeeds

The probe prints the raw output, every detected version-like token, the version `create-seed` would compare, whether the minimum passes, and a suggested `tools` config snippet.

If you want to validate the full `create-seed` metadata for a local template before publishing or adding it to a registry, use:

```bash
create-seed template validate
create-seed template validate --dir ./path/to/template
```

That validates the `create-seed` object in `package.json` and prints the normalized `instructions` and `tools` metadata that `create-seed` will use. Generated registries also carry that normalized `tools` metadata in `templates.json`.

## What it does

1. **Clones the template** — downloads from GitHub (via [giget](https://github.com/unjs/giget)) or copies from a local path
2. **Checks required tools** — validates any `create-seed.tools` requirements from the template before making further changes
3. **Configures the package** — rewrites `package.json` and renames in-template references to your new app name
4. **Initializes git** — runs `git init` before install so prepare scripts can see the repo (skips gracefully if git is not installed)
5. **Installs dependencies** — auto-detects your package manager (bun/npm/pnpm)
6. **Runs one post-generation setup script** — first match wins from `create-seed:setup`, then `setup` (skipped if install was skipped or no matching script exists)
7. **Runs one post-generation fix script** — first match wins from `create-seed:fix`, `lint:fix`, then `format` (skipped if install was skipped or no matching script exists)
8. **Creates the initial commit** — if git is enabled and available

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
