### Development Tools

```bash
pwsh ./build/scripts/Invoke-PesterTests.ps1          # Tests
pwsh ./build/scripts/Invoke-PesterTests.ps1 -CI       # CI tests
pytest -v                                              # Python tests
npx markdownlint-cli2 --fix "**/*.md"                 # Lint
pwsh scripts/Validate-Consistency.ps1                  # Consistency
pwsh build/Generate-Agents.ps1                         # Build agents
```
