/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file was automatically generated from JSON Schema files.
 * Any manual changes will be overwritten on the next generation.
 *
 * To regenerate: bun run generate:types
 * Source schemas: packages/validation/schemas/*.schema.json
 *
 * Generated: 2026-02-01T13:52:22.998Z
 */

// Source: schemas/config/brain-config.schema.json
/**
 * Brain configuration schema for ~/.config/brain/config.json. Provides user-facing configuration that gets translated to basic-memory's internal config.
 */
export interface BrainConfig {
  /**
   * JSON Schema URL for editor validation support.
   */
  $schema?: string;
  /**
   * Configuration version. Must be "2.0.0" for this schema.
   */
  version: "2.0.0";
  defaults: DefaultsConfig;
  /**
   * Project-specific configurations keyed by project name.
   */
  projects: {
    [k: string]: ProjectConfig | undefined;
  };
  sync: SyncConfig;
  logging: LoggingConfig;
  watcher: WatcherConfig;
}
/**
 * Global default settings for new projects.
 */
export interface DefaultsConfig {
  /**
   * Base path for DEFAULT mode memories (e.g., ~/memories).
   */
  memories_location: string;
  /**
   * Default memories mode for new projects.
   */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
}
/**
 * Project-specific configuration.
 */
export interface ProjectConfig {
  /**
   * Absolute path to project source code.
   */
  code_path: string;
  /**
   * Computed or explicit path to project memories. Optional if using DEFAULT or CODE mode.
   */
  memories_path?: string;
  /**
   * How to resolve the memories path. Defaults to global memories_mode if not set.
   */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
}
/**
 * File synchronization settings.
 */
export interface SyncConfig {
  /**
   * Enable file sync between code and memories.
   */
  enabled?: boolean;
  /**
   * Sync delay in milliseconds.
   */
  delay_ms?: number;
}
/**
 * Logging configuration.
 */
export interface LoggingConfig {
  /**
   * Log verbosity level.
   */
  level?: "trace" | "debug" | "info" | "warn" | "error";
}
/**
 * File watcher configuration for detecting manual config edits.
 */
export interface WatcherConfig {
  /**
   * Enable config file watching.
   */
  enabled?: boolean;
  /**
   * Debounce delay in milliseconds to handle editor chunked writes.
   */
  debounce_ms?: number;
}

// Source: schemas/config/inngest.schema.json
/**
 * Inngest configuration - LOCAL ONLY. Inngest runs in local dev mode exclusively with no cloud connections.
 */
export interface InngestConfig {
  /**
   * Always true - local dev mode only
   */
  dev: true;
}

// Source: schemas/domain/workflow.schema.json
/**
 * Schema for workflow state validation. Validates mode values and conditional task requirements.
 */
export type WorkflowState = {
  [k: string]: unknown | undefined;
} & {
  /**
   * Current workflow mode. Empty string indicates no active workflow.
   */
  mode?: "" | "analysis" | "planning" | "coding";
  /**
   * Current task description. Required when mode is 'coding'.
   */
  task?: string;
  /**
   * Optional session identifier.
   */
  sessionId?: string;
  /**
   * ISO timestamp of last update.
   */
  updatedAt?: string;
};

// Source: schemas/session/session-state.schema.json
/**
 * Available workflow modes controlling tool access
 */
export type WorkflowMode = "analysis" | "planning" | "coding" | "disabled";
/**
 * All agent types in the multi-agent system
 */
export type AgentType =
  | "orchestrator"
  | "analyst"
  | "architect"
  | "planner"
  | "implementer"
  | "critic"
  | "qa"
  | "security"
  | "devops"
  | "retrospective"
  | "memory"
  | "skillbook"
  | "independent-thinker"
  | "high-level-advisor"
  | "explainer"
  | "task-generator"
  | "pr-comment-responder";
/**
 * Orchestrator workflow phases
 */
