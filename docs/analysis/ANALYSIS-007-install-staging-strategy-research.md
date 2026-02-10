---
title: ANALYSIS-007-install-staging-strategy-research
type: analysis
permalink: analysis/analysis-007-install-staging-strategy-research
tags:
- analysis
- install
- staging
- symlink
- multi-tool
- architecture
---

# ANALYSIS-007 Install Staging Strategy Research

## Context

Research into whether `brain install` should write directly to tool config directories or use a staging directory with symlinks. Evaluates community best practices from package managers, editor plugin systems, and emerging AI agent installer patterns.

## Research Question

Should `brain install` use **direct write** (copy files directly into `~/.cursor/agents/`, `~/.gemini/skills/`, etc.) or **staging+symlink** (maintain a canonical staging area like `~/.cache/brain/` and symlink into tool directories)?

## Community Best Practices: Package Managers

### GNU Stow (Symlink Farm Manager)

The canonical tool for this exact problem. Stow stores packages in separate directories (`/usr/local/stow/{package}/`) and creates symlinks into the target tree (`/usr/local/bin/`, etc.). Key features:

- **Tree folding**: Entire subtrees reduced to a single symlink when possible
- **Conflict detection**: Refuses to overwrite files not owned by stow
- **Clean uninstall**: Remove symlinks without touching other files
- **Pattern**: Store once, link everywhere

### Homebrew (Cellar/Keg Pattern)

Installs to isolated Cellar (`/opt/homebrew/Cellar/{package}/{version}/`) and symlinks binaries into PATH (`/opt/homebrew/bin/`). Rationale:

- **Version isolation**: Multiple versions coexist in the Cellar
- **Atomic operations**: Replace symlinks atomically
- **Keg-only**: Some packages intentionally not linked (avoids conflicts with system binaries)
- **`/opt/homebrew/opt/`**: Always-valid stable symlink regardless of version

### Nix (Immutable Store + Generation Profiles)

Most sophisticated approach. Builds stored in content-addressed `/nix/store/` with immutable paths. User environments are symlink trees pointing into the store, organized into numbered generations:

- **Atomic upgrades**: New generation is a new symlink tree
- **Instant rollback**: Repoint profile symlink to previous generation
- **Immutability**: Store contents never modified
- **Pattern**: Build artifacts are immutable; what changes is which symlinks point where

### Mise/asdf (Version Managers)

