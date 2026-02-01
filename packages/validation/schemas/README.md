# JSON Schema Directory

This directory contains JSON Schema files that serve as the single source of truth for validation data structures.

## Architecture

```text
schemas/           <- JSON Schema source files (hand-authored)
generated/         <- TypeScript types (auto-generated, do not edit)
```

## Usage

### Source of Truth

JSON Schema files in this directory define the canonical structure for:

- Session protocol validation
- Workflow configurations
- PR review structures
- Skill definitions

All implementations (Go, TypeScript) validate against these schemas.

### Type Generation

TypeScript types are generated from schemas using json-schema-to-typescript:

```bash
npx json-schema-to-typescript schemas/*.json -o generated/
```

Generated files in `generated/` are committed to the repository. Do not edit them manually.

### Runtime Validation

| Language | Library | Purpose |
|----------|---------|---------|
| Go | santhosh-tekuri/jsonschema | CLI tools, CI validation |
| TypeScript | AJV | Browser/Node runtime, WASM |

### Adding a New Schema

1. Create `schemas/[name].schema.json` following JSON Schema draft-07
2. Run type generation: `npx json-schema-to-typescript schemas/[name].schema.json -o generated/`
3. Import generated types in TypeScript code
4. Load schema in Go validation code

### Schema Naming Convention

- File: `[domain].schema.json` (e.g., `session-protocol.schema.json`)
- Schema $id: `https://brain.local/schemas/[domain].json`

### Validation Example (TypeScript)

```typescript
import Ajv from 'ajv';
import schema from '../schemas/session-protocol.schema.json';
import type { SessionProtocol } from '../generated/session-protocol';

const ajv = new Ajv();
const validate = ajv.compile<SessionProtocol>(schema);

if (!validate(data)) {
  console.error(validate.errors);
}
```

### Validation Example (Go)

```go
import "github.com/santhosh-tekuri/jsonschema/v5"

schema, _ := jsonschema.Compile("schemas/session-protocol.schema.json")
err := schema.Validate(data)
```
