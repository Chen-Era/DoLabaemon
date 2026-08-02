import assert from "node:assert/strict";
import test from "node:test";
import {
  executeInventoryMcpRequest,
  inventoryMcpInitializeProtocolVersion,
  inventoryMcpTools,
  isInventoryMcpInitializeRequest,
  isSupportedInventoryMcpProtocolVersion,
  LATEST_INVENTORY_MCP_PROTOCOL_VERSION,
} from "@/lib/mcp/lab-inventory-protocol";

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

test("inventory MCP accepts the current stable protocol version", async () => {
  const request = {
    jsonrpc: "2.0",
    id: 2,
    method: "initialize",
    params: { protocolVersion: "2025-11-25" },
  };
  assert.equal(isSupportedInventoryMcpProtocolVersion("2025-11-25"), true);
  assert.equal(isInventoryMcpInitializeRequest(request), true);
  assert.equal(inventoryMcpInitializeProtocolVersion(request), "2025-11-25");

  const response = await executeInventoryMcpRequest(request, principal);
  assert.equal((response?.result as { protocolVersion?: string }).protocolVersion, "2025-11-25");
});

test("inventory MCP negotiates an unknown version during initialize instead of rejecting the handshake", () => {
  assert.equal(inventoryMcpInitializeProtocolVersion({
    jsonrpc: "2.0",
    id: "future-client",
    method: "initialize",
    params: { protocolVersion: "2099-01-01" },
  }), LATEST_INVENTORY_MCP_PROTOCOL_VERSION);
});

test("initialized notifications are accepted without a response body", async () => {
  const response = await executeInventoryMcpRequest({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, principal);
  assert.equal(response, null);
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
