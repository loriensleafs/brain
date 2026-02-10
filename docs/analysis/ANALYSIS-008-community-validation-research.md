---
title: ANALYSIS-008-community-validation-research
type: note
permalink: analysis/analysis-008-community-validation-research
tags:
- analysis
- community-validation
- multi-tool
- agents-md
- vercel-skills
- ecosystem
---

# ANALYSIS-008 Community Validation Research

## Context

Community validation research for Brain's multi-tool architecture. Evaluates Brain's proposed canonical-content-plus-per-tool-adapters approach against ecosystem patterns from Vercel agent-skills, AGENTS.md standard, skills-supply, Skills Hub, and individual practitioners.

## Research Questions and Findings

### Q1: How does Vercel structure cross-tool agent skills?

Vercel's agent-skills repo (vercel-labs/agent-skills) contains 5 modular skills (react-best-practices, web-design-guidelines, react-native-guidelines, composition-patterns, vercel-deploy-claimable). Each skill follows SKILL.md + optional scripts/ + optional references/ structure. Skills are agent-agnostic markdown -- no per-tool content transforms. Installation via `npx skills add vercel-labs/agent-skills`. The same SKILL.md content is delivered to all tools unchanged.

### Q2: What tools does the Vercel Skills CLI support?

The Skills CLI (vercel-labs/skills) supports 40+ tools including: Claude Code, Cursor, Codex, OpenCode, Goose, GitHub Copilot, Gemini CLI, Cline, CodeBuddy, Continue, OpenHands, Kilo Code, Roo Code, Windsurf, Zencoder, Trae, Junie, and many others. Per-tool installation works by detecting installed tools (checking config directories like .claude/, .cursor/) and placing skills in each tool's skills directory.

### Q3: Does Vercel use content transforms/adapters?

No. Vercel uses identical content for all tools. The SKILL.md format is tool-agnostic markdown with YAML frontmatter (name, description). The CLI handles placement (where to install), not transformation (how to adapt). This validates Brain's principle that canonical content should be authored once. However, Brain goes further by needing per-tool adapters for tool-specific API references (Agent Teams, MCP configuration, hooks), which Vercel does not need because their skills are pure knowledge (no tool API instructions).

### Q4: How does AGENTS.md handle multi-tool instructions?

AGENTS.md (agents.md) is an open standard by the Agentic AI Foundation. It is plain markdown with no required fields or rigid schema. Multi-tool compatibility is achieved through format simplicity rather than adapters -- all tools read the same markdown. Key features:

- Directory-tree hierarchy (closest AGENTS.md to edited file wins)
- Override chain: Codex has AGENTS.override.md > nearest AGENTS.md > parent dirs > global AGENTS.md
- 60,000+ open-source projects use it
- 20+ tools support it natively
- No content transforms -- same file read by all tools

### Q5: How do other frameworks handle multi-tool output?

- **Goose**: Auto-discovers skills from ~/.config/goose/skills/ OR ~/.claude/skills/ (cross-tool sharing)
- **skills-supply (sk)**: Uses agents.toml as manifest. Local packages are symlinked, remote packages are copied. Can extract skills from .claude-plugin packages and sync them everywhere.
- **Skills Hub**: Desktop app syncing skills to multiple tools. Prefers symlink/junction, falls back to copy. Forces directory copy for Cursor (broken symlinks).
- **PRPM**: Package manager with 7,000+ packages. Supports cross-format conversion (install as cursor, install as copilot).
- **Aider**: Uses CONVENTIONS.md as its instruction file (similar concept, different name).
- Common pattern: write once, distribute to many via CLI tool or symlinks.

### Q6: Is root-level canonical content a recognized pattern?

Yes. Strong consensus across the ecosystem:

- AGENTS.md lives at project root as single source of truth
- Practitioners use symlinks from tool-specific dirs (.claude/, .codex/, .gemini/) back to a central .ai/ folder
- CLAUDE.md can reference AGENTS.md with "See @AGENTS.md" redirect
- Organization-level pattern: canonical template in .github repo with per-repo overrides
- Brain's canonical root content approach directly aligns with this community consensus.

### Q7: How are large instruction sets (150KB+) handled?

Progressive context loading is the dominant pattern:

- Modular skills architecture: split into 1,000-3,000 token modules
- Product matrix routing: map file types to required instruction modules
- 98% token reduction (150K to 2K) measured in practice
- Vercel found that AGENTS.md (passive context, always loaded) achieved 100% pass rate vs skills (active retrieval, on-demand) at 79% max
- Key insight: eliminating decision points via always-present context beats sophisticated on-demand retrieval
- For Brain: core instructions in AGENTS.md/CLAUDE.md, specialized knowledge in skills with progressive disclosure

### Q8: Community consensus on huh v2 vs gum for Go CLI?

