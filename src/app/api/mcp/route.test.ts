import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/mcp/route";
import { LATEST_INVENTORY_MCP_PROTOCOL_VERSION } from "@/lib/mcp/lab-inventory-protocol";

const accept = "application/json, text/event-stream";

test("MCP negotiates a newer initialize header before authentication", async () => {
  const response = await POST(new Request("https://dorlabaemon.era.ac.cn/api/mcp", {
    method: "POST",
    headers: {
      Accept: accept,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2099-01-01",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2099-01-01" },
    }),
  }));

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("MCP-Protocol-Version"), LATEST_INVENTORY_MCP_PROTOCOL_VERSION);
});

test("MCP keeps rejecting an unsupported version after initialization", async () => {
  const response = await POST(new Request("https://dorlabaemon.era.ac.cn/api/mcp", {
    method: "POST",
    headers: {
      Accept: accept,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2099-01-01",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  }));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("MCP-Protocol-Version"), LATEST_INVENTORY_MCP_PROTOCOL_VERSION);
  assert.deepEqual(await response.json(), {
    error: "Unsupported MCP protocol version",
    code: "MCP_PROTOCOL_VERSION_UNSUPPORTED",
    supportedProtocolVersions: ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
  });
});
