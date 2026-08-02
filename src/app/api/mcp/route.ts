import { NextResponse } from "next/server";
import { authenticateMcpBearerToken, readBearerToken } from "@/lib/mcp/access-tokens";
import { executeInventoryMcpRequest, isSupportedInventoryMcpProtocolVersion } from "@/lib/mcp/lab-inventory-protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const endpointHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function matchesConfiguredOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(process.env.NEXTAUTH_URL ?? req.url).origin;
  } catch {
    return false;
  }
}

function protocolVersion(req: Request) {
  return req.headers.get("mcp-protocol-version") ?? "2025-03-26";
}

function withProtocolHeader(headers: Record<string, string>, version: string) {
  return { ...headers, "MCP-Protocol-Version": version };
}

function forbiddenOrigin() {
  return NextResponse.json({ error: "Forbidden origin", code: "MCP_ORIGIN_FORBIDDEN" }, { status: 403 });
}

function unauthorized(version: string) {
  return NextResponse.json(
    { error: "Unauthorized", code: "MCP_UNAUTHORIZED" },
    {
      status: 401,
      headers: {
        ...withProtocolHeader(endpointHeaders, version),
        "WWW-Authenticate": 'Bearer realm="Dorlabaemon inventory MCP"',
      },
    },
  );
}

export async function OPTIONS(req: Request) {
  if (!matchesConfiguredOrigin(req)) return forbiddenOrigin();
  return new NextResponse(null, { status: 204, headers: endpointHeaders });
}

export async function GET(req: Request) {
  if (!matchesConfiguredOrigin(req)) return forbiddenOrigin();
  return NextResponse.json(
    { error: "This stateless MCP endpoint does not offer an SSE stream.", code: "MCP_SSE_NOT_SUPPORTED" },
    { status: 405, headers: { ...endpointHeaders, Allow: "POST, OPTIONS" } },
  );
}

export async function POST(req: Request) {
  if (!matchesConfiguredOrigin(req)) return forbiddenOrigin();
  const accept = req.headers.get("accept") ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    return NextResponse.json(
      { error: "MCP requests must accept application/json and text/event-stream.", code: "MCP_ACCEPT_REQUIRED" },
      { status: 406, headers: endpointHeaders },
    );
  }
  const version = protocolVersion(req);
  if (!isSupportedInventoryMcpProtocolVersion(version)) {
    return NextResponse.json(
      { error: "Unsupported MCP protocol version", code: "MCP_PROTOCOL_VERSION_UNSUPPORTED" },
      { status: 400, headers: withProtocolHeader(endpointHeaders, "2025-06-18") },
    );
  }
  let principal;
  try {
    principal = await authenticateMcpBearerToken(readBearerToken(req.headers.get("authorization")));
  } catch (error) {
    console.error("[mcp/inventory] authentication lookup failed", error);
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } },
      { status: 503, headers: withProtocolHeader(endpointHeaders, version) },
    );
  }
  if (!principal) {
    return unauthorized(version);
  }
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: withProtocolHeader(endpointHeaders, version) },
    );
  }
  try {
    const response = await executeInventoryMcpRequest(input, principal);
    if (!response) {
      return new NextResponse(null, { status: 202, headers: withProtocolHeader(endpointHeaders, version) });
    }
    return NextResponse.json(response, { headers: withProtocolHeader(endpointHeaders, version) });
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } },
      { status: 500, headers: withProtocolHeader(endpointHeaders, version) },
    );
  }
}
