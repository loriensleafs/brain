---
status: accepted
date: 2026-02-01
adr_review_date: 2026-02-01
decision-makers: [architect, planner]
consulted: [analyst, implementer, security, critic, independent-thinker, high-level-advisor]
informed: [orchestrator, all agents]
consensus: 6/6 ACCEPT (unanimous)
---

# ADR-022: Schema-Driven Validation Architecture with Zod to AJV Migration

## Context and Problem Statement

Brain currently uses Zod for validation across 16 TypeScript files with 151 schema usages. The Go validation package (`packages/validation/`) implements validation logic independently using regex patterns and custom structs. This dual-implementation approach creates three critical problems:

1. **Validation drift**: Go and TypeScript validation rules evolve independently, causing inconsistent behavior
2. **Performance overhead**: Zod adds 50-80KB bundle size and is 5-18x slower than AJV for equivalent operations
3. **Cross-language barriers**: No shared schema format prevents unified validation rules

The project requires a single source of truth for validation schemas that works across TypeScript (MCP server) and Go (CLI tools, hooks, WASM).

## Decision Drivers

* **Cross-language consistency**: Validation must behave identically in TypeScript and Go
* **Performance**: MCP server validation occurs on every tool call; latency matters
* **Type safety**: TypeScript consumers need inferred types from schemas
* **Maintainability**: One schema definition, not two parallel implementations
* **Ecosystem compatibility**: MCP protocol uses JSON Schema natively
* **Migration cost**: 16 files with 151 Zod usages require migration effort

## Considered Options

### Option A: Keep Zod, Generate JSON Schema for Go

Maintain Zod as primary schema definition. Use `zod-to-json-schema` to export JSON Schema for Go consumption.

**Pros:**
* No TypeScript code changes required
* Zod developer experience preserved
* Existing code continues working

**Cons:**
* Zod-to-JSON-Schema conversion has edge cases (transforms, refinements)
* Two-step process: define in Zod, then export
* Zod performance overhead remains
* Generated JSON Schema may not match hand-crafted Go expectations

### Option B: Adopt JSON Schema as Single Source, AJV in TypeScript, santhosh-tekuri/jsonschema in Go

Define all schemas in JSON Schema format. Use AJV for TypeScript validation, santhosh-tekuri/jsonschema for Go. Generate TypeScript types from schemas.

**Pros:**
* JSON Schema is the universal validation standard
* AJV is 5-18x faster than Zod in benchmarks
* Native JSON Schema support in both ecosystems
* MCP protocol already uses JSON Schema for tool definitions
* Type generation via json-schema-to-typescript
* AJV already in dependencies: `ajv@^8.17.1` and `ajv-formats@^3.0.1` present in both `apps/mcp/package-lock.json` and root `bun.lock`

**Cons:**
* Requires Zod migration effort (12-18 hours estimated)
* JSON Schema syntax more verbose than Zod
* Loses Zod's TypeScript-first ergonomics

### Option C: Keep Current WASM Bridge Only

Continue using packages/validation WASM bridge for Go validation, Zod for TypeScript.

**Pros:**
* No migration required
* Existing architecture unchanged

**Cons:**
* WASM overhead for Go consumers
* Validation logic still duplicated
* No schema sharing between languages
* Performance penalty from WASM layer

### Option D: Protocol Buffers with protovalidate

Use Protocol Buffers as schema format with protovalidate for cross-language validation.

**Pros:**
* Strong cross-language support
* Binary serialization efficient
* Widely used in microservices

**Cons:**
* Protobuf toolchain complexity
* Not native to JSON APIs
* Overkill for this use case
* Poor fit with MCP's JSON-based protocol

## Decision Outcome

**Chosen option: Option B** - Adopt JSON Schema as single source of truth with AJV for TypeScript and santhosh-tekuri/jsonschema for Go.

### Justification

| Criterion | Weight | Option A | Option B | Option C | Option D |
|-----------|--------|----------|----------|----------|----------|
| Cross-language consistency | High | Medium | High | Low | High |
| Performance | High | Low | High | Medium | Medium |
| Type safety | High | High | High | High | Medium |
| Maintainability | High | Medium | High | Low | Medium |
| MCP compatibility | High | Medium | High | Low | Low |
| Migration effort | Medium | None | 12-18h | None | 20-30h |

**Option B wins** because:
1. JSON Schema is MCP's native schema format (tool inputSchema already uses it)
2. AJV performance (5-18x faster) matters for MCP tool call validation
3. santhosh-tekuri/jsonschema is 2x faster than Go alternatives and JSON Schema native
4. Single schema file serves both languages without conversion
5. AJV (`ajv@8.17.1`, `ajv-formats@3.0.1`) already installed - verified in `apps/mcp/package-lock.json` and root `bun.lock`

