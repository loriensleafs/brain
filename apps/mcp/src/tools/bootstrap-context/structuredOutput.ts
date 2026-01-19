/**
 * Structured output builder for bootstrap_context tool
 *
 * Builds the structuredContent response per MCP specification.
 * Returns JSON-serializable data for programmatic consumption.
 */

import type { ContextNote } from "./sectionQueries";
import type { NoteType } from "./noteType";
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
 * Complete structured content output
 */
export interface StructuredContent {
  metadata: ContextMetadata;
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
}

/**
 * Build structured content output from context data
 */
export function buildStructuredOutput(
  input: StructuredOutputInput
): StructuredContent {
  const {
    project,
    timeframe,
    activeFeatures,
    recentDecisions,
    openBugs,
    recentActivity,
    referencedNotes,
  } = input;

  // Calculate total note count
  const noteCount =
    activeFeatures.length +
    recentDecisions.length +
    openBugs.length +
    recentActivity.length +
    referencedNotes.length;

  return {
    metadata: {
      project,
      generated_at: new Date().toISOString(),
      note_count: noteCount,
      timeframe,
    },
    active_features: activeFeatures.map(toStructuredFeature),
    recent_decisions: recentDecisions.map(toStructuredDecision),
    open_bugs: openBugs.map(toStructuredBug),
    recent_activity: recentActivity.map(toStructuredActivity),
    referenced_notes: referencedNotes.map(toStructuredNote),
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
