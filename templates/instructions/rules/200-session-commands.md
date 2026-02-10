## Commands

### Session Management

```bash
/init                    # Start new session with fresh context
/clear                   # Clear history between unrelated tasks

# Session Start
mcp__plugin_brain_brain__build_context
git branch --show-current

# Session End
npx markdownlint-cli2 --fix "**/*.md"
pwsh .claude/skills/memory/scripts/Extract-SessionEpisode.ps1 -SessionLogPath ".agents/sessions/[log].md"
pwsh scripts/Validate-SessionProtocol.ps1 -SessionLogPath ".agents/sessions/[log].md"
```
