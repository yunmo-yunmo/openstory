-- CreateTable
CREATE TABLE "AgentFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "chapterId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'background_agent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentFinding_projectId_chapterId_fkey" FOREIGN KEY ("projectId", "chapterId") REFERENCES "Chapter" ("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_projectId_id_key" ON "Chapter"("projectId", "id");

-- CreateIndex
CREATE INDEX "AgentFinding_projectId_chapterId_status_idx" ON "AgentFinding"("projectId", "chapterId", "status");

-- CreateIndex
CREATE INDEX "AgentFinding_projectId_type_status_idx" ON "AgentFinding"("projectId", "type", "status");
