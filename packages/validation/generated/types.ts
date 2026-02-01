/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file was automatically generated from JSON Schema files.
 * Any manual changes will be overwritten on the next generation.
 *
 * To regenerate: bun run generate:types
 * Source schemas: packages/validation/schemas/*.schema.json
 *
 * Generated: 2026-02-01T20:33:57.912Z
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

// Source: schemas/domain/memory-index-entry.schema.json
/**
 * Schema for memory index entry validation. Validates entries in domain index files (skills-*-index.md).
 */
export interface MemoryIndexEntry {
  /**
   * Keywords for this entry (space-separated in table, parsed to array)
   *
   * @minItems 1
   */
  keywords: [string, ...string[]];
  /**
   * File name without .md extension
   */
  fileName: string;
  /**
   * Original space-separated keywords string
   */
  rawKeywords?: string;
}

// Source: schemas/domain/naming-pattern.schema.json
/**
 * Schema for artifact naming convention validation. Defines expected patterns for various artifact types.
 */
export interface NamingPatternValidation {
  /**
   * File name to validate
   */
  fileName: string;
  /**
   * Expected pattern type for validation
   */
  patternType?:
    | "decision"
    | "session"
    | "requirement"
    | "design"
    | "task"
    | "analysis"
    | "feature"
    | "epic"
    | "critique"
    | "test-report"
    | "security"
    | "retrospective"
    | "skill";
}

// Source: schemas/domain/scenario-config.schema.json
/**
 * Schema for scenario detection configuration. Validates scenario type configurations used by detect-scenario.
 */
export interface ScenarioConfig {
  /**
   * Keywords that trigger this scenario
   *
   * @minItems 1
   */
  keywords: [string, ...string[]];
  /**
   * Recommended action message
   */
  recommended: string;
  /**
   * Target directory for notes
   */
  directory: string;
  /**
   * Type of note to create
   */
  noteType: string;
}

// Source: schemas/domain/scenario-result.schema.json
/**
 * Schema for scenario detection result. Validates the output of detect-scenario operations.
 */
export interface ScenarioResult {
  /**
   * Whether a scenario was detected
   */
  detected: boolean;
  /**
   * The detected scenario type
   */
  scenario?: "BUG" | "FEATURE" | "SPEC" | "ANALYSIS" | "RESEARCH" | "DECISION" | "TESTING" | "";
  /**
   * Keywords that matched
   */
  keywords?: string[];
  /**
   * Recommended action
   */
  recommended?: string;
  /**
   * Target directory
   */
  directory?: string;
  /**
   * Note type to create
   */
  noteType?: string;
}

// Source: schemas/domain/skill-frontmatter.schema.json
/**
 * Schema for skill file frontmatter validation. Validates the YAML frontmatter in .md skill files.
 */
export interface SkillFrontmatter {
  /**
   * Skill name: lowercase letters, numbers, and hyphens, 1-64 characters
   */
  name: string;
  /**
   * Skill description, max 1024 characters
   */
  description: string;
  [k: string]: unknown | undefined;
}

// Source: schemas/domain/skill-violation.schema.json
/**
 * Schema for skill violation detection result. Validates the output of detect-skill-violation operations.
 */
export interface SkillViolationResult {
  /**
   * Whether validation passed (violations are warnings, not failures)
   */
  valid: boolean;
  /**
   * Individual check results
   */
  checks?: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  /**
   * Overall result message
   */
  message?: string;
  /**
   * Remediation guidance
   */
  remediation?: string;
  /**
   * Path to skills directory
   */
  skillsDir?: string;
  /**
   * Number of files checked
   */
  filesChecked: number;
  /**
   * List of detected violations
   */
  violations?: SkillViolation[];
  /**
   * Missing skill capabilities detected
   */
  capabilityGaps?: string[];
}
export interface SkillViolation {
  /**
   * File path where violation was detected
   */
  file: string;
  /**
   * Line number of violation
   */
  line: number;
  /**
   * Regex pattern that matched
   */
  pattern: string;
  /**
   * Extracted gh subcommand
   */
  command?: string;
}

// Source: schemas/domain/slash-command-frontmatter.schema.json
/**
 * Schema for slash command file frontmatter validation. Validates the YAML frontmatter in .md command files.
 */
export interface SlashCommandFrontmatter {
  /**
   * Command description, should start with action verb or 'Use when...'
   */
  description: string;
  /**
   * Hint for expected arguments (e.g., '<file-path>')
   */
  "argument-hint"?: string;
  /**
   * List of allowed tools for bash execution
   */
  "allowed-tools"?: string[];
  [k: string]: unknown | undefined;
}

