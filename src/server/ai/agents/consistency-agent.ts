import "server-only";

export type { ConsistencyIssue } from "../tools/check-consistency";
// Re-export the shared logic so existing consumers (agent-runner) don't need to change imports.
export { checkConsistency as checkChapterConsistency } from "../tools/check-consistency";
