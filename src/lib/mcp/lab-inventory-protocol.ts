import { ReagentCategory } from "@prisma/client";
import { z } from "zod";
import type { McpAuthenticatedPrincipal } from "@/lib/mcp/access-tokens";
import {
  McpInventoryError,
  listAuthorizedLabs,
  resolveWesternBlotAntibodies,
  searchLabReagents,
} from "@/lib/mcp/lab-inventory";

/**
 * The MCP revisions this stateless, tools-only server implements. Keep the
 * newest compatible revision first: that is the fallback returned during
 * `initialize` when a client offers an unknown future revision.
 */
export const INVENTORY_MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const LATEST_INVENTORY_MCP_PROTOCOL_VERSION = INVENTORY_MCP_PROTOCOL_VERSIONS[0];

export function isSupportedInventoryMcpProtocolVersion(value: string) {
  return (INVENTORY_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

export function negotiateInventoryMcpProtocolVersion(requestedVersion: string | undefined) {
  return requestedVersion && isSupportedInventoryMcpProtocolVersion(requestedVersion)
    ? requestedVersion
    : LATEST_INVENTORY_MCP_PROTOCOL_VERSION;
}

/**
 * `MCP-Protocol-Version` only governs requests after initialize. This small
 * structural check lets the HTTP transport negotiate an initial connection
 * before rejecting an unsupported request header.
 */
export function isInventoryMcpInitializeRequest(input: unknown) {
  return !!input
    && typeof input === "object"
    && !Array.isArray(input)
    && (input as { jsonrpc?: unknown }).jsonrpc === "2.0"
    && (input as { method?: unknown }).method === "initialize";
}

export function inventoryMcpInitializeProtocolVersion(input: unknown) {
  if (!isInventoryMcpInitializeRequest(input)) return LATEST_INVENTORY_MCP_PROTOCOL_VERSION;
  const params = (input as { params?: unknown }).params;
  const requestedVersion = params && typeof params === "object" && !Array.isArray(params)
    ? (params as { protocolVersion?: unknown }).protocolVersion
    : undefined;
  return negotiateInventoryMcpProtocolVersion(typeof requestedVersion === "string" ? requestedVersion : undefined);
}

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

const listLabsSchema = z.object({}).passthrough();
const searchSchema = z.object({
  labId: z.string().min(1),
  query: z.string().trim().min(1).max(120),
  category: z.nativeEnum(ReagentCategory).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
const westernBlotSchema = z.object({
  labId: z.string().min(1),
  targets: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
});

type JsonRpcId = string | number | null;
type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function result(id: JsonRpcId, value: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result: value };
}

function error(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function toolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export const inventoryMcpTools = [
  {
    name: "list_authorized_labs",
    description: "List laboratories that the signed-in Dorlabaemon user may query. Call this before inventory lookup when the laboratory is not explicit.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "search_lab_reagents",
    description: "Read a minimal, laboratory-scoped inventory projection. It returns catalog data and availability, never proof that a reagent was actually used.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["labId", "query"],
      properties: {
        labId: { type: "string", description: "Laboratory ID returned by list_authorized_labs." },
        query: { type: "string", description: "Reagent name, target, or catalog-number query." },
        category: { type: "string", enum: Object.values(ReagentCategory) },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 10 },
      },
    },
  },
  {
    name: "resolve_western_blot_antibodies",
    description: "Resolve candidate PRIMARY antibodies for declared western-blot targets. Only one exact target-name match is marked resolved. Multiple, fuzzy, secondary, or missing matches require a user selection.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["labId", "targets"],
      properties: {
        labId: { type: "string", description: "Laboratory ID returned by list_authorized_labs." },
        targets: { type: "array", minItems: 1, maxItems: 10, items: { type: "string" } },
      },
    },
  },
] as const;

export async function executeInventoryMcpRequest(input: unknown, principal: McpAuthenticatedPrincipal): Promise<JsonRpcResponse | null> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return error(null, -32600, "Invalid Request", parsed.error.flatten());
  }
  const id = parsed.data.id ?? null;
  const isNotification = parsed.data.id === undefined;
  const respond = (response: JsonRpcResponse) => (isNotification ? null : response);

  if (!principal.scopes.includes("inventory:read")) {
    return respond(error(id, -32003, "Forbidden", { code: "MCP_SCOPE_REQUIRED" }));
  }

  try {
    switch (parsed.data.method) {
      case "initialize": {
        const requested = z.object({ protocolVersion: z.string().optional() }).passthrough().safeParse(parsed.data.params);
        if (!requested.success) {
          return respond(error(id, -32602, "Invalid params", requested.error.flatten()));
        }
        const protocolVersion = negotiateInventoryMcpProtocolVersion(requested.data.protocolVersion);
        return respond(result(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "dorlabaemon-inventory", version: "0.1.1" },
          instructions: "This server is read-only. Inventory results are not evidence of actual reagent use. Ask the user to select among ambiguous matches before writing a laboratory record.",
        }));
      }
      case "ping":
        return respond(result(id, {}));
      case "notifications/initialized":
        return null;
      case "tools/list":
        return respond(result(id, { tools: inventoryMcpTools }));
      case "tools/call": {
        const call = z.object({ name: z.string(), arguments: z.unknown().optional() }).safeParse(parsed.data.params);
        if (!call.success) {
          return respond(error(id, -32602, "Invalid params", call.error.flatten()));
        }
        if (call.data.name === "list_authorized_labs") {
          const args = listLabsSchema.safeParse(call.data.arguments ?? {});
          if (!args.success) return respond(error(id, -32602, "Invalid params", args.error.flatten()));
          return respond(result(id, toolResult({ labs: await listAuthorizedLabs(principal.userId) })));
        }
        if (call.data.name === "search_lab_reagents") {
          const args = searchSchema.safeParse(call.data.arguments);
          if (!args.success) return respond(error(id, -32602, "Invalid params", args.error.flatten()));
          const candidates = await searchLabReagents({ userId: principal.userId, ...args.data });
          return respond(result(id, toolResult({
            source: "Dorlabaemon inventory catalog",
            retrievedAt: new Date().toISOString(),
            notProofOfActualUse: true,
            labId: args.data.labId,
            candidates,
          })));
        }
        if (call.data.name === "resolve_western_blot_antibodies") {
          const args = westernBlotSchema.safeParse(call.data.arguments);
          if (!args.success) return respond(error(id, -32602, "Invalid params", args.error.flatten()));
          return respond(result(id, toolResult(await resolveWesternBlotAntibodies({ userId: principal.userId, ...args.data }))));
        }
        return respond(error(id, -32601, "Method not found", { tool: call.data.name }));
      }
      default:
        return respond(error(id, -32601, "Method not found"));
    }
  } catch (caught) {
    if (caught instanceof McpInventoryError) {
      return respond(error(id, -32003, "Inventory request denied", { code: caught.code }));
    }
    if (caught instanceof Error && caught.message === "NO_LAB_ACCESS") {
      return respond(error(id, -32003, "Forbidden", { code: "NO_LAB_ACCESS" }));
    }
    console.error("[mcp/inventory] request failed", caught);
    return respond(error(id, -32603, "Internal error"));
  }
}