Install tools to `~/.local/share/mise/installs/{tool}/{version}/`. Mise avoids shims (asdf's approach, 120ms overhead per call) in favor of PATH manipulation. Version prefixes and aliases are symlinks to concrete versions.

- **Pattern**: Concrete installs in managed directory, activation via PATH or symlinks

### Volta (Node Version Manager)

Uses shim binaries in `~/.volta/bin/` that route to the correct tool version in `~/.volta/tools/`. Shims are lightweight executables, not symlinks.

- **Pattern**: Central managed directory, shims for routing

## Community Best Practices: Editor Plugin Managers

### VS Code Extension Host

Extensions installed to `~/.vscode/extensions/{publisher.name-version}/`. Each extension is self-contained in its directory. VS Code discovers extensions by scanning the directory. No symlink indirection -- direct placement.

- **Pattern**: Direct write to well-known directory, discovery by scanning

### lazy.nvim (Neovim Plugin Manager)

Clones plugin repos directly into `~/.local/share/nvim/lazy/{plugin-name}/`. Manages the plugin lifecycle (install, update, clean) without symlink indirection.

- **Pattern**: Direct clone to managed directory, lockfile for versions

### `npx skills` (Vercel/Open Agent Skills)

The most directly relevant precedent. Offers two install modes:

- **Symlink (recommended)**: Stores skill once in canonical location, creates symlinks into each tool's directory (`~/.claude/skills/`, `~/.cursor/skills/`, etc.)
- **Copy**: Independent copies per tool (fallback when symlinks not supported)
- Auto-detects which tools are installed (35+ supported)
- Supports both project scope (`./{agent}/skills/`) and global scope (`~/{agent}/skills/`)
- **Pattern**: Canonical store + per-tool symlinks, with copy fallback

### Skills Hub (Desktop App)

Cross-platform app that syncs skills to multiple AI tools. Prefers symlink/junction but falls back to copy when symlinks are not supported.

## Symlink Support Status Per Tool (Feb 2026)

### Claude Code

- [PASS] Symlinks fully supported for plugins, skills, agents, rules
- Current `brain claude` pattern uses symlinks from `~/.cache/brain/claude-plugin/` to source files
- `brain plugin install` creates symlink farm in `~/.claude/plugins/` pointing to source

### Cursor

- [BLOCK] Symlink support is BROKEN as of Feb 2026
- Rules: Symlink regression reported Dec 2025, auto-closed Jan 2026 without fix
- Skills: `~/.cursor/skills/` does not follow symlinks (confirmed by Cursor team member Colin, Feb 6 2026: "fix is in the pipe")
- Global symlinked skills also not discovered
- **Workaround**: Use rsync/copy instead of symlinks
- Severity: Critical for multi-tool install strategy

### Gemini CLI

- [WARNING] Symlinks intentionally NOT followed for security
- GEMINI.md: Closed as "not planned" when it is a symlink -- security policy, not a bug
- settings.json: Symlinks destroyed when CLI rewrites config (issue closed as not planned, though a fix PR existed)
- Skills: Issue #16247 requesting symlink traversal for skills is closed (may be resolved)
- Commands: Symlinked directory commands not read (issue #4906)
- **Workaround**: Use `includeDirectories` config to reference external files

## Trade-Off Analysis

### Direct Write (Copy)

Pros:

- Works everywhere, no symlink compatibility concerns
- Each tool gets exactly the files it expects
- No dangling symlink risk if source moves
- Simpler mental model

Cons:

- N copies of content (disk space, sync nightmare)
- Updates require re-running install for all tools
- No single source of truth
- Uninstall must track what was written where

### Staging + Symlink (Stow Pattern)

Pros:

- Single source of truth (canonical staging area)
- Atomic updates (rebuild symlink farm)
- Clean uninstall (remove symlinks only)
- Source edits immediately visible (dev workflow)
- Proven pattern (Stow, Homebrew, Nix all use it)

Cons:

- Cursor does not follow symlinks (Feb 2026)
- Gemini CLI intentionally blocks symlinks
- Windows junctions/symlinks have permission issues
- Dangling symlinks if staging area moves

### Hybrid: Staging + Adaptive Write (Recommended)

The `npx skills` approach, adapted for Brain:

1. **Canonical staging area**: `~/.local/share/brain/plugins/{tool}/` (XDG-compliant)
2. **Per-tool write strategy**:
   - Claude Code: Symlinks (proven, current pattern works)
   - Cursor: File copy with rsync-like sync (symlinks broken)
   - Gemini CLI: File copy (symlinks intentionally blocked)
3. **Adapter decides**: Each tool adapter knows whether its target supports symlinks
4. **Single source of truth**: Canonical content at repo root, built to staging, then written per-tool
5. **Update command**: `brain update` regenerates staging and re-applies per-tool write strategy
6. **Manifest tracking**: `~/.local/share/brain/installed.json` tracks what was installed where for clean uninstall

This is the same approach `npx skills` uses (symlink recommended, copy fallback) but with the adapter making the decision automatically based on tool capabilities.

## Charmbracelet TUI Recommendation

For the install UX, use the `huh` Go library (charmbracelet/huh v2) directly rather than shelling out to the `gum` binary:

- `huh` is the Go library behind gum, providing the same UI primitives
- Eliminates external binary dependency
- Already in the charmbracelet ecosystem alongside bubbletea/bubbles/lipgloss
- Supports forms, multi-select, confirm, and progress
- Can embed huh forms inside bubbletea programs for inline progress

Pattern: `huh.NewForm()` with `huh.NewMultiSelect()` for tool selection, `huh.NewConfirm()` for confirmation, then bubbletea inline model for per-tool progress bars.

## Recommendation

**Use the Hybrid approach: Staging + Adaptive Write.**

Rationale:

1. The industry consensus (Stow, Homebrew, Nix, npx skills) is staging + symlinks
2. But Cursor and Gemini have broken/blocked symlink support as of Feb 2026
3. The adapter-per-tool pattern in ADR-002 naturally accommodates per-tool write strategies
4. Each adapter can encode whether its tool supports symlinks
5. When Cursor fixes symlinks, flip the adapter from copy to symlink without changing the architecture
6. The canonical staging area enables atomic updates and clean uninstalls regardless of write strategy

## Observations

- [decision] Hybrid staging + adaptive write is the recommended install strategy #architecture #install
- [fact] GNU Stow, Homebrew, and Nix all use staging + symlink as their core pattern #community
- [fact] npx skills (Vercel) uses symlink-preferred with copy fallback for multi-tool install #precedent
- [fact] Cursor IDE does not follow symlinks for rules or skills as of Feb 2026 (fix "in the pipe") #blocker
- [fact] Gemini CLI intentionally blocks symlinks for GEMINI.md and settings.json for security #blocker
- [fact] Claude Code fully supports symlinks for plugins, skills, agents, and rules #compatible
- [fact] charmbracelet/huh v2 is the Go library behind gum, eliminating need for external binary #tui
- [insight] The adapter-per-tool pattern from ADR-002 naturally accommodates per-tool write strategy decisions #alignment
- [risk] Cursor symlink fix has no confirmed release date; copy fallback must be production-quality #timeline
- [constraint] Canonical staging area should follow XDG base directory spec (~/.local/share/brain/) #standards

## Relations

- implements [[ADR-002-multi-tool-compatibility-architecture]]
- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[Brain CLI Architecture]]
