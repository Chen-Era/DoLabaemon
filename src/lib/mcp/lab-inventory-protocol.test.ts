import assert from "node:assert/strict";
import test from "node:test";
import { executeInventoryMcpRequest, inventoryMcpTools } from "@/lib/mcp/lab-inventory-protocol";

const principal = { userId: "user-1", tokenId: "token-1", scopes: ["inventory:read"] };

test("inventory MCP initializes with a compatible protocol version", async () => {
  const response = await executeInventoryMcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  }, principal);
  assert.equal(response?.error, undefined);
  assert.deepEqual(response?.result, {
    protocolVersion: "2025-06-18",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "dorlabaemon-inventory", version: "0.1.1" },
    instructions: "This server is read-only. Inventory results are not evidence of actual reagent use. Ask the user to select among ambiguous matches before writing a laboratory record.",
  });
});

test("inventory MCP publishes only the intended read-only tools", () => {
  assert.deepEqual(inventoryMcpTools.map((tool) => tool.name), [
    "list_authorized_labs",
    "search_lab_reagents",
    "resolve_western_blot_antibodies",
  ]);
});

test("inventory MCP rejects a token without inventory scope", async () => {
  const response = await executeInventoryMcpRequest({
    jsonrpc: "2.0",
    id: "scope-check",
    method: "tools/list",
  }, { ...principal, scopes: [] });
  assert.deepEqual(response?.error, {
    code: -32003,
    message: "Forbidden",
    data: { code: "MCP_SCOPE_REQUIRED" },
  });
});
