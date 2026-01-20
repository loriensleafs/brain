# Strategic Verdict: Embedding Catch-Up Trigger

**Date**: 2026-01-19
**Agent**: high-level-advisor
**Session**: 17

---

## Decision

**PROJECT ACTIVATION** (with simplification)

---

## Priority

**P0** for initial implementation, demote to P2 the scheduled reconciliation.

---

## Reasoning

1. **Your backlog is one-time, not ongoing.** After project activation catches up the "TON of notes," write_note and edit_note keep you synced. Filesystem edits become the rare exception, not the rule.

2. **Project activation runs on every `bootstrap_context` call.** You call this every session start. Single-project users still get catch-up every time they start working. The architect's concern about "never switching projects" is moot.

3. **"Almost instant when synced" kills the complexity argument.** Run the check on every bootstrap_context. Cost: ~50ms to query missing embeddings. If zero, done. If non-zero, fire-and-forget background batch.

---

## Action Items

1. **Add catch-up trigger to bootstrap_context** (4 hours)
   - Query `SELECT permalink FROM notes WHERE NOT EXISTS embedding`
   - If count > 0, call `triggerEmbedding({ project, limit: 0 })` fire-and-forget
   - Log count for observability

2. **Kill the 6-hour cron complexity** (0 hours saved)
   - Do not build scheduled reconciliation
   - User's behavior pattern (session start = catch-up) eliminates the need

---

## Rejected Approach

**Scheduled Reconciliation (Architect's recommendation)**

Why rejected:

- Over-engineered for a one-time backlog problem
- 6-hour staleness window degrades active-session UX
- Adds Inngest dependency for something that runs naturally on session start
- SRP argument is academically correct but user-hostile

The architect is correct that content tools shouldn't handle global reconciliation. But `bootstrap_context` isn't a content tool. It's a session initialization tool. Catch-up during session initialization is the right boundary.

---

## User Impact

**Your "TON of notes" problem**: Solved on next session start. Zero manual intervention.

**Ongoing sync**:

- MCP edits: Already covered by write_note/edit_note triggers
- Filesystem edits: Caught on next session start (typically within hours)

**Worst case**: You edit 100 notes in Obsidian at 2pm, start MCP session at 3pm, catch-up runs in background (1.4s), search works correctly by 3:01pm.

---

## Warning

If you find yourself editing hundreds of notes daily outside MCP and needing sub-hour embedding freshness, revisit scheduled reconciliation. But that's a usage pattern change, not today's problem. Ship the simple solution. Add complexity when you have evidence it's needed.

---

## TL;DR

The analyst is right. Project activation (via bootstrap_context) handles your actual problem. The architect is solving a theoretical problem that doesn't exist in your usage pattern. Ship the simpler solution.
