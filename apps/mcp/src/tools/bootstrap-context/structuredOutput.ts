/**
 * Structured output builder for bootstrap_context tool
 *
 * Builds the structuredContent response per MCP specification.
 * Returns JSON-serializable data for programmatic consumption.
 */

import type { WorkflowMode } from "../../services/session/types";
import type { NoteType } from "./noteType";
import type { ContextNote } from "./sectionQueries";
import type {
  AgentHistorySummary,
  SessionEnrichment,
} from "./sessionEnrichment";
import type { NoteStatus } from "./statusParser";

/**
 * Structured note for output
 */
export interface StructuredNote {
  title: string;
  permalink: string;
  type: NoteType;
  status: NoteStatus;
}

/**
 * Structured feature with hierarchy
 */
export interface StructuredFeature extends StructuredNote {
  phases?: StructuredNote[];
  tasks?: StructuredNote[];
}

/**
 * Structured decision
 */
export interface StructuredDecision extends StructuredNote {
  updated_at?: string;
}

/**
 * Structured bug
 */
export interface StructuredBug extends StructuredNote {
  updated_at?: string;
}

/**
 * Structured activity item
 */
export interface StructuredActivity extends StructuredNote {
  updated_at?: string;
}

/**
 * Metadata for the context response
 */
export interface ContextMetadata {
  project: string;
  generated_at: string;
  note_count: number;
  timeframe: string;
}

/**
 * Structured session state for output
 */
export interface StructuredSessionState {
  currentMode: WorkflowMode;
  activeTask?: string;
  activeFeature?: string;
  hasOrchestratorWorkflow: boolean;
  workflowPhase?: string;
  activeAgent?: string;
}

/**
 * Structured session context for output
 */
export interface StructuredSessionContext {
  state: StructuredSessionState;
  taskNotes: StructuredNote[];
  featureNotes: StructuredNote[];
  recentAgentHistory: AgentHistorySummary[];
}

/**
 * Complete structured content output
 */
export interface StructuredContent {
  metadata: ContextMetadata;
  session_context?: StructuredSessionContext;
  active_features: StructuredFeature[];
  recent_decisions: StructuredDecision[];
  open_bugs: StructuredBug[];
  recent_activity: StructuredActivity[];
  referenced_notes: StructuredNote[];
}

/**
 * Input data for building structured output
 */
export interface StructuredOutputInput {
  project: string;
  timeframe: string;
  activeFeatures: ContextNote[];
  recentDecisions: ContextNote[];
  openBugs: ContextNote[];
  recentActivity: ContextNote[];
  referencedNotes: ContextNote[];
  sessionEnrichment?: SessionEnrichment;
}

/**
 * Build structured content output from context data
 */
export function buildStructuredOutput(
  input: StructuredOutputInput,
): StructuredContent {
  const {
    project,
    timeframe,
    activeFeatures,
    recentDecisions,
    openBugs,
    recentActivity,
    referencedNotes,
    sessionEnrichment,
  } = input;

  // Calculate total note count
  const noteCount =
    activeFeatures.length +
    recentDecisions.length +
    openBugs.length +
    recentActivity.length +
    referencedNotes.length;

  // Build session context if enrichment available
  const sessionContext = sessionEnrichment
    ? buildSessionContext(sessionEnrichment)
    : undefined;

  return {
    metadata: {
      project,
      generated_at: new Date().toISOString(),
      note_count: noteCount,
      timeframe,
    },
    session_context: sessionContext,
    active_features: activeFeatures.map(toStructuredFeature),
    recent_decisions: recentDecisions.map(toStructuredDecision),
    open_bugs: openBugs.map(toStructuredBug),
    recent_activity: recentActivity.map(toStructuredActivity),
    referenced_notes: referencedNotes.map(toStructuredNote),
  };
}

/**
 * Build structured session context from enrichment data
 */
function buildSessionContext(
  enrichment: SessionEnrichment,
): StructuredSessionContext {
  const { sessionState, taskNotes, featureNotes, recentAgentHistory } =
    enrichment;
  const workflow = sessionState.orchestratorWorkflow;

  return {
    state: {
      currentMode: sessionState.currentMode,
      activeTask: sessionState.activeTask,
      activeFeature: sessionState.activeFeature,
      hasOrchestratorWorkflow: workflow !== null,
      workflowPhase: workflow?.workflowPhase,
      activeAgent: workflow?.activeAgent ?? undefined,
    },
    taskNotes: taskNotes.map(toStructuredNote),
    featureNotes: featureNotes.map(toStructuredNote),
    recentAgentHistory,
  };
}

/**
 * Convert ContextNote to StructuredNote
 */
function toStructuredNote(note: ContextNote): StructuredNote {
  return {
    title: note.title,
    permalink: note.permalink,
    type: note.type,
    status: note.status,
  };
}

/**
 * Convert ContextNote to StructuredFeature
 */
function toStructuredFeature(note: ContextNote): StructuredFeature {
  return {
    title: note.title,
    permalink: note.permalink,
    type: note.type,
    status: note.status,
    // Phases and tasks would be populated by hierarchical queries
    // For now, flat structure
  };
}

/**
 * Convert ContextNote to StructuredDecision
 */
function toStructuredDecision(note: ContextNote): StructuredDecision {
  return {
    title: note.title,
    permalink: note.permalink,
    type: note.type,
    status: note.status,
    updated_at: note.updatedAt,
  };
}

/**
 * Convert ContextNote to StructuredBug
 */
function toStructuredBug(note: ContextNote): StructuredBug {
  return {
    title: note.title,
    permalink: note.permalink,
    type: note.type,
    status: note.status,
    updated_at: note.updatedAt,
  };
}

/**
 * Convert ContextNote to StructuredActivity
 */
function toStructuredActivity(note: ContextNote): StructuredActivity {
  return {
    title: note.title,
    permalink: note.permalink,
    type: note.type,
    status: note.status,
    updated_at: note.updatedAt,
  };
}

/**
 * Serialize structured content to JSON string
 */
export function serializeStructuredContent(content: StructuredContent): string {
  return JSON.stringify(content, null, 2);
}
