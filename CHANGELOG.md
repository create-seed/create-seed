# create-seed

## 1.3.3

### Patch Changes

- 31e4ba6: Replace the Biome-specific post-install formatting step with a generic post-generation fixer contract. Generated apps now run the first matching script from `create-seed:fix`, `lint:fix`, or `format` after dependency installation and before the initial commit, while still skipping cleanly or warning without failing scaffolding when the fixer cannot run.

## 1.3.2

### Patch Changes

- 4477824: Support renaming additional template name casing variants, including snake_case, camelCase, PascalCase, and SCREAMING_SNAKE_CASE.

## 1.3.1

### Patch Changes

- a4c913f: Support canonical `https://github.com/...` template URLs by normalizing repo and tree URLs to the existing `gh:` template format before cloning.
- 6a37f2d: Improve project rename replacements by also updating Title Case and concatenated lowercase name variants alongside the exact package name.

## 1.3.0

### Minor Changes

- d3616dc: Support the `NO_DNA` convention for non-human operators by enforcing non-interactive behavior when `NO_DNA` is set.

## 1.2.0

### Minor Changes

- 301bdce: Run Biome formatting after dependency installation in scaffolding, so template config imports (like `tsdown.config.ts`) resolve correctly and scaffold output stays clean.

### Patch Changes

- 2540cb3: Harden template registry output generation by sanitizing README metadata, quoting template IDs in generated commands, and tightening repository slug parsing and package metadata handling.
- 74ef4bb: Rename references now scans all regular files and skips likely binary files, so template names in files like `.mts` are updated correctly.
- 2540cb3: Refactor registry internals into focused modules for better readability and maintainability, with no behavior change.

## 1.1.1

### Patch Changes

- 3b4b59d: Run biome format after rename step to fix lint errors from reference renaming

  Previously, biome was only run after the package.json rewrite step. The rename
  step runs after and modifies files again (replacing package name references in
  dependencies and imports), which could break biome's sort rules. Now biome runs
  once after all file modifications are complete.

## 1.1.0

### Minor Changes

- de86325: Initialize git repo before installing dependencies so prepare scripts (e.g. lefthook) can find the repo. Show full error output when commands fail.
- 9e52dac: Rename template references across all files after scaffolding. When a template's package name differs from the user's chosen project name, all text files are searched and updated to use the new name.

### Patch Changes

- e1f168e: Fix package name when project path is absolute or relative (use basename instead of full path)
- 3f5050c: Format package.json with biome after rewriting, if biome config exists in the template
- 769574f: Treat orphaned templates as validation errors instead of warnings

## 1.0.0

### Major Changes

- 8fa92f2: Initial stable release. 🌱

### Minor Changes

- a00a470: Core scaffold CLI: template cloning via giget, PM auto-detection, git init with fallback identity, portable (no Bun runtime dependency)
- cfd358f: Support short template names that resolve from the template registry (e.g. `bun-library` instead of `gh:create-seed/templates/bun-library`)
- b2d10db: Add anonymous usage analytics via Umami. Respects DO_NOT_TRACK and CI environments.
- a45b87b: Interactive prompts: ask for project name and template when not provided as args, confirm overwrite if directory exists
- 14a6ac0: Add `registry generate` and `registry validate` subcommands for managing template registries
- 7c39f1d: Template registry: --list flag to show available templates, interactive template select from remote registry

### Patch Changes

- fd6deba: Fix network-coupled tests, repository URL normalization, Windows path detection, and local templates-url handling
- 27f1e24: Prevent path traversal in project name that could delete files outside the current directory
- a93218e: Fix git init failing due to shell splitting commit message args
- c680688: Fix spinner not animating during dependency installation by using async exec instead of execSync
- 2d3fc76: Fix URLs being treated as local paths in template registry
- 8638df9: Rewrite package.json after cloning: set project name, reset version/description, clear template-specific fields
