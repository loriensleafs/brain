/**
 * Shared types for session-init modules.
 *
 * Defines ApplicationFailedError used by git_helpers and template_helpers
 * for wrapping unexpected errors with diagnostic context.
 */

export class ApplicationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationFailedError";
  }
}
