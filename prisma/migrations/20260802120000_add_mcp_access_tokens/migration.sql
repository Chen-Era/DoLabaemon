-- Personal access tokens for the read-only Dorlabaemon inventory MCP.
-- Only a SHA-256 digest of each generated secret is stored.
CREATE TABLE "McpAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY['inventory:read']::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpAccessToken_tokenHash_key" ON "McpAccessToken"("tokenHash");
CREATE INDEX "McpAccessToken_userId_revokedAt_idx" ON "McpAccessToken"("userId", "revokedAt");
CREATE INDEX "McpAccessToken_expiresAt_idx" ON "McpAccessToken"("expiresAt");

ALTER TABLE "McpAccessToken"
  ADD CONSTRAINT "McpAccessToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
