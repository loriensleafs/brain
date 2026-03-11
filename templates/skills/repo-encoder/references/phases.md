# Encode Repository Phases

Detailed phase workflows for Brain-enhanced repository encoding.

---

## Phase 0: Discovery & Assessment (ALWAYS START HERE)

### Step 1: Activate Project in Serena

**CRITICAL**: Serena requires an active project before any operations. Activate it first:

```
mcp__plugin_serena_serena__activate_project({
  "project": "<project_path_or_name>"
})
```

Use the current working directory path, or if the project is registered, use its name from the known projects list.

If activation fails with "No active project", Serena will show available registered projects - pick the matching one or provide the full path.

### Step 2: Explore Project Structure

```
mcp__plugin_serena_serena__list_dir({
  "relative_path": ".",
  "recursive": true,
  "skip_ignored_files": true
})
```

### Step 3: Check Existing Brain Coverage

```
mcp__plugin____brain__search({
  "query": "<project-name> architecture",
  "limit": 10
})
```

If notes exist, review for gaps:

```
mcp__plugin____brain__list_directory({
  "dir_name": "analysis"
})
```

### Step 4: Analyze Entry Points

Read key files to understand project:

```
mcp__plugin_serena_serena__read_file({"relative_path": "README.md"})
mcp__plugin_serena_serena__read_file({"relative_path": "pyproject.toml"})
# or package.json, Cargo.toml, etc.
```

### Step 5: Gap Analysis

Compare:

- What's in Brain knowledge base?
- What exists in codebase?
- What's missing?

Report findings before proceeding.

---

## Phase 1: Project Foundation (5-10 notes)

### Create Foundation Brain Memory Notes

Write Brain memory notes for each foundation topic:

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-001 Project Overview",
  "content": "---\ntitle: ANALYSIS-001 Project Overview\ntype: analysis\ntags: [overview, foundation, architecture]\n---\n\n# ANALYSIS-001 Project Overview\n\n## Observations\n\n- [fact] Entry point: bun run src/main.ts <mode> #entry\n- [fact] Tech stack: Bun, TypeScript, SQLite #tech-stack\n- [fact] Architecture: 6-layer (Data->Domain->Processing->ML->Strategy->Presentation) #architecture\n- [fact] Key patterns: Repository, Async generators, Batch writes, Factory #patterns\n\n## Relations\n\n- part_of [[Project Architecture]]",
  "folder": "analysis"
})
```

1. **Project Overview** (high importance)
2. **Technology Stack** (high importance)
3. **Architecture Pattern** (high importance)
4. **Development Setup** (medium importance)
5. **Testing Strategy** (medium importance)

---

## Phase 1B: Dependency Analysis

**Purpose**: Extract and document project dependencies systematically.

### Step 1: Detect Manifest Files

Look for dependency manifests:

```
mcp__plugin_serena_serena__find_file({
  "file_mask": "package.json",
  "relative_path": "."
})
```

Common manifests to check:

- `package.json` (Node.js)
- `pyproject.toml`, `requirements.txt`, `Pipfile` (Python)
- `Cargo.toml` (Rust)
- `go.mod` (Go)
- `Gemfile` (Ruby)
- `pom.xml`, `build.gradle` (Java)

### Step 2: Parse Dependencies

Read manifest and extract:

- Direct dependencies (name, version)
- Dev dependencies
- Categorize by role: framework, library, database, tool

### Step 3: Create Dependency Brain Memory Note

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-002 Dependencies",
  "content": "---\ntitle: ANALYSIS-002 Dependencies\ntype: analysis\ntags: [dependencies, tech-stack, frameworks]\n---\n\n# ANALYSIS-002 Dependencies\n\n## Observations\n\n- [fact] Language: Python 3.12 #language\n- [fact] Core frameworks: FastAPI, SQLAlchemy #frameworks\n- [fact] Data/storage: PostgreSQL, Redis #storage\n- [fact] Dev tools: pytest, black, mypy #dev-tools\n\n## Relations\n\n- relates_to [[ANALYSIS-001 Project Overview]]",
  "folder": "analysis"
})
```

