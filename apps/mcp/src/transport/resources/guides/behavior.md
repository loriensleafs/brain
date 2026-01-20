---
name: Proactive Memory Behavior Guide
description: "CRITICAL: How agents should use memory proactively. Covers WHEN to write, frequency triggers, search-before-create, and progressive elaboration."
mimeType: text/markdown
priority: 1.0
---

# Proactive Memory Behavior Guide

**CRITICAL: This guide covers WHEN to write, not just how.**

## Core Philosophy

Memory is your ACTIVE WORKSPACE - use it CONSTANTLY.

- Write frequently (every 1-2 minutes during active work)
- Edit existing notes far more than creating new ones
- Search before EVERY write operation
- Build knowledge progressively over time

## WHEN to Write (Frequency Triggers)

**STOP AND WRITE NOW if any of these apply:**

- You've been analyzing/reading code for >1 minute without a memory operation
- User just made a decision or gave feedback
- You discovered an important pattern or insight
- You're planning multi-step work
- You identified a tradeoff or constraint
- Context might reset soon (long conversation)

**At Key Moments:**

- At conversation start: Check memory for prior work on this topic
- Before implementation: Review accumulated analysis and decisions
- During implementation: Record discovered patterns as you code
- After completing analysis: Finalize findings before presenting

**Red Flags (You're NOT using memory enough):**

- You've been working for 2+ minutes without a memory tool call
- You're about to present findings but haven't saved them
- User gave feedback but you didn't record it in memory
- You're thinking "I'll organize this later" (NO - organize NOW!)

## HOW to Write (Search-Before-Create is MANDATORY)

**NEVER call write_note without searching first:**

```python
# ALWAYS do this before creating ANY note:
existing = await search(query="topic name", project="...")

if existing["total"] > 0:
    # UPDATE existing note - this is the 80% case!
    await edit_note(
        identifier=existing["results"][0]["permalink"],
        operation="append",
        content=new_observations,
        project="..."
    )
else:
    # Only create new if truly nothing exists
    await write_note(...)
```

**The ratio should be: 80% edit_note, 20% write_note**

If you find yourself creating many new notes, STOP. You're probably fragmenting the knowledge graph.

## Progressive Knowledge Building Pattern

**Start → Grow → Branch**

1. **Start**: Create main note for topic with initial observations
2. **Grow**: Add observations progressively as you learn (every few minutes)
3. **Branch**: When a section gets too detailed, break it into a linked note

**Example: Research Session**

```
Minute 0:  Create "Research: Topic X" with initial scope
Minute 3:  edit_note → append findings so far
Minute 7:  edit_note → append more findings
Minute 12: Section "API Analysis" is getting long → create separate note
           Update main note with relation: includes [[API Analysis for Topic X]]
Minute 15: edit_note on both notes → continue building
```

**DON'T wait until end to write one huge note:**

- Risk of hitting context window limit
- Lose work if session interrupted
- Harder to build proper graph structure
- Miss opportunities to connect to existing knowledge

## What's Worth Remembering vs. Skip

**SAVE these:**

- User-specific facts, preferences, decisions
- Significant discoveries and insights
- Technical patterns and techniques learned
- Action items and plans
- Anything that connects to existing knowledge

**SKIP these:**

- Generic definitions ("What is X?")
- Common pleasantries or conversational filler
- Statements lacking context or personal relevance
- Trivial exchanges that add no lasting value

**When in doubt: If it would be useful to know in a future session, SAVE IT.**

## Note Quality Checklist

Every note MUST have:

- [ ] Clear, descriptive title
- [ ] 3-5 observations minimum
- [ ] 2-3 relations minimum
- [ ] Proper [category] tags on observations
- [ ] Exact entity titles in [[WikiLinks]]
