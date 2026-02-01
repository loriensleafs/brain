/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file was automatically generated from JSON Schema files.
 * Any manual changes will be overwritten on the next generation.
 *
 * To regenerate: bun run generate:types
 * Source schemas: packages/validation/schemas/*.schema.json
 *
 * Generated: 2026-02-01T13:09:11.909Z
 */

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
