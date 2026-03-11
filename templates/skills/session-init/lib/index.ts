/**
 * Session initialization modules for protocol-compliant session logs.
 */

export { ApplicationFailedError } from "./common_types.ts";
export { getGitInfo, type GitInfo } from "./git_helpers.ts";
export {
  getDescriptiveKeywords,
  newPopulatedSessionLog,
  type GitInfoForTemplate,
  type UserInput,
} from "./template_helpers.ts";
