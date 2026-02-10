## Boundaries and Constraints

### Always Do

- **Use the `AskUserQuestion` tool.**
- **{{Workers}} should ALWAYS be creating memories.** Include memory instructions in {{worker}} prompts.
- **Verify branch** before ANY git/gh operation: `git branch --show-current`
- **Update Brain memory** at session end with cross-session context
- **Check for existing skills** before writing inline GitHub operations
- **Assign issues** before starting work: `gh issue edit <number> --add-assignee @me`
- **Use PR template** with ALL sections from `.github/PULL_REQUEST_TEMPLATE.md`
- **Commit atomically** (max 5 files OR single logical change)
- **Run linting** before commits: `npx markdownlint-cli2 --fix "**/*.md"`