---

## Phase 2: Symbol-Level Architecture (10-15 notes)

**This is where Serena shines.**

### Step 1: Get Symbol Overview for Key Files

For each major source file:

```
mcp__plugin_serena_serena__get_symbols_overview({
  "relative_path": "src/main.py",
  "depth": 1
})
```

This returns classes, functions, methods with their locations.

### Step 2: Analyze Key Classes/Modules

For important symbols discovered:

```
mcp__plugin_serena_serena__find_symbol({
  "name_path_pattern": "ClassName",
  "include_body": false,
  "depth": 1
})
```

### Step 3: Discover Relationships

For core classes/functions:

```
mcp__plugin_serena_serena__find_referencing_symbols({
  "name_path": "ClassName/method_name",
  "relative_path": "src/module.py"
})
```

This reveals:

- Who calls this method?
- Where is this class used?
- What depends on what?

### Step 4: Create Architecture Brain Memory Notes

For each architectural layer discovered:

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-003 Data Layer Architecture",
  "content": "---\ntitle: ANALYSIS-003 Data Layer Architecture\ntype: analysis\ntags: [architecture, data-layer]\n---\n\n# ANALYSIS-003 Data Layer Architecture\n\n## Observations\n\n- [fact] Key symbols: ConnectionPool, Repository, DataFetcher #symbols\n- [fact] Pattern: Repository pattern with async generators #pattern\n- [decision] Serena symbol analysis confirms dependency direction #analysis\n\n## Relations\n\n- part_of [[ANALYSIS-001 Project Overview]]",
  "folder": "analysis"
})
```

---

## Phase 2B: Entity Graph Creation

**Purpose**: Build a knowledge graph of project components and their relationships via Brain memory notes.

### Deduplication (ALWAYS CHECK FIRST)

Before creating any note, search for existing ones:

```
mcp__plugin____brain__search({
  "query": "<component-name>",
  "limit": 5
})
```

- **If found**: Use existing note, optionally edit to add observations
- **If not found**: Create with comprehensive observations

### Step 1: Create Notes for Major Components

For each major component discovered via Serena:

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-004 AuthenticationService",
  "content": "---\ntitle: ANALYSIS-004 AuthenticationService\ntype: analysis\ntags: [service, auth, component]\n---\n\n# ANALYSIS-004 AuthenticationService\n\n## Observations\n\n- [fact] Centralized auth service at src/services/auth.py #location\n- [fact] Handles token validation, user context injection #responsibility\n- [fact] High reference count from Serena analysis #importance\n\n## Relations\n\n- depends_on [[UserRepository]]\n- depends_on [[TokenService]]\n- part_of [[ANALYSIS-003 Data Layer Architecture]]",
  "folder": "analysis"
})
```

### Step 2: Create Notes for Key Dependencies

For external libraries central to the project, create notes with relations.

### Step 3: Map Relationships via Relations

Use Brain memory note relations to connect components:

**Relationship types**:

- `uses` - project/component uses library
- `depends_on` - component depends on another
- `calls` - service calls another service
- `extends` - class extends base class
- `implements` - class implements interface
- `connects_to` - system connects to database/service

---

## Phase 3: Pattern Discovery (8-12 notes)

### Search for Common Patterns

```
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "async def",
  "restrict_search_to_code_files": true,
  "context_lines_before": 2,
  "context_lines_after": 5
})
```

Useful patterns to search:

- Error handling: `except|catch|Error`
- Dependency injection: `Depends|@inject|Container`
- Decorators: `@app\.|@router\.|@middleware`
- Database patterns: `session|transaction|commit`

### Analyze Pattern Usage

For each pattern found, use symbol analysis:

```
mcp__plugin_serena_serena__find_symbol({
  "name_path_pattern": "pattern_name",
  "substring_matching": true,
  "include_body": true
})
```

### Create Pattern Brain Memory Notes