- huh v2 is the Go library behind gum (gum internally uses huh for some form functionality)
- gum is for shell scripts (CLI binary), huh is for Go programs (library)
- For a Go CLI like Brain: use huh v2 directly, eliminating external binary dependency
- Already in charmbracelet ecosystem with bubbletea/bubbles/lipgloss
- Supports forms, multi-select, confirm, progress
- Can embed huh forms inside bubbletea programs for inline progress
- ANALYSIS-007 already recommended this; community consensus confirms it.

### Q9: How do projects handle deeply tool-specific content?

This is the gap in the ecosystem. Most solutions assume tool-agnostic content:

- AGENTS.md: pure markdown, no tool-specific sections
- Vercel Skills: pure knowledge skills, no tool API references
- skills-supply: extracts from .claude-plugin but does not transform content

Brain's challenge is unique: it has content deeply specific to Claude Agent Teams (TeammateTool API, in-process mode, plan approval), MCP server configuration, and tool-specific hooks. No existing framework addresses this because most skills are domain knowledge (React best practices) not tool API references.

Brain's adapter pattern (canonical content + per-tool overlays for API-specific content) is novel but well-justified. The canonical layer follows community convention. The adapter layer adds what the ecosystem lacks.

### Q10: Symlink vs copy pattern in the ecosystem?

Strong consensus on hybrid approach:

- **Symlinks preferred** for: Claude Code (works), local development (live updates), single source of truth
- **Copy required** for: Cursor (symlinks broken Feb 2026), Gemini CLI (symlinks intentionally blocked for security), Codex (symlink support pending, issue #8369)
- **Ecosystem tools**: npx skills (symlink recommended, copy fallback), skills-supply (symlink for local, copy for remote), Skills Hub (symlink preferred, copy for Cursor)
- Brain's hybrid staging + adaptive write approach (ANALYSIS-007) matches the community consensus exactly.

## Validation Summary for Brain Architecture

### Strongly Validated Patterns

1. **Root-level canonical content**: Universal community pattern (AGENTS.md, CLAUDE.md at project root)
2. **Hybrid symlink/copy staging**: Matches npx skills, skills-supply, Skills Hub approaches
3. **Per-tool adapter pattern**: Justified by tool-specific API content that no existing framework handles
4. **huh v2 for Go TUI**: Community consensus for Go CLI applications
5. **SKILL.md format compliance**: Brain skills can follow the open agent skills specification
6. **XDG-compliant staging directory**: Aligns with package manager conventions (Homebrew, Nix, Stow)

### Novel Contributions (Not Found in Ecosystem)

1. **Tool API adapter layer**: No existing framework transforms content for tool-specific APIs (Agent Teams, hooks, MCP config)
2. **MCP server as distribution mechanism**: Brain distributes via MCP tools, not just file placement
3. **Semantic knowledge graph backing**: No other agent skill system uses a knowledge graph for memory
4. **Multi-modal installation**: Brain combines plugin installation with MCP server configuration

### Risk Areas

1. **Over-engineering risk**: Most successful projects (AGENTS.md, Vercel Skills) succeed through simplicity. Brain's adapter layer adds complexity that must justify itself.
2. **Maintenance burden**: Per-tool adapters require tracking each tool's evolving capabilities and limitations
3. **Convergence risk**: As tools converge on AGENTS.md, tool-specific content may shrink, making adapters less valuable over time

## Observations

- [fact] AGENTS.md standard has 60,000+ project adoption and 20+ tool support as of Feb 2026 #ecosystem
- [fact] Vercel Skills CLI supports 40+ tools with identical content delivery (no transforms) #ecosystem
- [fact] Vercel evals show passive context (AGENTS.md) at 100% pass rate outperforms active retrieval (skills) at 79% #evidence
- [decision] Brain's canonical-content-plus-adapters architecture validated by community patterns #validation
- [fact] Symlink-preferred with copy-fallback is the universal pattern (npx skills, skills-supply, Skills Hub) #consensus
- [fact] Codex does not follow symlinks for skills directories (issue #8369, unresolved Jan 2026) #blocker
- [insight] Brain's tool API adapter layer is a novel contribution -- no ecosystem framework handles tool-specific API instructions #gap
- [risk] Adapter complexity must justify itself against the ecosystem's "simplicity wins" consensus #tradeoff
- [fact] Progressive context loading achieves 98% token reduction (150K to 2K) for large instruction sets #optimization
- [insight] Eliminating decision points via always-present context outperforms on-demand retrieval (Vercel eval data) #architecture

## Relations

- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[ANALYSIS-007-install-staging-strategy-research]]
- implements [[ADR-002-multi-tool-compatibility-architecture]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[FEAT-001 Multi-Tool Compatibility]]