// Source: schemas/domain/spec-frontmatter.schema.json
/**
 * Schema for specification file YAML frontmatter. Validates REQ, DESIGN, and TASK spec frontmatter.
 */
export type SpecFrontmatter = {
  [k: string]: unknown | undefined;
} & {
  /**
   * Specification type
   */
  type: "requirement" | "design" | "task";
  /**
   * Specification ID (e.g., REQ-001, DESIGN-ABC, TASK-001)
   */
  id: string;
  /**
   * Current status of the specification
   */
  status:
    | "draft"
    | "review"
    | "approved"
    | "pending"
    | "in-progress"
    | "complete"
    | "done"
    | "implemented"
    | "rejected"
    | "deferred";
  /**
   * Related specification IDs for traceability
   */
  related?: string[];
  /**
   * File path (runtime metadata, not from YAML)
   */
  filePath?: string;
  [k: string]: unknown | undefined;
};

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

// Source: schemas/pr/pr-description-config.schema.json
/**
 * Configuration for PR description validation. Defines the PR body text, files in the PR, and patterns for significant files that should be mentioned.
 */
export interface PRDescriptionConfig {
  /**
   * The PR body/description text
   */
  description: string;
  /**
   * List of files changed in the PR
   */
  filesInPR?: string[];
  /**
   * File extensions considered significant for warning when not mentioned
   */
  significantExtensions?: string[];
  /**
   * Path prefixes for files that should be mentioned in PR description
   */
  significantPaths?: string[];
  /**
   * Required sections in PR description (matched as ## or ### headers)
   */
  requiredSections?: string[];
  /**
   * Whether to validate that checklist items are completed
   */
  validateChecklist?: boolean;
}

// Source: schemas/pr/pre-pr-config.schema.json
/**
 * Configuration for pre-PR validation. Defines paths and options for validating code quality before creating a pull request.
 */
export interface PrePRConfig {
  /**
   * Base path for the repository to validate
   */
  basePath: string;
  /**
   * Skip slow validations (CI environment checks)
   */
  quickMode?: boolean;
  /**
   * Skip test-implementation alignment validation
   */
  skipTests?: boolean;
  /**
   * Directories containing source code to validate
   */
  sourceDirs?: string[];
  /**
   * Directories containing test files
   */
  testDirs?: string[];
  /**
   * Configuration files to check for documentation
   */
  configFiles?: string[];
  /**
   * Environment variable files to parse for documented variables
   */
  envFiles?: string[];
}

// Source: schemas/session/session-protocol.schema.json
/**
 * Session log filename in YYYY-MM-DD-session-NN.md format
 */
export type SessionLogFilename = string;
/**
 * Required sections in a session log
 */
export type RequiredSections = ("Session Info" | "Protocol Compliance" | "Session Start" | "Session End")[];
/**
 * Patterns that indicate Brain MCP initialization
 */
export type BrainInitializationPatterns = string[];
/**
 * Patterns that indicate Brain note update
 */
export type BrainUpdatePatterns = string[];
/**
 * Patterns that indicate git branch documentation
 */
export type BranchPatterns = string[];
/**
 * Placeholder values that are NOT valid branch names
 */
export type BranchPlaceholders = string[];
/**
 * Patterns that indicate markdown lint execution
 */
export type LintEvidencePatterns = string[];
/**
 * Regex patterns for invalid memory evidence placeholders
 */
export type MemoryPlaceholderPatterns = string[];

/**
 * Schema for session protocol validation. Validates session log structure, checklist completion, and evidence requirements.
 */
export interface SessionProtocol {
  /**
   * Path to the session log file
   */
  sessionLogPath?: string;
  filename?: SessionLogFilename;
  requiredSections?: RequiredSections;
  brainInitializationPatterns?: BrainInitializationPatterns;
  brainUpdatePatterns?: BrainUpdatePatterns;
  branchPatterns?: BranchPatterns;
  branchPlaceholders?: BranchPlaceholders;
  lintEvidencePatterns?: LintEvidencePatterns;
  memoryPlaceholderPatterns?: MemoryPlaceholderPatterns;
}

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

// Source: schemas/session/session-validation.schema.json
/**
 * Type of QA skip allowed for a session
 */
export type QASkipType = "" | "docs-only" | "investigation-only";

/**
 * Schema for session validation parameters. Validates session state, QA skip eligibility, and memory evidence.
 */
