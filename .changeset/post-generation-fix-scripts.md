---
"create-seed": patch
---

Replace the Biome-specific post-install formatting step with a generic post-generation fixer contract. Generated apps now run the first matching script from `create-seed:fix`, `lint:fix`, or `format` after dependency installation and before the initial commit, while still skipping cleanly or warning without failing scaffolding when the fixer cannot run.
