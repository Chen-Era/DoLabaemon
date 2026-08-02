# Dorlabaemon inventory MCP

The Dorlabaemon inventory MCP gives an authenticated model a narrow, read-only view of the reagent inventory that the signed-in user is allowed to access. It is designed to enrich an experimental-record draft, not to prove what happened at the bench.

## What it does

- Endpoint: `https://dorlabaemon.era.ac.cn/api/mcp`
- Transport: stateless Streamable HTTP with JSON responses; it does not open an SSE stream on `GET`
- Authentication: a revocable personal access token created from the signed-in **MCP 接入** page
- Scope: `inventory:read` only
- Data boundary: each request checks the token owner’s current membership of the requested laboratory.

The server exposes three tools:

| Tool | Purpose |
| --- | --- |
| `list_authorized_labs` | Select an authorized laboratory explicitly. |
| `search_lab_reagents` | Search a minimal reagent projection by target, name, or catalog number. |
| `resolve_western_blot_antibodies` | Resolve `PRIMARY`-antibody candidates for declared WB targets. |

Each reagent returned by a lookup is deliberately record-safe and contains only: `reagentName`, `manufacturer`, `catalogNumber`, `category`, relevant `antibody` target/role metadata, and `availability.state`. The tool response also includes a `lookupTimestamp`. It excludes internal reagent and lab IDs, quantities, units, expiry dates, search-ranking details, notes, uploaded-by data, user profile data, model credentials, original experiment files, and inventory-service provenance.

## Configure a local MCP-capable model

1. Sign in to Dorlabaemon and open **MCP 接入**.
2. Create a token for the intended local client. Copy it immediately; it will not be shown again.
3. Store the token in that client’s encrypted secret store or environment, not in a prompt, record, or repository.
4. Add the remote MCP endpoint using the client’s Streamable HTTP configuration. A generic configuration is:

```json
{
  "mcpServers": {
    "dorlabaemon-inventory": {
      "url": "https://dorlabaemon.era.ac.cn/api/mcp",
      "headers": {
        "Authorization": "Bearer ${DORLABAEMON_MCP_TOKEN}"
      }
    }
  }
}
```

The exact configuration field name differs by client. Use the client’s documentation, but preserve the endpoint and `Authorization` header. The MCP specification requires bearer tokens to be sent in the authorization header, not in a query string. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)

The client must support JSON responses to POST requests and send an `Accept` header for both `application/json` and `text/event-stream`, as required by Streamable HTTP. The endpoint validates any supplied `Origin` header against the configured site origin. It negotiates `2025-11-25`, `2025-06-18`, `2025-03-26`, and `2024-11-05` during `initialize`; a newer client is offered the newest compatible version rather than being rejected during its first handshake. [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

### A client reports HTTP 400 while connecting

The server itself does not need Hermes or any other MCP client SDK. Confirm that the remote URL ends in `/api/mcp`, the `Authorization: Bearer …` header is present, and the client is configured for **Streamable HTTP**. The initial `initialize` request can use a newer protocol header; the server now negotiates down to a supported version. If a later request still receives `MCP_PROTOCOL_VERSION_UNSUPPORTED`, update the client or configure it to use `2025-11-25` (preferred) or one of the versions listed above.

## Record-writing behavior

For a request such as “跑了 KLF6 和 β-actin 的 WB”, an agent should:

1. Call `list_authorized_labs` when the laboratory is not already explicit.
2. Call `resolve_western_blot_antibodies` with `targets: ["KLF6", "β-actin"]`.
3. For a single exact primary-antibody target match, use the returned reagent name, manufacturer, catalog number, relevant antibody metadata, availability state, and lookup timestamp as a reagent snapshot. Do not write a service name, URL, MCP name, token, internal reagent ID, laboratory ID, or other lookup provenance into the record.
4. For zero, fuzzy, or multiple candidates, present the choices and require the researcher to choose. Never choose by vendor, recency, quantity, or apparent popularity.
5. The MCP only supplies catalog information and availability; it does not prove what was used. Follow the experimental-record skill's current rules for omitted lot, expiry, amount, and execution-time fields.

`resolved` means the catalog contains exactly one primary-antibody target match. It does **not** establish that the reagent, bottle, lot, or stock unit was used in this experiment. The experimental-record skill must preserve this distinction.

## Token lifecycle and deployment

- Tokens default to 30 days and can be created for 7, 30, or 90 days.
- Only a SHA-256 digest is stored. The cleartext token is returned once, then cannot be recovered.
- Revoking a token prevents later requests immediately. Removing a user from a laboratory also blocks later requests to that laboratory.
- Apply `prisma/migrations/20260802120000_add_mcp_access_tokens/migration.sql` and regenerate Prisma Client before deploying this version.
- The endpoint is disabled in demo mode; demo data must not become an external model data source.

## Feishu/Lark integration boundary

The supported first path is an agent that connects to two services: this Dorlabaemon MCP for inventory reads and Feishu’s official MCP or `lark-cli` for document creation. The user authorizes each service independently; neither access token is passed through the other MCP.

Feishu’s official remote MCP documentation describes an agent calling Feishu tools. It does not make a third-party MCP automatically available inside every built-in Feishu chat model. A native Feishu chat entry point therefore needs a second-phase self-built bot/Aily agent that verifies Feishu events, links the Feishu identity to a Dorlabaemon user, obtains explicit Dorlabaemon inventory consent, and invokes this MCP server as its backend tool. That work requires a Feishu app ID, event-verification configuration, redirect URLs, and an approved account-linking policy; it is intentionally not enabled by a static token in the bot prompt. [Feishu remote MCP guide](https://open.feishu.cn/document/mcp_open_tools/developers-call-remote-mcp-server), [Feishu agent application guide](https://open.larksuite.com/document/mcp_open_tools/integrating-agents-with-feishu/overview)
