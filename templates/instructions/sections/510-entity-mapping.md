### Entity Type to Folder Mapping

**File names MUST match the pattern exactly. Prefix MUST be ALL CAPS (`ADR-`, `SESSION-`, `REQ-`). Lowercase prefixes are malformed and break lookups.**

| Entity Type | Folder | File Pattern |
|:--|:--|:--|
| decision | decisions/ | `ADR-{NNN}-{topic}.md` |
| session | sessions/ | `SESSION-YYYY-MM-DD_NN-{topic}.md` |
| requirement | specs/{ENTITY-NNN-topic}/requirements/ | `REQ-{NNN}-{topic}.md` |
| design | specs/{ENTITY-NNN-topic}/design/ | `DESIGN-{NNN}-{topic}.md` |
| task | specs/{ENTITY-NNN-topic}/tasks/ | `TASK-{NNN}-{topic}.md` |
| analysis | analysis/ | `ANALYSIS-{NNN}-{topic}.md` |
| feature | planning/ | `FEATURE-{NNN}-{topic}.md` |
| epic | roadmap/ | `EPIC-{NNN}-{name}.md` |
| critique | critique/ | `CRIT-{NNN}-{topic}.md` |
| test-report | qa/ | `QA-{NNN}-{topic}.md` |
| security | security/ | `SEC-{NNN}-{component}.md` |
| retrospective | retrospective/ | `RETRO-YYYY-MM-DD_{topic}.md` |
| skill | skills/ | `SKILL-{NNN}-{topic}.md` |

**No generic `NOTE-*` type allowed.** Specs folder naming uses parent entity: `specs/ADR-015-auth-strategy/requirements/REQ-001-token-validation.md`

The **title in frontmatter** is the canonical entity identifier. Prefix in title MUST be ALL CAPS (`ADR-015`, not `adr-015`). Reference with exact title in wikilinks: `- implements [[ADR-015 Auth Strategy]]`
