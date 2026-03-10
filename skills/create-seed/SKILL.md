---
name: create-seed
description: Scaffold new projects with the create-seed CLI and template registry. Use when creating a new project from a built-in template, a GitHub template path, or a local template, and when validating or generating template registries.
---

# create-seed

Use `create-seed` to scaffold projects quickly.

## Scaffold from built-in templates

```bash
bun x create-seed@latest my-app -t bun-library
bun x create-seed@latest my-app -t bun-library-solana-kit
bun x create-seed@latest my-app -t bun-monorepo
```

## Scaffold from external templates

```bash
bun x create-seed@latest my-app -t gh:create-seed/templates/bun-library
bun x create-seed@latest my-app -t owner/repo/path
bun x create-seed@latest my-app -t ./local-template
```

## Useful flags

- `--pm bun|npm|pnpm` to pick package manager
- `--skip-install` to avoid installing dependencies
- `--skip-git` to avoid git init + initial commit
- `--verbose` for detailed logs

Example:

```bash
bun x create-seed@latest my-app -t bun-library --pm bun --verbose
```

## Template registry workflow

From a templates repo root:

```bash
bun x create-seed@latest registry generate
bun x create-seed@latest registry validate
```

`generate` writes `templates.json` and `README.md`.
`validate` checks required fields, paths, and README consistency.

## Release testing pattern

Use canary before publishing major changes:

```bash
bun x create-seed@canary test-app -t bun-library
```

Then verify:

```bash
cd test-app
bun run build
```
