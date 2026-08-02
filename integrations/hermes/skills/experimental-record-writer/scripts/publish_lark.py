#!/usr/bin/env python3
"""Publish a local experiment-record snapshot to Feishu/Lark via lark-cli.

Use --dry-run first. --execute creates a native Feishu document and inserts the
record attachments sequentially. It never changes sharing permissions.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from record_bundle import IMAGE_SUFFIXES, RecordError, append_audit, json_write, load_bundle, now_iso, write_manifest


def command_plan(directory: Path, bundle: dict[str, Any], cli: str, parent_token: str) -> list[list[str]]:
    record = bundle["record"]
    create = [cli, "docs", "+create", "--as", "user", "--doc-format", "markdown", "--title", str(record["title"]), "--content", (directory / "record.md").read_text(encoding="utf-8")]
    if parent_token:
        create.extend(["--parent-token", parent_token])
    commands = [[cli, "auth", "status", "--json", "--verify"], create]
    for attachment in bundle.get("attachments", []):
        if not isinstance(attachment, dict):
            continue
        path = directory / "attachments" / str(attachment.get("storedName", ""))
        command = [cli, "docs", "+media-insert", "--as", "user", "--doc", "<document_id>", "--file", str(path)]
        if path.suffix.lower() not in IMAGE_SUFFIXES:
            command.extend(["--type", "file"])
        commands.append(command)
    return commands


def run_json(command: list[str]) -> dict[str, Any]:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "未知 lark-cli 错误"
        raise RecordError(f"lark-cli 命令失败: {message}")
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RecordError(f"lark-cli 未返回 JSON: {result.stdout[:400]}") from error
    if payload.get("ok") is not True:
        raise RecordError(f"lark-cli 返回失败: {payload.get('error', payload)}")
    return payload


def execute(directory: Path, bundle: dict[str, Any], cli: str, parent_token: str) -> dict[str, Any]:
    run_json([cli, "auth", "status", "--json", "--verify"])
    record = bundle["record"]
    create = [cli, "docs", "+create", "--as", "user", "--doc-format", "markdown", "--title", str(record["title"]), "--content", (directory / "record.md").read_text(encoding="utf-8")]
    if parent_token:
        create.extend(["--parent-token", parent_token])
    created = run_json(create)
    document = created.get("data", {}).get("document", {})
    document_id = document.get("document_id")
    if not document_id:
        raise RecordError("创建飞书文档成功但未返回 document_id")

    media: list[dict[str, Any]] = []
    for attachment in bundle.get("attachments", []):
        if not isinstance(attachment, dict):
            continue
        path = directory / "attachments" / str(attachment.get("storedName", ""))
        if not path.is_file():
            raise RecordError(f"不能发布缺失附件: {path}")
        insert = [cli, "docs", "+media-insert", "--as", "user", "--doc", str(document_id), "--file", str(path)]
        if path.suffix.lower() not in IMAGE_SUFFIXES:
            insert.extend(["--type", "file"])
        response = run_json(insert)
        media.append({"attachmentId": attachment.get("id"), "storedName": attachment.get("storedName"), "response": response})
    return {"created": created, "document": document, "media": media}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", required=True, help="record-bundle directory")
    parser.add_argument("--parent-token", default="", help="approved Drive folder or Wiki parent token")
    parser.add_argument("--cli", default="lark-cli", help="lark-cli executable")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    try:
        directory = Path(args.record).expanduser().resolve()
        bundle = load_bundle(directory)
        plan = command_plan(directory, bundle, args.cli, args.parent_token)
        if args.dry_run:
            print(json.dumps({"recordId": bundle["record"]["id"], "revision": bundle["record"]["revision"], "parentTokenProvided": bool(args.parent_token), "attachmentCount": len(bundle.get("attachments", [])), "commands": plan}, ensure_ascii=False, indent=2))
            return
        if shutil.which(args.cli) is None:
            raise RecordError("找不到 lark-cli。请按 references/feishu-delivery.md 安装并完成授权。")
        result = execute(directory, bundle, args.cli, args.parent_token)
        receipt = {
            "recordId": bundle["record"]["id"],
            "revision": bundle["record"]["revision"],
            "publishedAt": now_iso(),
            "identity": "user",
            "parentTokenProvided": bool(args.parent_token),
            "result": result,
        }
        json_write(directory / "lark-publish.json", receipt)
        write_manifest(directory, bundle)
        append_audit(directory, "PUBLISH_LARK", bundle, "user", "发布到飞书", {"document": result.get("document", {}), "attachmentCount": len(result.get("media", []))})
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
    except RecordError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
