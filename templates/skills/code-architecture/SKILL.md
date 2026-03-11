---
name: code-architecture
description: Architectural analysis workflow using Serena symbols and Brain memory. Use when analyzing project structure, documenting architecture, creating component entities, or building knowledge graphs from code.
license: MIT
metadata:
  version: 1.0.0
model: claude-opus-4-5
agents: [analyst, architect]
---

# Code Architecture Analysis

This skill guides systematic architectural analysis using Serena's symbol-level understanding, with optional persistence to Brain's knowledge graph.

## Triggers

| Trigger Phrase | Operation |
|----------------|-----------|
| `analyze the architecture of this project` | Full 6-phase analysis workflow |
| `map out the codebase structure` | Phase 1-3 discovery and component mapping |
| `trace dependencies for this component` | Phase 4 dependency tracing |
| `create architecture memories` | Phase 5-6 memory and entity creation |
| `what components does this project have` | Phase 3 core component mapping |

---

## When to Use This Skill

Use this skill when:

- Analyzing a new codebase before implementing changes
- Documenting existing architecture for a project
- Creating component entities and relationships in Brain memory
- Understanding dependencies and call hierarchies
- Building a knowledge graph from code structure

Use [code-symbols](../code-symbols/SKILL.md) instead when:

- Quick symbol lookup without memory persistence
- Finding a specific class or method definition
- Tracing references for a single symbol

## Analysis Workflow

### Phase 1: Project Structure Discovery

Understand the high-level layout:

```python
# Get directory structure
mcp__plugin_serena_serena__list_dir({
  "relative_path": ".",
  "recursive": false
})

# Identify key directories (src/, app/, lib/, etc.)
mcp__plugin_serena_serena__list_dir({
  "relative_path": "src",
  "recursive": true
})
```

**Goal**: Identify entry points, main modules, and organizational patterns.

### Phase 2: Entry Point Analysis

Find the application entry points:

```python
# Look for main/app files
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "if __name__.*==.*__main__|def main\\(|app\\s*=\\s*FastAPI|createApp",
  "restrict_search_to_code_files": true
})

# Get symbols from entry file
mcp__plugin_serena_serena__get_symbols_overview({
  "relative_path": "src/main.py",
  "depth": 1
})
```

### Phase 3: Core Component Mapping

Identify and analyze major components:

```python
# Find all service/controller/model classes
mcp__plugin_serena_serena__find_symbol({
  "name_path_pattern": "Service",
  "substring_matching": true,
  "include_kinds": [5],  # Class only
  "depth": 1
})

# For each major component, get full structure
mcp__plugin_serena_serena__find_symbol({
  "name_path_pattern": "AuthService",
  "include_body": false,
  "depth": 1  # Get methods
})
```

### Phase 4: Dependency Tracing

Understand how components connect:

```python
# Find who uses AuthService
mcp__plugin_serena_serena__find_referencing_symbols({
  "name_path": "AuthService",
  "relative_path": "src/services/auth.py"
})

# Find what AuthService depends on
mcp__plugin_serena_serena__find_symbol({
  "name_path_pattern": "AuthService/__init__",
  "include_body": true
})
```

### Phase 5: Create Architectural Memories (Optional)

Store findings in Brain memory notes:

```python
# Write a Brain memory note for architectural insight
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-001 AuthService Architecture",
  "content": "---\ntitle: ANALYSIS-001 AuthService Architecture\ntype: analysis\ntags: [auth, jwt, architecture]\n---\n\n# ANALYSIS-001 AuthService Architecture\n\n## Observations\n\n- [fact] AuthService handles JWT validation, user sessions, and OAuth flows #auth\n- [fact] Dependencies: UserRepository, TokenService, CacheService #dependencies\n- [fact] Used by all API endpoints via middleware #integration\n\n## Relations\n\n- part_of [[Project Architecture]]\n- depends_on [[UserRepository]]\n- depends_on [[TokenService]]",
  "folder": "analysis"
})
```

### Phase 6: Entity Graph Creation (Optional)

Create Brain memory notes for major components with relations:

