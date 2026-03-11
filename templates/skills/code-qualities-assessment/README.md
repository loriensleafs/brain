# Code Qualities Assessment Skill

Assess code maintainability through 5 foundational software engineering qualities.

## Quick Start

```bash
# Assess a file
bun run scripts/assess.ts --target src/services/auth.ts

# Assess changed files (CI mode)
bun run scripts/assess.ts --target . --changed-only --format json

# Generate markdown report
bun run scripts/assess.ts --target src/ --format markdown --output report.md
```

## The 5 Qualities

1. **Cohesion**: How strongly related are responsibilities within a boundary?
2. **Coupling**: How dependent is this code on other code?
3. **Encapsulation**: How well are implementation details hidden?
4. **Testability**: How easily can behavior be verified in isolation?
5. **Non-Redundancy**: How unique is each piece of knowledge?

## Files

```text
code-qualities-assessment/
├── SKILL.md                        # Main skill documentation
├── README.md                       # This file
├── scripts/
│   └── assess.ts                   # Main assessment orchestrator
├── templates/
│   └── .qualityrc.json             # Configuration template
└── references/
    ├── calibration-examples.md     # Scoring examples for team calibration
    └── refactoring-patterns.md     # Remediation patterns
```

## Configuration

Create `.qualityrc.json` in your project root:

```json
{
  "thresholds": {
    "cohesion": { "min": 7, "warn": 5 },
    "coupling": { "max": 3, "warn": 5 },
    "encapsulation": { "min": 7, "warn": 5 },
    "testability": { "min": 6, "warn": 4 },
    "nonRedundancy": { "min": 8, "warn": 6 }
  },
  "ignore": ["**/generated/**", "**/*.pb.py"]
}
```

## Language Support

**Fully Supported**: Python, TypeScript/JavaScript, C#, Java, Go
**Partial Support**: Ruby, Rust, PHP, Kotlin

## Integration Examples

### CI/CD Pipeline

```bash
# GitHub Actions
- name: Check code quality
  run: |
    bun run .claude/skills/code-qualities-assessment/scripts/assess.ts \
      --target src/ \
      --changed-only \
      --format json \
      --output quality.json
```

### Pre-commit Hook

```bash
#!/bin/bash
bun run .claude/skills/code-qualities-assessment/scripts/assess.ts \
  --target $(git diff --cached --name-only) \
  --format markdown
```

## Timelessness: 9/10

These qualities are computer science fundamentals from the 1960s-1990s:

- Cohesion and coupling: Parnas (1972), Stevens (1974)
- Encapsulation: Core OOP principle (1960s)
- Testability: TDD movement (1990s-2000s)
- DRY: Hunt & Thomas, Pragmatic Programmer (1999)

Language-agnostic design ensures longevity.

## License

MIT
