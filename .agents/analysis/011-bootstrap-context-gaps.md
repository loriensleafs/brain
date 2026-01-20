# Analysis: Bootstrap Context Session State Integration Gaps

## 1. Objective and Scope

**Objective**: Identify gaps between current bootstrap_context implementation and session state integration requirements.

**Scope**: Analysis of bootstrap_context tool implementation to determine what enhancements are needed for session-aware context retrieval.

## 2. Context

The user requires bootstrap_context to:

- Get session state automatically
- Search based on session state (active task, active feature, etc.)
- Include session-related context in output

Session state already exists in the system with:

- `activeFeature` field (feature slug/path)
- `activeTask` field (task identifier)
- Session management via `services/session/index.ts`

## 3. Approach

**Methodology**: Code analysis of bootstrap_context implementation

**Tools Used**: Read, Grep, directory traversal

**Limitations**: No access to external documentation beyond code comments

## 4. Data and Analysis

### Current Implementation Structure

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Main handler | `tools/bootstrap-context/index.ts` | Entry point, orchestration |
| Schema | `tools/bootstrap-context/schema.ts` | Tool definition, arguments |
| Section queries | `tools/bootstrap-context/sectionQueries.ts` | Query logic for each context section |
| Structured output | `tools/bootstrap-context/structuredOutput.ts` | JSON response structure |
| Formatted output | `tools/bootstrap-context/formattedOutput.ts` | Markdown text rendering |
| Templates | `tools/bootstrap-context/templates/context.ts` | Output formatting templates |
| Caching | `tools/bootstrap-context/sessionCache.ts` | 45-second TTL cache |

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| No session state retrieval | `index.ts` lines 28-150 | High |
| No session-based queries | `sectionQueries.ts` lines 1-300 | High |
| Session state service exists | `services/session/index.ts` | High |
| Session state includes activeFeature and activeTask | `services/session/types.ts` lines 595-598 | High |
| Output template is hardcoded | `templates/context.ts` lines 22-124 | High |

### Facts (Verified)

#### Current Capabilities

1. **Project resolution**: Auto-resolves project from CWD or accepts project parameter
2. **Timeframe filtering**: Supports "5d", "7d", "today" timeframes for queries
3. **Section queries**: Four parallel queries executed:
   - Recent activity (updated within timeframe)
   - Active features (status=not_started/in_progress/active, in features/ folder)
   - Recent decisions (3-day timeframe, in decisions/ folder)
   - Open bugs (status != closed, in bugs/ folder)
4. **Relation following**: Optional first-level referenced notes
5. **Caching**: 45-second TTL cache to avoid repeated queries
6. **Dual output**: Structured JSON (cached) and formatted markdown (displayed)

#### Current Query Logic

**Active Features Query** (`sectionQueries.ts` lines 90-130):

- Searches for notes with types: "feature", "phase", "task"
- Filters by status: "not_started", "in_progress", "active"
- Filters by location: `features/` folder
- Timeframe: 30 days by default

**No session-aware filtering observed**

#### Output Structure

**Formatted Output** (`templates/context.ts`):

```markdown
## Memory Context [v6]

**Project:** {project}
**Retrieved:** {timestamp}

### Active Features
- {status} [[{title}]]
...

### Recent Decisions
...

### Open Bugs
...

### Recent Activity
...

### Referenced Notes
...
```

**No session state section**

### Hypotheses (Unverified)

1. Session state retrieval would require calling `getSession()` from `services/session/index.ts`
2. Session-based queries would need to filter by `activeFeature` and `activeTask` fields
3. Output template would need a "Session Context" section showing mode, active task, active feature

## 5. Results

### Missing Components

Bootstrap_context lacks three critical session state integrations:

#### 1. Session State Retrieval

**Current**: No session state fetched
**Required**: Call `getSession()` to retrieve current session state

**Location**: `tools/bootstrap-context/index.ts` line 73 (before parallel queries)

**Code needed**:

```typescript
import { getSession } from "../../services/session";

const sessionState = await getSession();
```

#### 2. Session-Based Query Filtering

**Current**: Active features query returns all active features in project
**Required**: Prioritize or filter by `activeFeature` from session state

**Options**:

- **Option A**: Filter results to only show notes related to activeFeature
- **Option B**: Reorder results to prioritize activeFeature (show first)
- **Option C**: Add separate "Active Work" section for session-related notes

**Impact**:

- Option A: May hide relevant context if activeFeature is wrong
- Option B: Preserves full context, improves UX
- Option C: Best of both worlds but increases output size

#### 3. Session Context Output Section

**Current**: No session information in output
**Required**: Display session state in formatted output

**Location**: `tools/bootstrap-context/templates/context.ts` line 26 (after header)

**Content needed**:

```markdown
### Session Context

**Mode:** {currentMode}
**Active Feature:** {activeFeature}
**Active Task:** {activeTask}
```

### Query Enhancement Details

**Active Features Query Enhancement**:

Current query returns all active features. Enhancement should:

