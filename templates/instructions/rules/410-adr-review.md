### ADR Review Requirement (MANDATORY)

ALL ADRs created or updated MUST trigger the adr-review skill before workflow continues. Applies to `ADR-*.md` files in `.agents/architecture/` and `docs/architecture/`.

```text
IF ADR created/updated:
  1. {{Worker}} returns to {{orchestrator_role}} with MANDATORY routing signal
  2. {{role_title}} invokes: Skill(skill="adr-review", args="[path to ADR]")
  3. adr-review completes (may take multiple rounds)
  4. {{role_title}} routes to next {{worker}} only after PASS
VIOLATION: Routing to next {{worker}} without adr-review is a protocol violation.
```

All {{workers}}: architect signals routing, {{orchestrator_role}} invokes skill, implementer signals if creating ADR. See `.claude/skills/adr-review/SKILL.md`.
