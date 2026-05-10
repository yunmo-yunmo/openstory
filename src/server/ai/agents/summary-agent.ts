import "server-only";

// Re-export the shared logic so existing consumers (agent-runner) don't need to change imports.
export { generateSummary as generateChapterSummary } from "../tools/generate-summary";