### Consequences

**Good:**
* Validation rules defined once, used everywhere
* 5-18x faster TypeScript validation
* Native MCP tool schema alignment
* Type generation eliminates manual interface definitions
* Go and TypeScript validation guaranteed identical

**Bad:**
* 12-18 hour migration effort for 16 files (session/types.ts alone requires 4-6 hours)
* JSON Schema syntax more verbose than Zod
* Team must learn JSON Schema conventions
* Type generation adds build step

### Confirmation

Implementation confirmed via:
* All 16 schema files migrated to JSON Schema
* json-schema-to-typescript generates types without errors
* AJV validates all existing test cases
* Go validation uses same JSON Schema files
* Performance benchmarks show expected improvement

## Migration Plan

### Phase 1: Infrastructure (2 hours)

1. Create `packages/validation/schemas/` directory
2. Add json-schema-to-typescript to dev dependencies
3. Create schema compilation script for type generation
4. Configure AJV with ajv-formats for string formats

### Phase 2: Schema Migration (8-10 hours)

Migrate schemas in dependency order:

| Priority | File | Zod Usages | Complexity |
|----------|------|------------|------------|
| 1 | config/schema.ts | 26 | High (nested objects) |
| 2 | services/session/types.ts | 63 | Critical (17 schemas, deeply nested unions, discriminated types) |
| 3 | config/index.ts | 10 | Medium (imports from schema.ts) |
| 4 | tools/config/schema.ts | 14 | Medium |
| 5 | tools/workflow/schema.ts | 9 | Medium |
| 6 | tools/search/schema.ts | 4 | Low |
| 7 | tools/projects/*.ts (6 files) | 16 | Low (create:3, edit:3, get:3, delete:3, list:2, active:2) |
| 8 | config/inngest.ts | 3 | Low |
| 9 | tools/bootstrap-context/schema.ts | 2 | Low |
| 10 | tools/list-features-by-priority/schema.ts | 2 | Low |
| 11 | tools/session/schema.ts | 2 | Low |

**Note**: `services/session/types.ts` is the highest-risk file with 63 Zod usages across 17 distinct schemas including `SessionStateSchema`, `OrchestratorWorkflowSchema`, and multiple enum/union types. This file alone requires 4-6 hours due to deeply nested schema composition and cross-schema references.

### Phase 3: Go Integration (2-3 hours)

1. Add santhosh-tekuri/jsonschema dependency to Go modules
2. Create schema loader in packages/validation
3. Migrate existing Go validators to use JSON Schema
4. Remove duplicate validation logic

### Phase 4: Validation (1-2 hours)

1. Run existing test suites
2. Add cross-language validation tests
3. Benchmark performance improvements
4. Document schema authoring guidelines

### Effort Summary

| Phase | Hours | Risk |
|-------|-------|------|
| Infrastructure | 2 | Low |
| Schema Migration | 8-10 | High (session/types.ts complexity) |
| Go Integration | 2-3 | Low |
| Validation | 2-3 | Medium |
| **Total** | **14-18** | Medium-High |

**Revised Estimate Rationale**: Original estimate (8-12h) underestimated `session/types.ts` complexity. Actual inventory found 151 Zod usages (not 106), with 63 concentrated in `session/types.ts`. This file contains 17 interdependent schemas with deeply nested unions, discriminated types, and cross-schema references that require careful decomposition into JSON Schema `$ref` patterns.

## Schema Organization

```
packages/validation/
  schemas/
    config/
      brain-config.schema.json      # BrainConfig
      project-config.schema.json    # ProjectConfig
    tools/
      search.schema.json            # SearchArgs
      workflow.schema.json          # WorkflowArgs
      session.schema.json           # SessionArgs
      projects/
        create.schema.json
        edit.schema.json
        delete.schema.json
        list.schema.json
        get.schema.json
        active.schema.json
    common/
      enums.schema.json             # Shared enums
      base.schema.json              # Common definitions
  generated/
    types.ts                        # Auto-generated TypeScript types
  validate.ts                       # AJV validation functions
  validate.go                       # Go validation functions
```

## Type Generation Approach

### TypeScript

```bash
# Build script in package.json
npx json-schema-to-typescript \
  packages/validation/schemas/**/*.schema.json \
  --out packages/validation/generated/types.ts \
  --bannerComment "/* Auto-generated from JSON Schema. Do not edit. */"
