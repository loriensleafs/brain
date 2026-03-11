/**
 * _constants.ts - Shared constants for skill validation scripts
 *
 * These constants are used by:
 * - quick_validate.ts (packaging validation)
 * - validate_skill.ts (full structural validation)
 * - discover_skills.ts (skill indexing)
 */

// ===========================================================================
// FRONTMATTER PROPERTIES
// ===========================================================================

/** Required fields */
export const REQUIRED_PROPERTIES = new Set([
  "name", // Skill identifier (hyphen-case, max 64 chars)
  "description", // Discovery text (max 1024 chars, no angle brackets)
]);

/** Optional fields */
export const OPTIONAL_PROPERTIES = new Set([
  "license", // Distribution license (MIT, Apache-2.0, etc.)
  "allowed-tools", // Tool restrictions (comma-separated or YAML list)
  "metadata", // Custom fields (author, domains, etc.)
  "model", // Specific Claude model (e.g., claude-sonnet-4-20250514)
  "context", // Execution context ('fork' for isolated sub-agent)
  "agent", // Agent type when context: fork
  "agents", // Agent types for the skill
  "hooks", // Lifecycle hooks (PreToolUse, PostToolUse, Stop)
  "user-invocable", // Slash menu visibility (default: true)
  "version", // Semantic version (e.g., 1.0.0)
]);

/** All allowed properties */
export const ALLOWED_PROPERTIES = new Set([
  ...REQUIRED_PROPERTIES,
  ...OPTIONAL_PROPERTIES,
]);

/** Recommended but optional fields */
export const RECOMMENDED_PROPERTIES = new Set(["license"]);

// ===========================================================================
// VALIDATION CONSTANTS
// ===========================================================================

/** Valid agent types for context: fork */
export const VALID_AGENT_TYPES = new Set([
  "Explore",
  "Plan",
  "general-purpose",
]);

/** Valid hook event names */
export const VALID_HOOK_EVENTS = new Set([
  "PreToolUse",
  "PostToolUse",
  "Stop",
]);

/** Valid hook types */
export const VALID_HOOK_TYPES = new Set(["command", "prompt"]);

/** Known tool names for allowed-tools validation (warning only, not error) */
export const KNOWN_TOOLS = new Set([
  "Read",
  "Glob",
  "Grep",
  "Write",
  "Edit",
  "Bash",
  "Task",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
  "NotebookEdit",
  "AskUserQuestion",
]);

/** Field constraints */
export const NAME_MAX_LENGTH = 64;
export const DESCRIPTION_MAX_LENGTH = 1024;

/**
 * Skill name regex (unified across all validators)
 * - Must start with lowercase letter
 * - Can contain lowercase letters, digits, and hyphens
 * - Cannot have consecutive hyphens (checked separately)
 * - Cannot start or end with hyphen
 */
export const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;

/** Semver regex (supports pre-release versions like 1.0.0-beta.1) */
export const SEMVER_REGEX =
  /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;

/** Frontmatter regex (handles both LF and CRLF line endings) */
export const FRONTMATTER_REGEX = /^---\r?\n(.*?)\r?\n---/s;