1. Query all active features (unchanged)
2. After results returned, check if `sessionState.activeFeature` exists
3. If exists, find matching feature in results
4. Reorder results to place matching feature first
5. Optionally mark with indicator (e.g., "★ [[Feature-X]]")

**Pseudo-code**:

```typescript
let activeFeatures = await queryActiveFeatures({ project, timeframe });

if (sessionState?.activeFeature) {
  // Find index of active feature
  const activeIndex = activeFeatures.findIndex(
    f => f.permalink.includes(sessionState.activeFeature)
  );
  
  if (activeIndex > 0) {
    // Move to front
    const active = activeFeatures.splice(activeIndex, 1)[0];
    activeFeatures.unshift(active);
  }
}
```

**Active Tasks Enhancement**:

If `sessionState.activeTask` exists, add separate search for task notes matching the task identifier.

### Structured Output Enhancement

Current structured output (`structuredOutput.ts` lines 64-71):

```typescript
export interface StructuredContent {
  metadata: ContextMetadata;
  active_features: StructuredFeature[];
  recent_decisions: StructuredDecision[];
  open_bugs: StructuredBug[];
  recent_activity: StructuredActivity[];
  referenced_notes: StructuredNote[];
}
```

**Enhancement needed**: Add session state field

```typescript
export interface StructuredContent {
  metadata: ContextMetadata;
  session?: SessionState;  // NEW
  active_features: StructuredFeature[];
  // ... rest unchanged
}
```

## 6. Discussion

### Design Decisions Required

#### Should Session State Be Mandatory?

**Question**: Should bootstrap_context fail if session state unavailable?

**Recommendation**: No. Make it optional enhancement.

- If session exists: Include and use for filtering
- If session missing: Continue without session context

**Rationale**: bootstrap_context used at session start (before session created) and during session. Should work in both cases.

#### How to Handle activeFeature Mismatch?

**Scenario**: Session state has `activeFeature="Feature-X"` but Feature-X not in active features (wrong folder, completed, etc.)

**Options**:

1. Ignore mismatch, proceed without filtering
2. Search explicitly for Feature-X and add to results
3. Log warning for user awareness

**Recommendation**: Option 2 (search explicitly)

- Ensures activeFeature always shown if it exists
- Signals to user when feature state inconsistent
- Minimal performance cost (one additional search)

#### Cache Invalidation on Session Change?

**Question**: Should session state changes invalidate bootstrap_context cache?

**Current**: Cache invalidates on write_note/edit_note
**Issue**: Session changes don't trigger cache invalidation

**Recommendation**: Add session change hook to invalidate cache

- When `setSession()` called, invalidate project cache
- Ensures fresh context after session state changes

**Implementation**:

```typescript
// In services/session/index.ts
import { invalidateCache } from "../tools/bootstrap-context/sessionCache";

export async function setSession(updates: SessionUpdates): Promise<SessionState | null> {
  // ... existing logic ...
  
  // Invalidate bootstrap context cache
  const project = resolveProject();
  if (project) {
    invalidateCache(project);
  }
  
  return state;
}
```

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Add session state retrieval to bootstrap_context handler | Foundational requirement for all other enhancements | 30 minutes |
| P0 | Add session context section to formatted output template | User needs to see current session state | 15 minutes |
| P1 | Add session state to structured output | Programmatic access to session context | 15 minutes |
| P1 | Prioritize activeFeature in active features list | Improves UX by showing relevant work first | 30 minutes |
| P2 | Search explicitly for activeFeature if not in results | Ensures consistency, handles edge cases | 45 minutes |
| P2 | Invalidate cache on session state changes | Prevents stale context after mode/task changes | 30 minutes |
| P3 | Add activeTask filtering/highlighting | Nice to have, task-level granularity | 1 hour |

**Total estimated effort**: 3-4 hours

## 8. Conclusion

**Verdict**: Proceed with enhancements

**Confidence**: High

**Rationale**: Current implementation lacks session state awareness. Enhancements are well-scoped, low-risk, and provide significant value for session-aware workflows.

### User Impact

**What changes for you**: bootstrap_context will show your current session state (mode, active feature, active task) and prioritize relevant context based on what you're working on.

**Effort required**: No user action required after implementation.

**Risk if ignored**: Context becomes generic instead of personalized. Users must manually filter irrelevant notes from bootstrap output.

## 9. Appendices

### Sources Consulted

**Implementation files**:

- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/index.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/schema.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/sectionQueries.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/structuredOutput.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/formattedOutput.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/templates/context.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/sessionCache.ts`

**Session state system**:

- `/Users/peter.kloss/Dev/brain/apps/mcp/src/services/session/types.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/services/session/index.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/session/schema.ts`

### Data Transparency

**Found**:

- Complete bootstrap_context implementation
- Session state service with activeFeature and activeTask fields
- Clear extension points for enhancement

**Not Found**:

- Any existing session state integration
- User requirements documentation for session-aware queries
- Performance benchmarks for session state retrieval