```python
# Create component note with relations
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-002 Component Graph",
  "content": "---\ntitle: ANALYSIS-002 Component Graph\ntype: analysis\ntags: [components, graph, architecture]\n---\n\n# ANALYSIS-002 Component Graph\n\n## Observations\n\n- [fact] AuthService is central auth component #service\n- [fact] UserRepository handles data access #repository\n- [decision] Components linked via dependency injection #pattern\n\n## Relations\n\n- relates_to [[ANALYSIS-001 AuthService Architecture]]\n- part_of [[Project Architecture]]",
  "folder": "analysis"
})
```

## Relationship Types

Standard relationship types for architecture:

| Type | Use For |
|------|---------|
| `uses` | General usage (A uses B) |
| `depends_on` | Dependency (A requires B) |
| `calls` | Direct function/method calls |
| `extends` | Class inheritance |
| `implements` | Interface implementation |
| `connects_to` | External connections (DB, API) |
| `contains` | Composition (A contains B) |

## Entity Types for Architecture

| Type | Use For |
|------|---------|
| `Service` | Business logic services |
| `Repository` | Data access layer |
| `Controller` | Request handlers |
| `Middleware` | Request/response processing |
| `Model` | Data models/entities |
| `Library` | External dependencies |
| `Framework` | Framework components |

## Example: FastAPI Project Analysis

```python
# 1. Find routers
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "APIRouter\\(\\)|router\\s*=",
  "restrict_search_to_code_files": true
})

# 2. Analyze router structure
mcp__plugin_serena_serena__get_symbols_overview({
  "relative_path": "src/routers/users.py",
  "depth": 1
})

# 3. Find dependency injection
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "Depends\\(",
  "restrict_search_to_code_files": true,
  "context_lines_before": 1,
  "context_lines_after": 1
})

# 4. Trace service dependencies
mcp__plugin_serena_serena__find_referencing_symbols({
  "name_path": "get_current_user",
  "relative_path": "src/dependencies/auth.py"
})

# 5. Create architecture Brain memory note
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-003 FastAPI App Structure",
  "content": "---\ntitle: ANALYSIS-003 FastAPI App Structure\ntype: analysis\ntags: [fastapi, router, dependency-injection]\n---\n\n# ANALYSIS-003 FastAPI App Structure\n\n## Observations\n\n- [fact] App uses router-based organization with dependency injection #architecture\n- [fact] Routers: /users, /auth, /products #routing\n- [fact] Dependencies: get_current_user, get_db #dependencies\n- [fact] All routes require auth except /auth/login #security\n\n## Relations\n\n- part_of [[Project Architecture]]",
  "folder": "analysis"
})
```

## Analysis Checklist

- [ ] Directory structure mapped
- [ ] Entry points identified
- [ ] Major components catalogued
- [ ] Dependencies traced
- [ ] External connections documented
- [ ] Key patterns identified
- [ ] Brain memory notes created for insights
- [ ] Component notes created (if applicable)
- [ ] Relationships mapped (if applicable)

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Analyzing every class as a component | Creates noise in knowledge graph | Focus on major architectural components only |
| Reading full source before overview | Wastes tokens on unneeded code | Start with get_symbols_overview, read selectively |
| Creating notes without relations | Notes lack context without linked knowledge | Create notes with observations and relations |
| Skipping dependency tracing | Misses critical coupling relationships | Always run Phase 4 for components you create notes for |
| Documenting WHAT without WHY | Notes become stale quickly | Focus notes on rationale and trade-offs |

---

## Verification

After architectural analysis:

- [ ] Directory structure mapped (Phase 1)
- [ ] Entry points identified (Phase 2)
- [ ] Major components catalogued (Phase 3)
- [ ] Dependencies traced for key components (Phase 4)
- [ ] Brain memory notes created for insights
- [ ] Notes linked via relations

---

## Tips

1. **Work incrementally** - Don't try to analyze everything at once
2. **Focus on interfaces** - Public methods/APIs matter more than internals
3. **Document decisions** - Create notes for WHY, not just WHAT
4. **Use notes sparingly** - Only major components, not every class
5. **Link across projects** - Architecture patterns often apply elsewhere
