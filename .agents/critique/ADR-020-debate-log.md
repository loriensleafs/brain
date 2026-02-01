# ADR-020 Debate Log: Configuration Architecture Refactoring

**ADR**: ADR-020 Configuration Architecture Refactoring
**Review Date**: 2026-01-31
**Session**: Session 07 - Memory Skill Migration
**Consensus**: 5 ACCEPT + 1 DISAGREE-AND-COMMIT = **APPROVED**

---

## Phase 0: Related Work Research

**Memory Search**: No existing configuration architecture decisions found in Brain memory.

**Related ADRs**:
- ADR-007: Memory-First Architecture (abstraction principle)
- ADR-016: Session Protocol Enforcement
- ADR-017: Memory Tool Naming Strategy (terminology alignment)
- ADR-019: Memory Operations Governance

---

## Phase 1: Independent Reviews

### Architect Review

**Verdict**: CONCERNS
**Key Issues**:
- P0: Translation layer sync direction ambiguous (one-way vs bidirectional)
- P0: TUI/MCP coordination for config not explicit
- P1: Missing test strategy
- P1: Cross-language implementation (Go TUI + TypeScript MCP) not clarified

**Recommendations**: Add architecture note clarifying TUI delegates to MCP, add test coverage section

### Critic Review

**Verdict**: CONCERNS (Conditional Approval)
**Critical Issues**:
- Translation layer atomicity undefined
- basic-memory config ownership conflict (who can write?)
- Migration data loss risk (no pre-archive validation)
- Test strategy missing entirely
- Error handling undefined
- Hardcoded paths remain without fallback specification

**Stress Test Failures**: 5 failure scenarios identified (race conditions, partial migration, manual edit corruption, field drift, permission denied)

### Independent-Thinker Review

**Verdict**: CONCERNS
**Challenged Assumptions**:
- "User confusion" is hypothetical (no documented complaints)
- Translation layer provides flexibility for backend swap (not planned)
- XDG compliance violates macOS conventions
- Two config files problem not actually solved (still two files, one "hidden")

**Alternative Approaches**:
- Unify into basic-memory config
- Environment-only configuration
- Do nothing (current state works)

**Concerns**: Synchronization complexity, aggressive migration timeline, scope creep (bundling unrelated changes)

### Security Review

**Verdict**: CONDITIONAL
**Risk Score**: 5.8/10 (Medium)
**Security Issues**:
- CWE-22: Path traversal vulnerability (no validation for arbitrary paths)
- CWE-732: File permission specifications missing
- CWE-200: Migration backup data exposure
- CWE-20: Input validation incomplete
- CWE-116: Translation layer encoding not specified

**Required Mitigations**: Path validation section, file permissions, input validation table, migration backup security

### Analyst Review

**Verdict**: ACCEPT with CONCERNS
**Findings**:
- Evidence quality: Thorough with minor gaps
- Feasibility: Implementable
- Effort estimates: Underestimated by 30-50%
- Dependencies: 2 critical missing (schema validation library, basic-memory schema docs)

**Concerns**: 6 hardcoded instances found (not 7 as claimed), basic-memory schema undocumented, XDG on Windows untested

### High-Level-Advisor Review

**Verdict**: CONCERNS (P2 Priority)
**Strategic Assessment**:
- No evidence of actual user pain (hypothetical confusion)
- Premature abstraction for speculative backend swap
- Opportunity cost not quantified (2-4 weeks for zero new capability)
- Competes with P1 roadmap features

**Recommendation**: Defer to v1.2+ backlog, or do minimal cleanup only (remove dead files)

---

## Phase 2: Consolidated Findings

### Consensus Issues (All 6 Agree)

| Issue | Priority | Required Action |
|-------|----------|-----------------|
| Translation layer atomicity | P0 | Define file locking or transactional approach |
| Path traversal validation | P0 | Add explicit validation requirements |
| File permissions | P0 | Specify 0600/0700 permissions |
| Error handling matrix | P0 | Document all failure modes |
| Test strategy | P1 | Add coverage requirements |

### Major Conflict

**Priority Disagreement**:
- **high-level-advisor + independent-thinker**: This is P2 work (developer housekeeping, not user value)
- **architect + critic + security + analyst**: This is necessary architectural improvement

**User Resolution**: Confirmed this IS P0 work. User wants to migrate ALL .agents/ content to Brain memory and enforce conventions. Strategic concern overruled by user decision.

### User Clarifications (Critical)