Document recurring patterns with actual code locations and usage counts.

---

## Phase 4: Critical Features (1-2 per feature)

### Identify Features via Symbol Analysis

Look for route handlers, API endpoints, main workflows:

```
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "@(app|router)\\.(get|post|put|delete)",
  "restrict_search_to_code_files": true
})
```

### Trace Feature Flow

For each feature:

1. Find the entry point symbol
2. Use `find_referencing_symbols` to trace downstream
3. Document the complete flow in a Brain memory note

---

## Phase 5: Design Decisions (from documentation only)

**CRITICAL: Only capture explicitly documented decisions.**

Search for decision documentation:

```
mcp__plugin_serena_serena__search_for_pattern({
  "substring_pattern": "Decision:|Rationale:|## Why|ADR-",
  "paths_include_glob": "**/*.md"
})
```

If found, create decision Brain memory notes. If not, skip this phase.

---

## Phase 6: Code Artifacts

For reusable patterns discovered via Serena, create Brain memory notes documenting them.

---

## Phase 6B: Symbol Index Note

**Purpose**: Compile Serena's LSP symbol analysis into a permanent, searchable Brain memory note.

This captures symbol locations, relationships, and reference counts that would otherwise be lost when Serena is not active.

### Step 1: Aggregate Symbol Data

Collect from all `get_symbols_overview` and `find_symbol` calls during Phase 2:

- Classes with file locations and line numbers
- Interfaces with their implementations
- Key functions with callers (from `find_referencing_symbols`)
- Reference counts for each symbol

### Step 2: Create Symbol Index Brain Memory Note

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-010 Symbol Index",
  "content": "---\ntitle: ANALYSIS-010 Symbol Index\ntype: analysis\ntags: [symbol-index, reference, navigation]\n---\n\n# ANALYSIS-010 Symbol Index\n\nGenerated via Serena LSP analysis.\n\n## Observations\n\n- [fact] Total: X classes, Y interfaces, Z functions #scope\n- [fact] Top referenced symbols listed below #navigation\n\n## Classes\n\n| Symbol | Location | Description | Refs |\n|--------|----------|-------------|------|\n| ClassName | path/file.py:line | Brief description | count |\n\n## Relations\n\n- part_of [[ANALYSIS-001 Project Overview]]",
  "folder": "analysis"
})
```

### Size Guidelines

| Project Size | Est. Symbols | Split? |
|--------------|--------------|--------|
| Small | <50 | No |
| Medium | 50-150 | No |
| Large | 150+ | Yes, by layer |

**If splitting** (large projects):

- Create separate notes per architectural layer
- Each note gets its own relations

---

## Phase 7: Documents (as needed)

For content >400 words (detailed guides, comprehensive analysis), create Brain memory notes with full content.

---

## Phase 7B: Architecture Note

**Purpose**: Consolidate architecture analysis into a comprehensive reference note that persists Serena's insights.

### Step 1: Synthesize Architecture Content

Combine insights from:

- Phase 2 architecture notes (symbol-level analysis)
- Phase 2B component relations (component graph)
- Phase 3 pattern discoveries
- Serena's `find_referencing_symbols` relationship data

### Step 2: Create Architecture Brain Memory Note

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-020 Architecture Reference",
  "content": "---\ntitle: ANALYSIS-020 Architecture Reference\ntype: analysis\ntags: [architecture, reference, design]\n---\n\n# ANALYSIS-020 Architecture Reference\n\n## Observations\n\n- [fact] N-layer architecture: list layers #architecture\n- [fact] Key patterns: top 4-5 patterns #patterns\n- [fact] Core components: top 5 by reference count #components\n\n## Relations\n\n- contains [[ANALYSIS-003 Data Layer Architecture]]\n- contains [[ANALYSIS-010 Symbol Index]]",
  "folder": "analysis"
})
```

### Size Guidelines

- **Target**: 3000-8000 words
- **If exceeding 8000 words**, consider splitting by layer or concern
- Each split note gets its own relations

---

## Execution Guidelines
