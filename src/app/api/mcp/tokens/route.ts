import { NextResponse } from "next/server";
import { z } from "zod";
import {
  McpTokenError,
  createMcpAccessToken,
  listMcpAccessTokens,
  revokeMcpAccessToken,
} from "@/lib/mcp/access-tokens";
import { requireUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  expiresInDays: z.number().int().min(1).max(90).nullable().optional(),
});
const deleteSchema = z.object({ tokenId: z.string().min(1) });

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (error instanceof McpTokenError) {
    const status = error.code === "MCP_TOKEN_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: error.code, code: error.code }, { status });
  }
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message.includes("mcpAccessToken") || message.includes("McpAccessToken")) {
    return NextResponse.json(
      { error: "Database schema is missing MCP token tables. Apply the Prisma migration and regenerate Prisma Client.", code: "MCP_TOKEN_SCHEMA_OUTDATED" },
      { status: 503 },
    );
  }
  console.error("[mcp/tokens] request failed", error);
  return NextResponse.json({ error: "Failed to manage MCP token", code: "MCP_TOKEN_REQUEST_FAILED" }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    return NextResponse.json({ items: await listMcpAccessTokens(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const created = await createMcpAccessToken({
      userId: user.id,
      label: parsed.data.label,
      expiresInDays: parsed.data.expiresInDays ?? 30,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUserFromRequest(req);
    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const item = await revokeMcpAccessToken({ userId: user.id, tokenId: parsed.data.tokenId });
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
