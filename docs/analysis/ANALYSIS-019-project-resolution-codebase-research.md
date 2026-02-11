---
title: ANALYSIS-019 Project Resolution Codebase Research
type: note
permalink: analysis/analysis-019-project-resolution-codebase-research
tags:
- resolution
- architecture
- worktree
- analysis
---

# ANALYSIS-019 Project Resolution Codebase Research

## Observations

- [fact] Project resolution uses a 6-level hierarchy: explicit param > Brain CLI active-project > BRAIN_PROJECT env > BM_PROJECT env > CWD matching > null #resolution #architecture
- [fact] CWD matching uses normalize + prefix comparison with path separator guard to prevent partial matches (e.g., /brain-other won't match /brain) #resolution #security
- [fact] When multiple projects match CWD (nested paths), the deepest/longest path wins (most specific match) #resolution #algorithm
- [fact] Three identical implementations exist: TypeScript (packages/utils/src/project-resolver.ts), Go (packages/utils/internal/project_resolver.go), and Bun hooks (templates/hooks/scripts/project-resolve.ts) #resolution #cross-language
- [fact] memories_mode has three options: DEFAULT (memories_location/project_name), CODE (code_path/docs), CUSTOM (explicit memories_path) #config #memories
- [fact] MCP server adds session state layer on top of utils resolver - setActiveProject writes BM_PROJECT env var so the utils resolver picks it up at level 4 #resolution #mcp
- [fact] Brain config schema (v2.0.0) at ~/.config/brain/config.json uses ProjectConfig with code_path (required), memories_path (optional), memories_mode (optional enum) #config #schema
- [fact] Translation layer (translation-layer.ts) converts Brain config to basic-memory config, resolving memories_mode to actual paths during translation #config #translation
- [insight] Zero git-related logic exists anywhere in the resolution chain - no git commands, no .git detection, no worktree awareness #gap #worktree
- [insight] The code_path field in config is a single string, not an array - no mechanism for multiple paths per project #gap #worktree
- [insight] Path normalization uses path.normalize + path.resolve but never follows symlinks at runtime #resolution #paths

## Relations

- relates_to [[ADR-020 Configuration Architecture]]
- relates_to [[FEAT-002 Git Worktree Support]]