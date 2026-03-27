---
"create-seed": minor
---

Add a template setup hook to scaffolding. Generated apps now run the first matching script from `create-seed:setup` or `setup` after dependency installation and before the existing fix step, and skipped-install next steps now surface the matching setup command when present.
