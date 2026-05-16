-- CreateTable
CREATE TABLE "AISessionMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AISessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AISession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AISessionMessage_sessionId_id_idx" ON "AISessionMessage"("sessionId", "id");
