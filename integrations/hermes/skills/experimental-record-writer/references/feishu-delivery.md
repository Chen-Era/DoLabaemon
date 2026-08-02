# Feishu/Lark delivery

Use the official [larksuite/cli](https://github.com/larksuite/cli) and its installed `lark-shared`, `lark-doc`, and `lark-drive` skills. Read their current `SKILL.md` and task references before operating Feishu because command flags and scopes can change.

## Boundaries

- Create the local bundle first. A Feishu document is a publishable snapshot, not the only record of truth.
- Treat document creation, media insertion, uploads, and permission changes as external writes. Obtain explicit approval before `--execute`.
- Use `--as user` by default. Do not choose bot identity, share publicly, transfer ownership, or modify permissions without a specific user instruction.
- Do not publish personal identifiers, credentials, or sensitive data unless the user has explicitly approved that scope and destination.

## Setup and authorization

If `lark-cli` is missing, install the official CLI and its skills:

```bash
npx @larksuite/cli@latest install
npx skills add larksuite/cli -y -g
```

The user must complete app configuration and sign in. Request the smallest necessary Docs and Drive scopes. Follow the current `lark-shared` skill for browser authorization and QR-code handling.

```bash
lark-cli config init --new
lark-cli auth login --domain docs --domain drive --no-wait --json
lark-cli auth status --json --verify
```

## Publish flow

1. Run `publish_lark.py --dry-run` and show the exact record, destination, and attachment count.
2. With user approval, run it with `--execute`.
3. The helper calls `lark-cli docs +create --as user --doc-format markdown`, parses the returned document ID and URL, then inserts each image or file sequentially with `docs +media-insert`.
4. Store `lark-publish.json`, which binds the local record ID and revision to the remote document URL and per-file responses. Run `lark-cli docs +fetch` to verify the document if the user asks for confirmation.

When a user asks to import the generated `record.docx` rather than create a native document, use `lark-cli drive +import --type docx` and keep the same local bundle. Do not overwrite an existing cloud document or upload files concurrently to the same destination.