export interface SessionValidation {
  workflowState?: SessionWorkflowState;
  qaSkipType?: QASkipType;
  /**
   * List of changed files for QA skip eligibility check
   */
  changedFiles?: string[];
  /**
   * Checklist rows to validate
   */
  checklistRows?: ChecklistRow[];
}
/**
 * Simplified workflow state for session validation
 */
export interface SessionWorkflowState {
  /**
   * Current workflow mode
   */
  mode?: "" | "analysis" | "planning" | "coding" | "implementation" | "disabled";
  /**
   * Current task description
   */
  task?: string;
  /**
   * Session identifier
   */
  sessionId?: string;
  /**
   * ISO timestamp of last update
   */
  updatedAt?: string;
}
/**
 * Parsed checklist row from session log
 */
export interface ChecklistRow {
  /**
   * RFC 2119 requirement level
   */
  requirement: "MUST" | "SHOULD" | "MAY";
  /**
   * Step description
   */
  step: string;
  /**
   * Checkbox status: [ ] or [x] or [X]
   */
  status: string;
  /**
   * Evidence text for the step
   */
  evidence?: string;
  [k: string]: unknown | undefined;
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

// Source: schemas/validators/batch-pr-review.schema.json
/**
 * Operation to perform on PR worktrees
 */
export type BatchPRReviewOperation = "Setup" | "Status" | "Cleanup" | "All";

/**
 * Schema for batch PR review configuration and results.
 */
export interface BatchPRReviewValidation {
  config?: BatchPRReviewConfig;
  result?: BatchPRReviewResult;
}
/**
 * Configuration for batch PR review operations
 */
export interface BatchPRReviewConfig {
  /**
   * PR numbers to process
   *
   * @minItems 1
   */
  prNumbers: [number, ...number[]];
  operation: BatchPRReviewOperation;
  /**
   * Root directory for worktrees. Empty uses parent of repo root.
   */
  worktreeRoot?: string;
  /**
   * Force operations (skip safety checks)
   */
  force?: boolean;
}
/**
 * Result of batch PR review operation
 */
export interface BatchPRReviewResult {
  /**
   * Overall success
   */
  valid: boolean;
  checks: Check[];
  /**
   * Summary message
   */
  message: string;
  remediation?: string;
  operation: BatchPRReviewOperation;
  /**
   * Resolved worktree root path
   */
  worktreeRoot: string;
  /**
   * Worktree statuses (for Status/All operations)
   */
  statuses?: WorktreeStatus[];
  /**
   * Operation results (for Setup/Cleanup/All operations)
   */
  results?: WorktreeOperationResult[];
}
/**
 * A single validation check result
 */
export interface Check {
  name: string;
  passed: boolean;
  message: string;
}
/**
 * Status of a single worktree
 */
export interface WorktreeStatus {
  /**
   * PR number
   */
  pr: number;
  /**
   * Worktree path
   */
  path: string;
  /**
   * Whether worktree exists
   */
  exists: boolean;
  /**
   * Whether worktree has no uncommitted changes
   */
  clean?: boolean;
  /**
   * Current branch name
   */
  branch?: string;
  /**
   * Current commit SHA
   */
  commit?: string;
  /**
   * Whether worktree has unpushed commits
   */
  unpushed?: boolean;
}
/**
 * Result of a worktree operation
 */
export interface WorktreeOperationResult {
  /**
   * PR number
   */
  pr: number;
  /**
   * Whether operation succeeded
   */
  success: boolean;
  /**
   * Success message
   */
  message?: string;
  /**
   * Error message if failed
   */
  error?: string;
}

// Source: schemas/validators/check-skill-exists.schema.json
/**
 * Schema for skill existence check parameters and results.
 */
export interface CheckSkillExistsValidation {
  skillInput?: SkillExistsInput;
  skillResult?: SkillExistsResult;
  scriptInput?: SkillScriptInput;
}
/**
 * Input parameters for skill existence check
 */
export interface SkillExistsInput {
  /**
   * Repository root path
   */
  basePath: string;
  /**
   * Skill name to check (kebab-case)
   */
  skillName: string;
}
/**
 * Result of skill existence check
 */
export interface SkillExistsResult {
  /**
   * Whether the skill file exists
   */
  exists: boolean;
  /**
   * The skill name that was checked
   */
  skillName: string;
  /**
   * Full path to the SKILL.md file
   */
  skillPath?: string;
  /**
   * Parsed name from frontmatter
   */
  name?: string;
  /**
   * Parsed description from frontmatter
   */
  description?: string;
  /**
   * Summary message
   */
  message: string;
  /**
   * Individual check results
   */
  checks: Check[];
}
/**
 * A single validation check result
 */
export interface Check {
  /**
   * Check identifier
   */
  name: string;
  /**
   * Whether the check passed
   */
  passed: boolean;
  /**
   * Human-readable check result message
   */
  message: string;
}
/**
 * Input parameters for skill script check
 */
export interface SkillScriptInput {
  /**
   * Repository root path
   */
  basePath: string;
  /**
   * Operation type
   */
  operation: "pr" | "issue" | "reactions" | "label" | "milestone";
  /**
   * Action name to search for
   */
  action: string;
}

// Source: schemas/validators/check-tasks.schema.json
/**
 * Status of a task
 */
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "DEFERRED";

/**
 * Schema for task validation input and results.
 */
export interface CheckTasksValidation {
  input?: TasksInput;
  result?: TasksValidationResult;
}
/**
 * Input for task validation
 */
export interface TasksInput {
  /**
   * Array of tasks to validate
   */
  tasks: Task[];
}
/**
 * A task to validate
 */
export interface Task {
  /**
   * Task name/identifier
   */
  name?: string;
  status?: TaskStatus;
  /**
   * Whether the task is completed
   */
  completed?: boolean;
  /**
   * Task description
   */
  description?: string;
  /**
   * Task assignee
   */
  assignee?: string;
  /**
   * Task due date in ISO format
   */
  dueDate?: string;
  /**
   * Task priority
   */
  priority?: "P0" | "P1" | "P2" | "P3";
  [k: string]: unknown | undefined;
}
/**
 * Result of task validation
 */
export interface TasksValidationResult {
  /**
   * Overall validation result
   */
  valid: boolean;
  /**
   * Individual check results
   */
  checks: Check[];
  /**
   * Summary message
   */
  message: string;
  /**
   * Remediation steps if validation failed
   */
  remediation?: string;
  /**
   * Names of incomplete in-progress tasks
   */
  incompleteTasks?: string[];
}
/**
 * A single validation check result
 */
export interface Check {
  /**
   * Check identifier
   */
  name: string;
  /**
   * Whether the check passed
   */
  passed: boolean;
  /**
   * Human-readable check result message
   */
  message: string;
}

// Source: schemas/validators/pr-maintenance.schema.json
/**
 * GitHub mergeable state
 */
export type MergeableState = "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
/**
 * GitHub review decision
 */
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "";
/**
 * CI check state
 */
export type CheckState = "SUCCESS" | "FAILURE" | "ERROR" | "PENDING";
/**
 * CI check conclusion
 */
export type CheckConclusion = "SUCCESS" | "FAILURE" | "NEUTRAL" | "SKIPPED" | "";
/**
 * Classification of PR author or state
 */
export type BotCategory =
  | "agent-controlled"
  | "mention-triggered"
  | "review-bot"
  | "human"
  | "human-blocked"
  | "has-derivatives";
/**
 * Reason a PR requires action
 */
export type PRActionReason =
  | "CHANGES_REQUESTED"
  | "HAS_CONFLICTS"
  | "HAS_FAILING_CHECKS"
  | "PENDING_DERIVATIVES"
  | "MENTION";

/**
 * Schema for PR maintenance analysis configuration and results.
 */
export interface PRMaintenanceValidation {
  config?: PRMaintenanceConfig;
  pullRequests?: PullRequest[];
  result?: PRMaintenanceResult;
  output?: PRMaintenanceOutput;
  rateLimit?: RateLimitInfo;
}
/**
 * Configuration for PR maintenance analysis
 */
export interface PRMaintenanceConfig {
  /**
   * Branches considered protected (non-derivative)
   */
  protectedBranches?: string[];
  /**
   * Bot usernames grouped by category
   */
  botCategories?: {
    [k: string]: string[] | undefined;
  };
  /**
   * Maximum number of PRs to analyze
   */
  maxPRs?: number;
}
/**
 * GitHub pull request data
 */
export interface PullRequest {
  number: number;
  title?: string;
  author: PRAuthor;
  /**
   * Source branch name
   */
  headRefName?: string;
  /**
   * Target branch name
   */
  baseRefName?: string;
  mergeable?: MergeableState;
  reviewDecision?: ReviewDecision;
  reviewRequests?: {
    nodes?: ReviewRequest[];
  };
  commits?: {
    nodes?: PRCommit[];
  };
  [k: string]: unknown | undefined;
}
export interface PRAuthor {
  /**
   * GitHub username
   */
  login: string;
}
export interface ReviewRequest {
  requestedReviewer?: {
    login?: string;
    name?: string;
  };
}
export interface PRCommit {
  commit?: {
    statusCheckRollup?: StatusCheckRollup;
  };
}
export interface StatusCheckRollup {
  state?: CheckState;
  contexts?: {
    nodes?: StatusCheckContext[];
  };
}
export interface StatusCheckContext {
  name?: string;
  context?: string;
  conclusion?: CheckConclusion;
  status?: string;
  state?: CheckState;
}
/**
 * Result of PR maintenance analysis
 */
export interface PRMaintenanceResult {
  totalPRs: number;
  actionRequired: PRActionItem[];
  blocked: PRActionItem[];
  derivativePRs: DerivativePR[];
  parentsWithDerivatives: ParentWithDerivatives[];
  errors?: PRError[];
}
/**
 * A PR requiring action
 */
export interface PRActionItem {
  number: number;
  category: BotCategory;
  hasConflicts: boolean;
  hasFailingChecks?: boolean;
  reason: PRActionReason;
  author: string;
  title: string;
  headRefName?: string;
  baseRefName?: string;
  requiresSynthesis?: boolean;
  derivatives?: number[];
}
/**
 * A PR targeting a non-protected branch
 */
export interface DerivativePR {
  number: number;
  title: string;
  author: string;
  targetBranch: string;
  sourceBranch: string;
}
/**
 * A parent PR with pending derivative PRs
 */
export interface ParentWithDerivatives {
  parentPR: number;
  parentTitle: string;
  parentBranch: string;
  derivatives: number[];
}
export interface PRError {
  pr: number;
  error: string;
}
/**
 * Final output for workflow consumption
 */
export interface PRMaintenanceOutput {
  prs: PRActionItem[];
  summary: PRMaintenanceSummary;
}
export interface PRMaintenanceSummary {
  total: number;
  actionRequired: number;
  blocked: number;
  derivatives: number;
}
/**
 * GitHub API rate limit information
 */
export interface RateLimitInfo {
  coreRemaining: number;
  graphqlRemaining: number;
  /**
   * True if rate limits are sufficient (core >= 100, graphql >= 50)
   */
  isSafe: boolean;
}

// Source: schemas/validators/test-coverage-gaps.schema.json
/**
 * Programming language supported for test coverage detection
 */
export type SupportedLanguage = "go" | "powershell" | "typescript" | "javascript" | "python" | "csharp";

/**
 * Schema for test coverage gap detection options and results.
 */
export interface TestCoverageGapsValidation {
  options?: TestCoverageGapOptions;
  result?: TestCoverageGapResult;
}
/**
 * Configuration options for test coverage gap detection
 */
export interface TestCoverageGapOptions {
  /**
   * Root path to scan. Empty string defaults to current directory.
   */
  basePath?: string;
  /**
   * Language to check. Empty triggers auto-detection.
   */
  language?: "go" | "powershell" | "typescript" | "javascript" | "python" | "csharp";
  /**
   * Only check git-staged files
   */
  stagedOnly?: boolean;
  /**
   * Path to file containing patterns to ignore
   */
  ignoreFile?: string;
  /**
   * Coverage threshold percentage (0-100)
   */
  threshold?: number;
  /**
   * Additional regex ignore patterns
   */
  customPatterns?: string[];
}
/**
 * Result of test coverage gap detection
 */
export interface TestCoverageGapResult {
  /**
   * Overall validation result
   */
  valid: boolean;
  /**
   * Individual check results
   */
  checks: Check[];
  /**
   * Summary message
   */
  message: string;
  /**
   * Remediation steps if validation failed
   */
  remediation?: string;
  /**
   * Resolved absolute path that was scanned
   */
  basePath?: string;
  language?: SupportedLanguage;
  stagedOnly?: boolean;
  totalSourceFiles?: number;
  filesWithTests?: number;
  filesWithoutTests?: number;
  coveragePercent?: number;
  threshold?: number;
  missingTests?: MissingTestFile[];
  ignorePatterns?: string[];
}
/**
 * A single validation check result
 */
export interface Check {
  /**
   * Check identifier
   */
  name: string;
  /**
   * Whether the check passed
   */
  passed: boolean;
  /**
   * Human-readable check result message
   */
  message: string;
}
/**
 * A source file without a corresponding test file
 */
export interface MissingTestFile {
  /**
   * Relative path to the source file
   */
  sourceFile: string;
  /**
   * Relative path to the expected test file
   */
  expectedTest: string;
  language?: SupportedLanguage;
}