**Received during Phase 2**:
1. **No backward compatibility** - Just migrate, don't support old locations
2. **Deprecate .agents/ entirely** - Move everything to Brain memory
3. **Ensure basic-memory indexing** - All memories must be semantically searchable
4. **Migrate existing .agents/** - Move to correct locations with proper conventions
5. **Update all agents/skills** - Use memory system properly

---

## Phase 3: Resolution

**Architect Updated ADR-020** to address all P0/P1 issues:

### P0 Resolutions

| Issue | Resolution | Location |
|-------|------------|----------|
| Atomicity | Temp file + atomic rename pattern with file locking | Lines 388-403 |
| Path validation | Security requirements with traversal rejection, TypeScript implementation | Lines 433-477 |
| File permissions | Permission matrix (0600 files, 0700 dirs) | Lines 367-378 |
| Error handling | Complete matrix with 10 scenarios | Lines 419-429 |

### P1 Resolutions

| Issue | Resolution | Location |
|-------|------------|----------|
| Test strategy | Coverage requirements 80-95%, test categories, fixtures | Lines 757-806 |
| TUI/MCP coordination | Explicit delegation model (TUI → MCP for all config) | Lines 579-587 |
| Schema validation | Ajv library specified for TypeScript | Lines 269-277 |
| Sync direction | One-way clarified (Brain → basic-memory) | Added to architecture |

### User Requirement Additions

| Requirement | Implementation | Location |
|-------------|----------------|----------|
| .agents/ deprecation | Migration plan with category mapping | Lines 543-577 |
| Indexing verification | Verification protocol and command | Lines 615-646 |
| Agent updates | Explicit agent file update requirements | Lines 673-682 |
| Memory skill alignment | MCP tool verification | Lines 666-672 |

### Removed

- Backward compatibility timeline (30/60/90 days)
- Old location support
- Dual config reading

---

## Phase 4: Convergence Check

All agents reviewed the UPDATED ADR-020:

**Final Verdicts**:
- **architect**: ACCEPT (all concerns addressed)
- **critic**: ACCEPT (critical issues resolved)
- **independent-thinker**: DISAGREE-AND-COMMIT (reversibility concern documented, commits to execution)
- **security**: APPROVED (security controls adequate)
- **analyst**: ACCEPT (feasibility confirmed)
- **high-level-advisor**: ACCEPT (user confirmed priority)

**Consensus Achieved**: 6/6 agents (5 ACCEPT + 1 D&C)

---

## Dissenting Opinions (Disagree-and-Commit)

### Independent-Thinker's Documented Concerns

For retrospective evaluation:

1. **Reversibility claim inaccurate**: ADR states "no data migration" but Phase 3 explicitly deletes `.agents/` source files after migration. This IS data migration.

2. **SESSION-PROTOCOL circular dependency**: SESSION-PROTOCOL.md lives in `.agents/` and requires session logs in `.agents/sessions/`. After migration, both move to Brain memory. If Brain MCP is unavailable at session start (a MUST requirement), how do agents create session logs?

3. **Backup recommendation**: Keep `.agents/` in git for 30 days post-migration as recovery option before deletion.

**Commitment**: Despite these concerns, I commit to full execution of ADR-020 as approved. My objections are documented for retrospective analysis only.

---

## Final Decision

**Status**: ACCEPTED
**Date**: 2026-01-31
**Consensus**: 5 ACCEPT + 1 DISAGREE-AND-COMMIT (6/6 participation)

### Confirmation Criteria

Before marking implementation complete:

- [ ] All memories migrated from .agents/ to Brain memory appear in search results
- [ ] `brain search` query on migrated content returns expected results
- [ ] All agents updated to use memory skill/agent for write operations
- [ ] Memory agent has all required MCP tools listed
- [ ] No references to .agents/ paths in agent instructions (except historical context)
- [ ] Test coverage ≥80% for config module, ≥90% for translation layer
- [ ] Security tests pass (path validation, permissions, null bytes)
- [ ] Migration dry-run completes successfully on test project
- [ ] Post-migration verification finds all expected memories

### Implementation Handoff

**Next Steps**:
1. Orchestrator routes to planner to create implementation tasks
2. Planner breaks down ADR-020 into atomic work items
3. Implementer executes per approved plan
4. QA validates per confirmation criteria

**Critical Path**:
1. Translation layer implementation (P0)
2. .agents/ content migration (P0)
3. Agent/skill updates for memory system usage (P0)
4. CLI config commands (P1)

---

## Appendix: Issue Tally by Agent

| Agent | P0 Issues | P1 Issues | P2 Issues | Total |
|-------|-----------|-----------|-----------|-------|
| Architect | 2 | 3 | 0 | 5 |
| Critic | 6 | 4 | 4 | 14 |
| Independent-Thinker | 0 | 1 | 4 | 5 |
| Security | 4 | 2 | 5 | 11 |
| Analyst | 0 | 2 | 1 | 3 |
| High-Level-Advisor | 0 | 0 | 1 | 1 |

**Total**: P0: 12, P1: 12, P2: 15, Grand Total: 39 issues identified

**Resolution**: All P0 and P1 issues addressed in updated ADR. P2 issues documented for consideration during implementation.

---

## Related Documents

- ADR-020: `/Users/peter.kloss/Dev/brain/.agents/architecture/decision/ADR-020-configuration-architecture-refactoring.md`
- Supporting Analysis: `/Users/peter.kloss/Dev/brain/.agents/analysis/001-configuration-architecture-analysis.md`
- Session Log: Brain memory `sessions/session-2026-01-21-07-memory-skill-migration`
