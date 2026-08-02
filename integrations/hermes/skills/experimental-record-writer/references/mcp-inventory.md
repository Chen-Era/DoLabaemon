# Dorlabaemon inventory MCP

Use the Dorlabaemon inventory MCP only after the user has configured a personal access token from the signed-in Dorlabaemon **MCP 接入** page. Read the project guide at `docs/mcp-inventory.md` before asking a model to use it.

## Record-safe lookup flow

1. Select an authorized laboratory explicitly with `list_authorized_labs` when the laboratory is not stated.
2. Use `resolve_western_blot_antibodies` for a Western blot target list, or `search_lab_reagents` for another named reagent.
3. Treat every returned item as an inventory candidate. It is never proof of the product, unit, lot, dilution, or volume actually used.
4. If the MCP returns `ambiguous`, `not_found`, a fuzzy name match, or more than one candidate, show a compact candidate table and ask the researcher to select. Never choose by stock quantity, recency, vendor, or apparent popularity.
5. A single `resolved` exact primary-antibody target may supply an inventory-derived catalog number only when the user has already said that target was used. Preserve the reagent ID, vendor, catalog number, availability state, lookup timestamp, and `source: Dorlabaemon inventory MCP` in the reagent snapshot.
6. Still ask for lot number, expiry of the actual container, amount, concentration/dilution, and the actual operation. Leave each missing field as `未提供` or `待确认`.

For “跑了 KLF6 和 β-actin 的 WB”, query the targets as `KLF6` and `β-actin`. The server recognizes the `ACTB` alias but must not conflate a secondary antibody with the requested primary antibody.

## Token and Feishu boundaries

- Never paste a Dorlabaemon token into the experiment record, a Feishu document, a prompt, or a Git repository.
- The model sends it only as an `Authorization: Bearer` header to `https://dorlabaemon.era.ac.cn/api/mcp`.
- A local/hosted agent may use Dorlabaemon MCP for inventory reads and the official Feishu MCP or `lark-cli` for document writes. They are separate authorizations.
- Feishu’s built-in chat entry requires a self-built bot/Aily agent with user account linking. Do not claim that publishing a Feishu document makes the inventory MCP available to every Feishu model.