export type WorkflowPhase = "planning" | "implementation" | "validation" | "complete";
/**
 * Status of an agent invocation
 */
export type InvocationStatus = "in_progress" | "completed" | "failed" | "blocked";
/**
 * Types of decisions recorded in workflow
 */
export type DecisionType = "architectural" | "technical" | "process" | "scope";
/**
 * Verdict outcomes from agent validation
 */
export type VerdictDecision = "approve" | "reject" | "conditional" | "needs_revision";

/**
 * Session state structure for persistent context. Contains critical information that must survive context compaction: workflow mode, mode history, protocol status, orchestrator workflow, active feature/task, and version for optimistic locking.
 */
export interface SessionState {
  currentMode: WorkflowMode;
  modeHistory: ModeHistoryEntry[];
  protocolStartComplete: boolean;
  protocolEndComplete: boolean;
  protocolStartEvidence: {
    [k: string]: string | undefined;
  };
  protocolEndEvidence: {
    [k: string]: string | undefined;
  };
  orchestratorWorkflow: OrchestratorWorkflow | null;
  activeFeature?: string;
  activeTask?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface ModeHistoryEntry {
  mode: WorkflowMode;
  timestamp: string;
}
export interface OrchestratorWorkflow {
  activeAgent: AgentType | null;
  workflowPhase: WorkflowPhase;
  agentHistory: AgentInvocation[];
  decisions: Decision[];
  verdicts: Verdict[];
  pendingHandoffs: Handoff[];
  compactionHistory: CompactionEntry[];
  startedAt: string;
  lastAgentChange: string;
}
export interface AgentInvocation {
  agent: AgentType;
  startedAt: string;
  completedAt: string | null;
  status: InvocationStatus;
  input: AgentInvocationInput;
  output: AgentInvocationOutput | null;
  handoffFrom: AgentType | null;
  handoffTo: AgentType | null;
  handoffReason: string;
}
export interface AgentInvocationInput {
  prompt: string;
  context: {
    [k: string]: unknown | undefined;
  };
  artifacts: string[];
}
export interface AgentInvocationOutput {
  artifacts: string[];
  summary: string;
  recommendations: string[];
  blockers: string[];
}
export interface Decision {
  id: string;
  type: DecisionType;
  description: string;
  rationale: string;
  decidedBy: AgentType;
  approvedBy: AgentType[];
  rejectedBy: AgentType[];
  timestamp: string;
}
export interface Verdict {
  agent: AgentType;
  decision: VerdictDecision;
  confidence: number;
  reasoning: string;
  conditions?: string[];
  blockers?: string[];
  timestamp: string;
}
export interface Handoff {
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  context: string;
  artifacts: string[];
  preservedContext?: {
    [k: string]: unknown | undefined;
  };
  createdAt: string;
}
export interface CompactionEntry {
  notePath: string;
  compactedAt: string;
  count: number;
}

// Source: schemas/tools/bootstrap-context.schema.json
/**
 * Schema for bootstrap_context tool arguments. Provides semantic context for conversation initialization by querying active features, recent decisions, open bugs, and related notes.
 */
export interface BootstrapContextArgs {
  /**
   * Project to bootstrap context for. Auto-resolved from CWD if not specified.
   */
  project?: string;
  /**
   * Timeframe for recent activity (e.g., '5d', '7d', 'today')
   */
  timeframe?: string;
  /**
   * Whether to include first-level referenced notes
   */
  include_referenced?: boolean;
}

// Source: schemas/tools/config/get.schema.json
/**
 * Schema for config_get tool arguments. Retrieves Brain configuration values - either the entire config or a specific field using dot notation.
 */
export interface ConfigGetArgs {
  /**
   * Specific config key to retrieve (e.g., 'logging.level', 'defaults.memories_location'). If not provided, returns entire config.
   */
  key?: string;
}

// Source: schemas/tools/config/reset.schema.json
/**
 * Schema for config_reset tool arguments. Resets Brain configuration to defaults - either a specific field or the entire configuration.
 */
export interface ConfigResetArgs {
  /**
   * Specific config key to reset to default. If not provided with all=true, resets entire config.
   */
  key?: string;
  /**
   * Reset entire configuration to defaults. Requires explicit confirmation.
   */
  all?: boolean;
}

// Source: schemas/tools/config/rollback.schema.json
/**
 * Schema for config_rollback tool arguments. Restores configuration from snapshots created before risky operations.
 */
export interface ConfigRollbackArgs {
  /**
   * Rollback target: 'lastKnownGood' (baseline from startup) or 'previous' (most recent snapshot).
   */
  target: "lastKnownGood" | "previous";
}

// Source: schemas/tools/config/set.schema.json
/**
 * Schema for config_set tool arguments. Sets a Brain configuration value and triggers reconfiguration if the change affects projects.
 */
export interface ConfigSetArgs {
  /**
   * Config key to set (e.g., 'logging.level', 'sync.delay_ms'). Use dot notation for nested keys.
   */
  key: string;
  /**
   * Value to set. Type must match the expected type for the key.
   */
  value: string | number | boolean;
}

// Source: schemas/tools/config/update-global.schema.json
/**
 * Schema for config_update_global tool arguments. Updates default settings that affect new projects and optionally migrates existing projects using DEFAULT mode.
 */
export interface ConfigUpdateGlobalArgs {
  /**
   * New default memories location. Use ~ for home directory.
   */
  memories_location?: string;
  /**
   * New default memories mode for new projects.
   */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
  /**
   * Whether to migrate memories for all affected projects when default location changes. Default: true.
   */
  migrate_affected?: boolean;
}

// Source: schemas/tools/config/update-project.schema.json
/**
 * Schema for config_update_project tool arguments. Updates a project's configuration with optional migration of memories to a new location.
 */
export interface ConfigUpdateProjectArgs {
  /**
   * Project name to update.
   */
  project: string;
  /**
   * New code path for the project. Use ~ for home directory.
   */
  code_path?: string;
  /**
   * New memories path. Use 'DEFAULT', 'CODE', or an absolute path.
   */
  memories_path?: string;
  /**
   * Memories mode for the project.
   */
  memories_mode?: "DEFAULT" | "CODE" | "CUSTOM";
  /**
   * Whether to migrate memories to new location if path changes. Default: true.
   */
  migrate?: boolean;
}

// Source: schemas/tools/get-workflow.schema.json
/**
 * Schema for get_workflow tool arguments. Gets full workflow run details including status, timing, steps, and output.
 */
export interface GetWorkflowArgs {
  /**
   * The workflow run ID to get details for
   */
  run_id: string;
}

// Source: schemas/tools/list-features-by-priority.schema.json
/**
 * Schema for list_features_by_priority tool arguments. Lists features ordered by dependency (topological sort) and priority tie-breaking. Returns features sorted by: 1. Dependency order (dependencies first), 2. Priority (lower number = higher priority).
 */
export interface ListFeaturesByPriorityArgs {
  /**
   * Project to list features for. Auto-resolved from CWD if not specified.
   */
  project?: string;
  /**
   * Type of entity to list. Default: feature
   */
  entity_type?: "feature" | "task" | "phase";
  /**
   * Include completed items. Default: false
   */
  include_completed?: boolean;
  /**
   * Output format. Default: list
   */
  format?: "list" | "tree";
}

// Source: schemas/tools/list-workflows.schema.json
/**
 * Schema for list_workflows tool arguments. Lists all available workflow functions and their event triggers.
 */
export interface ListWorkflowsArgs {}

// Source: schemas/tools/projects/active-project.schema.json
/**
 * Schema for active_project tool arguments. Unified tool for getting, setting, and clearing the active project. Operations: get (returns current), set (requires project param), clear (resets selection).
 */
export interface ActiveProjectArgs {
  /**
   * Operation to perform: get (default), set, or clear
   */
  operation?: "get" | "set" | "clear";
  /**
   * Project name (required for set operation)
   */
  project?: string;
}

// Source: schemas/tools/projects/create-project.schema.json
/**
 * Schema for create_project tool arguments. Creates a new Brain memory project with required code_path and optional memories_path.
 */
export interface CreateProjectArgs {
  /**
   * Project name to create
   */
  name: string;
  /**
   * Code directory path (use ~ for home). Required.
   */
  code_path: string;
  /**
   * Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT'.
   */
  memories_path?: string;
}

// Source: schemas/tools/projects/delete-project.schema.json
/**
 * Schema for delete_project tool arguments. Two-stage deletion with safety controls: Stage 1 removes config entries (reversible), Stage 2 deletes notes directory (irreversible, only if delete_notes=true).
 */
export interface DeleteProjectArgs {
  /**
   * Project name to delete
   */
  project: string;
  /**
   * If true, also delete the notes directory. DESTRUCTIVE - defaults to false for safety.
   */
  delete_notes?: boolean;
}

// Source: schemas/tools/projects/edit-project.schema.json
/**
 * Schema for edit_project tool arguments. Edits project metadata and configuration including code path and memories path.
 */
export interface EditProjectArgs {
  /**
   * Project name to edit
   */
  name: string;
  /**
   * Code directory path (use ~ for home). Required for editing.
   */
  code_path: string;
  /**
   * Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs.
   */
  memories_path?: string;
}

// Source: schemas/tools/projects/get-project-details.schema.json
/**
 * Schema for get_project_details tool arguments. Gets detailed information about a specific Brain memory project.
 */
export interface GetProjectDetailsArgs {
  /**
   * Project name to get details for
   */
  project: string;
}

// Source: schemas/tools/projects/list-projects.schema.json
/**
 * Schema for list_projects tool arguments. Lists all available Brain memory projects. Returns a simple array of project names. Use get_project_details for detailed information about a specific project.
 */
export interface ListProjectsArgs {}

// Source: schemas/tools/search.schema.json
/**
 * Schema for unified search tool arguments. Defines input validation for semantic/keyword search with automatic fallback behavior.
 */
export interface SearchArgs {
  /**
   * Search query text
   */
  query: string;
  /**
   * Maximum number of results to return
   */
  limit?: number;
  /**
   * Similarity threshold for semantic search (0-1)
   */
  threshold?: number;
  /**
   * Search mode: auto, semantic, keyword, or hybrid
   */
  mode?: "auto" | "semantic" | "keyword" | "hybrid";
  /**
   * Relation depth: follow wikilinks N levels from results (0-3)
   */
  depth?: number;
  /**
   * Project name to search in
   */
  project?: string;
  /**
   * When true, include full note content instead of snippets (limited to 5000 chars per note)
   */
  full_context?: boolean;
}

// Source: schemas/tools/send-workflow-event.schema.json
/**
 * Schema for send_workflow_event tool arguments. Triggers a workflow by sending an event.
 */
export interface SendWorkflowEventArgs {
  /**
   * The event name to trigger (e.g., 'feature/completion.requested')
   */
  event_name: string;
  /**
   * The payload required by the workflow
   */
  data?: {
    [k: string]: unknown | undefined;
  };
}

// Source: schemas/tools/session.schema.json
/**
 * Schema for session tool arguments. Unified session management with get/set operations for workflow mode, active task, and feature.
 */
export interface SessionArgs {
  /**
   * Operation: 'get' retrieves session state, 'set' updates it
   */
  operation: "get" | "set";
  /**
   * Workflow mode (for set operation): analysis (read-only), planning (design), coding (full access), disabled (no restrictions)
   */
  mode?: "analysis" | "planning" | "coding" | "disabled";
  /**
   * Description of current task (for set operation)
   */
  task?: string;
  /**
   * Active feature slug/path (for set operation)
   */
  feature?: string;
}
