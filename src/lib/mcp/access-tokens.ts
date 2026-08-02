import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-mode";

const TOKEN_PREFIX = "dlmcp_";
const DEFAULT_SCOPE = "inventory:read";

export type McpTokenView = {
  id: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type McpAuthenticatedPrincipal = {
  userId: string;
  tokenId: string;
  scopes: string[];
};

export class McpTokenError extends Error {
  constructor(public readonly code: "MCP_TOKEN_NOT_FOUND" | "MCP_TOKEN_UNAVAILABLE") {
    super(code);
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function formatToken(record: {
  id: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): McpTokenView {
  return {
    id: record.id,
    label: record.label,
    tokenPrefix: record.tokenPrefix,
    scopes: record.scopes,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

function assertPersistentMode() {
  if (isDemoMode()) {
    throw new McpTokenError("MCP_TOKEN_UNAVAILABLE");
  }
}

export async function listMcpAccessTokens(userId: string): Promise<McpTokenView[]> {
  assertPersistentMode();
  const tokens = await prisma.mcpAccessToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return tokens.map(formatToken);
}

export async function createMcpAccessToken(input: {
  userId: string;
  label: string;
  expiresInDays: number | null;
}): Promise<{ token: string; item: McpTokenView }> {
  assertPersistentMode();
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const record = await prisma.mcpAccessToken.create({
    data: {
      userId: input.userId,
      label: input.label,
      tokenPrefix: token.slice(0, 16),
      tokenHash: hashToken(token),
      scopes: [DEFAULT_SCOPE],
      expiresAt,
    },
  });
  return { token, item: formatToken(record) };
}

export async function revokeMcpAccessToken(input: { userId: string; tokenId: string }): Promise<McpTokenView> {
  assertPersistentMode();
  const existing = await prisma.mcpAccessToken.findFirst({
    where: { id: input.tokenId, userId: input.userId },
  });
  if (!existing) {
    throw new McpTokenError("MCP_TOKEN_NOT_FOUND");
  }
  const record = await prisma.mcpAccessToken.update({
    where: { id: existing.id },
    data: { revokedAt: existing.revokedAt ?? new Date() },
  });
  return formatToken(record);
}

export async function authenticateMcpBearerToken(token: string | null | undefined): Promise<McpAuthenticatedPrincipal | null> {
  if (isDemoMode() || !token?.startsWith(TOKEN_PREFIX)) {
    return null;
  }
  const record = await prisma.mcpAccessToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt.getTime() <= Date.now())) {
    return null;
  }
  await prisma.mcpAccessToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { userId: record.userId, tokenId: record.id, scopes: record.scopes };
}

export function readBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