```

### Go

Go types defined manually in packages/validation/types.go, validated against same schemas. Future enhancement: use a]tkins/go-jsontypedef for Go type generation.

## Performance Justification

AJV benchmarks (from ajv.js.org):

| Validator | Operations/sec | Relative |
|-----------|---------------|----------|
| AJV | 50,000 | 1x |
| Zod | 2,800-10,000 | 5-18x slower |
| Yup | 2,500 | 20x slower |

For MCP server processing multiple tool calls per second, AJV's performance provides meaningful latency reduction.

Go santhosh-tekuri/jsonschema benchmarks:

| Library | ns/op | Relative |
|---------|-------|----------|
| santhosh-tekuri/jsonschema | 1,200 | 1x |
| xeipuuv/gojsonschema | 2,400 | 2x slower |

## Zod to JSON Schema Migration Example

**Before (Zod):**
```typescript
import { z } from "zod";

export const SearchArgsSchema = z.object({
  query: z.string().min(1).describe("Search query text"),
  limit: z.number().int().min(1).max(100).default(10),
  mode: z.enum(["auto", "semantic", "keyword", "hybrid"]).default("auto"),
});

export type SearchArgs = z.infer<typeof SearchArgsSchema>;
```

**After (JSON Schema + AJV):**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://brain.dev/schemas/search-args.json",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 1,
      "description": "Search query text"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 10
    },
    "mode": {
      "type": "string",
      "enum": ["auto", "semantic", "keyword", "hybrid"],
      "default": "auto"
    }
  },
  "required": ["query"]
}
```

```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";
import searchArgsSchema from "./schemas/tools/search.schema.json";
import type { SearchArgs } from "./generated/types";

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

const validateSearchArgs = ajv.compile<SearchArgs>(searchArgsSchema);

export function parseSearchArgs(data: unknown): SearchArgs {
  if (validateSearchArgs(data)) {
    return data;
  }
  throw new Error(ajv.errorsText(validateSearchArgs.errors));
}
```

## Reversibility Assessment

- [x] **Rollback capability**: Can revert to Zod by restoring schema files from git history
- [x] **Vendor lock-in**: None - JSON Schema is an open standard
- [x] **Exit strategy**: AJV and santhosh-tekuri/jsonschema can be replaced with any JSON Schema validator
- [ ] **Legacy impact**: Existing Zod schemas must be migrated (no backward compatibility)
- [x] **Data migration**: No data migration required - only schema format changes

## Security Controls

### Schema Source Security

- Schemas MUST only load from `packages/validation/schemas/`
- AJV config: `loadSchema: undefined` (prevent remote schema fetch)
- Go: embed schemas via `//go:embed` directive (no filesystem access at runtime)

### Error Handling

- Validation errors MUST NOT expose raw input in production
- Use structured errors: `{field, constraint, message}`
- Sanitize error messages before logging or returning to clients
- Example safe error format:

```typescript
interface ValidationError {
  field: string;       // "query" not the actual value
  constraint: string;  // "minLength" not "value was ''"
  message: string;     // "Field must have minimum length of 1"
}
```

### Type Coercion

- AJV config: `coerceTypes: false` (strict validation, no implicit conversions)
- Migration tests MUST verify equivalent rejection behavior between Zod and AJV
- String-to-number coercion disabled to prevent injection via type confusion

### AJV Security Configuration

```typescript
const ajv = new Ajv({
  allErrors: true,         // Report all errors, not just first
  useDefaults: true,       // Apply schema defaults
  coerceTypes: false,      // SECURITY: No type coercion
  loadSchema: undefined,   // SECURITY: Disable remote schema loading
  strict: true,            // Strict mode for better error detection
});
```

## Vendor Lock-in Assessment

**Dependency**: AJV (TypeScript), santhosh-tekuri/jsonschema (Go)
**Lock-in Level**: None

### Lock-in Indicators
- [x] Open standard (JSON Schema) - no proprietary formats
- [x] Multiple alternative validators available
- [x] No data format lock-in
- [x] MIT licensed libraries

### Exit Strategy
**Trigger conditions**: AJV maintenance stops or better validator emerges
**Migration path**: Replace AJV with any JSON Schema validator (tv4, djv, z-schema)
**Estimated effort**: 2-4 hours to swap validator library
**Data export**: Schemas are portable JSON files

## Relations

- supersedes [[specs/trigger-mappings/decision-validation-functions-mapping]] - Previous Zod-first decision
- relates_to [[analysis/validation-composition-patterns/analysis-validation-logic-composition-across-execution-contexts]]
- enables [[Cross-language validation consistency]]
- impacts [[apps/mcp/src/config/schema.ts]]
- impacts [[packages/validation/]]

## More Information

### References

* [AJV Documentation](https://ajv.js.org/)
* [JSON Schema Specification](https://json-schema.org/)
* [santhosh-tekuri/jsonschema](https://github.com/santhosh-tekuri/jsonschema)
* [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript)
* [MCP Tool Schema Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

### Team Agreement

To be captured after ADR review.

### Realization Timeline

* Week 1: Infrastructure and schema migration
* Week 2: Go integration and validation
* Week 3: Documentation and cleanup
