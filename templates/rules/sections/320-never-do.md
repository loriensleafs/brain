### Never Do

- Commit secrets or credentials (use git-secret, env vars, or secure vaults)
- Include any indication of AI contributions in git commit messages
- Skip session protocol validation
- Put logic in workflow YAML
- Use raw gh commands when skills exist (check `.claude/skills/` first)
- Create PRs without template (all sections required)
- Force push to main/master
- Skip hooks (no `--no-verify`, `--no-gpg-sign`)
- Reference internal PR/issue numbers in user-facing files (src/, templates/)
