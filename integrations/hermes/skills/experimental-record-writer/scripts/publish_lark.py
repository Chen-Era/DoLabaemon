#!/usr/bin/env python3
"""Publish or append experiment results to a Feishu/Lark document via lark-cli.

Use --dry-run first. --execute creates a native Feishu document or, with
--sync-results, appends unsynchronised results to the document identified by
the existing lark-publish receipt. It never changes sharing permissions or
overwrites document content.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from record_bundle import (
    IMAGE_SUFFIXES,
    RecordError,
    append_audit,
    json_read,
    json_write,
    load_bundle,
    now_iso,
    write_manifest,
)


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


def receipt_path(directory: Path) -> Path:
    return directory / "lark-publish.json"


def load_publish_receipt(directory: Path, bundle: dict[str, Any]) -> dict[str, Any]:
    path = receipt_path(directory)
    if not path.is_file():
        raise RecordError("同步实验结果前必须先发布该记录到飞书（缺少 lark-publish.json）。")
    receipt = json_read(path)
    if receipt.get("recordId") != bundle["record"].get("id"):
        raise RecordError("lark-publish.json 的 recordId 与当前记录不一致，不能据此更新飞书文档。")
    return receipt


def receipt_document(receipt: dict[str, Any]) -> dict[str, Any]:
    candidates = [receipt.get("document")]
    result = receipt.get("result")
    if isinstance(result, dict):
        candidates.append(result.get("document"))
    for candidate in candidates:
        if isinstance(candidate, dict) and str(candidate.get("document_id", "")).strip():
            return candidate
    raise RecordError("lark-publish.json 未包含 document_id，不能安全定位要更新的飞书文档。")


def plain_text(value: Any, missing: str = "未提供") -> str:
    value = str(value or "").strip()
    return value or missing


def markdown_inline(value: Any, missing: str = "未提供") -> str:
    """Render record data as literal text inside a Markdown list item."""
    output = plain_text(value, missing).replace("\\", "\\\\")
    for character in ("`", "*", "_", "[", "]", "$", "~", "<"):
        output = output.replace(character, f"\\{character}")
    return output.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


def attachment_index(bundle: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for attachment in bundle.get("attachments", []):
        if not isinstance(attachment, dict):
            continue
        attachment_id = str(attachment.get("id", "")).strip()
        if attachment_id:
            index[attachment_id] = attachment
    return index


def result_items(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for result in bundle["record"].get("results", []):
        if not isinstance(result, dict):
            continue
        if not str(result.get("id", "")).strip():
            raise RecordError("记录中的结果缺少 result ID，不能安全同步到飞书。")
        results.append(result)
    return results


def result_markdown(bundle: dict[str, Any], result: dict[str, Any]) -> str:
    """Create an append-only result section that does not alter prior content."""
    record = bundle["record"]
    return "\n".join([
        "## 补充实验结果",
        "",
        f"- 结果 ID：{markdown_inline(result.get('id'))}",
        f"- 关联记录：{markdown_inline(record.get('id'))}（本地修订 {markdown_inline(record.get('revision'))}）",
        f"- 结果日期：{markdown_inline(result.get('observedAt'))}",
        f"- 结果摘要：{markdown_inline(result.get('summary'))}",
        f"- 记录人：{markdown_inline(result.get('addedBy'))}",
        "",
    ])


def sync_state(receipt: dict[str, Any], *, create: bool) -> tuple[dict[str, Any], dict[str, Any]]:
    state = receipt.get("resultSync")
    if state is None:
        if not create:
            return {}, {}
        state = {}
        receipt["resultSync"] = state
    if not isinstance(state, dict):
        raise RecordError("lark-publish.json 的 resultSync 元数据格式无效。")
    entries = state.get("results")
    if entries is None:
        if not create:
            return state, {}
        entries = {}
        state["results"] = entries
    if not isinstance(entries, dict):
        raise RecordError("lark-publish.json 的 resultSync.results 元数据格式无效。")
    return state, entries


def initial_media_ids(receipt: dict[str, Any]) -> set[str]:
    result = receipt.get("result")
    if not isinstance(result, dict):
        return set()
    media = result.get("media")
    if not isinstance(media, list):
        return set()
    return {
        str(item.get("attachmentId"))
        for item in media
        if isinstance(item, dict) and str(item.get("attachmentId", "")).strip()
    }


def entry_attachment_ids(entry: dict[str, Any]) -> set[str]:
    attachments = entry.get("attachments", [])
    if not isinstance(attachments, list):
        raise RecordError("lark-publish.json 的结果附件回执格式无效。")
    return {
        str(item.get("attachmentId"))
        for item in attachments
        if isinstance(item, dict) and str(item.get("attachmentId", "")).strip()
    }


def result_attachment_ids(result: dict[str, Any], attachments: dict[str, dict[str, Any]]) -> list[str]:
    raw_ids = result.get("attachmentIds", [])
    if not isinstance(raw_ids, list):
        raise RecordError(f"结果 {result.get('id')} 的 attachmentIds 必须是列表。")
    result_ids: list[str] = []
    for raw_id in raw_ids:
        attachment_id = str(raw_id).strip()
        if not attachment_id:
            continue
        if attachment_id not in attachments:
            raise RecordError(f"结果 {result.get('id')} 引用了缺失附件: {attachment_id}")
        result_ids.append(attachment_id)
    return result_ids


def update_result_command(cli: str, document_id: str, content: str) -> list[str]:
    return [
        cli,
        "docs",
        "+update",
        "--as",
        "user",
        "--doc",
        document_id,
        "--command",
        "append",
        "--doc-format",
        "markdown",
        "--content",
        content,
    ]


def media_command(cli: str, document_id: str, directory: Path, attachment: dict[str, Any]) -> list[str]:
    path = directory / "attachments" / str(attachment.get("storedName", ""))
    if not path.is_file():
        raise RecordError(f"不能发布缺失附件: {path}")
    command = [cli, "docs", "+media-insert", "--as", "user", "--doc", document_id, "--file", str(path)]
    if path.suffix.lower() not in IMAGE_SUFFIXES:
        command.extend(["--type", "file"])
    return command


def result_sync_plan(directory: Path, bundle: dict[str, Any], receipt: dict[str, Any], cli: str) -> dict[str, Any]:
    document = receipt_document(receipt)
    document_id = str(document["document_id"])
    _, entries = sync_state(receipt, create=False)
    attachments = attachment_index(bundle)
    already_published = initial_media_ids(receipt)
    for entry in entries.values():
        if isinstance(entry, dict):
            already_published.update(entry_attachment_ids(entry))

    commands: list[list[str]] = [[cli, "auth", "status", "--json", "--verify"]]
    pending_results: list[str] = []
    pending_attachments: list[str] = []
    for result in result_items(bundle):
        result_id = str(result["id"])
        entry = entries.get(result_id, {})
        if not isinstance(entry, dict):
            raise RecordError(f"lark-publish.json 中结果 {result_id} 的同步元数据格式无效。")
        if not entry.get("summaryPublishedAt"):
            commands.append(update_result_command(cli, document_id, result_markdown(bundle, result)))
            pending_results.append(result_id)
        for attachment_id in result_attachment_ids(result, attachments):
            if attachment_id in already_published:
                continue
            commands.append(media_command(cli, document_id, directory, attachments[attachment_id]))
            pending_attachments.append(attachment_id)
            already_published.add(attachment_id)
    return {
        "recordId": bundle["record"]["id"],
        "revision": bundle["record"]["revision"],
        "documentId": document_id,
        "documentUrl": document.get("url", ""),
        "pendingResultIds": pending_results,
        "pendingAttachmentIds": pending_attachments,
        "commands": commands,
    }


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


def persist_result_sync(directory: Path, bundle: dict[str, Any], receipt: dict[str, Any]) -> None:
    json_write(receipt_path(directory), receipt)
    write_manifest(directory, bundle)


def execute_result_sync(directory: Path, bundle: dict[str, Any], receipt: dict[str, Any], cli: str) -> dict[str, Any]:
    """Append pending results and media, persisting progress after every remote write."""
    run_json([cli, "auth", "status", "--json", "--verify"])
    document = receipt_document(receipt)
    document_id = str(document["document_id"])
    state, entries = sync_state(receipt, create=True)
    state["documentId"] = document_id
    state["documentUrl"] = document.get("url", "")
    state["lastAttemptedAt"] = now_iso()
    attachments = attachment_index(bundle)
    published_attachment_sources = {
        attachment_id: "initial-publish" for attachment_id in initial_media_ids(receipt)
    }
    for existing_entry in entries.values():
        if isinstance(existing_entry, dict):
            for attachment_id in entry_attachment_ids(existing_entry):
                published_attachment_sources.setdefault(attachment_id, "prior-result-sync")
    actions: list[dict[str, Any]] = []

    for result in result_items(bundle):
        result_id = str(result["id"])
        entry = entries.get(result_id)
        if entry is None:
            entry = {}
            entries[result_id] = entry
        if not isinstance(entry, dict):
            raise RecordError(f"lark-publish.json 中结果 {result_id} 的同步元数据格式无效。")
        if entry.get("summaryPublishedAt") and entry.get("summary") != result.get("summary"):
            raise RecordError(
                f"结果 {result_id} 的摘要在发布后发生变化。为避免覆盖飞书原始记录，请新增一条结果而非修改已发布结果。"
            )

        action: dict[str, Any] = {"resultId": result_id, "summaryAppended": False, "media": []}
        if not entry.get("summaryPublishedAt"):
            response = run_json(update_result_command(cli, document_id, result_markdown(bundle, result)))
            entry.update({
                "summary": result.get("summary"),
                "summaryPublishedAt": now_iso(),
                "sourceRevision": bundle["record"]["revision"],
                "summaryUpdate": response,
            })
            persist_result_sync(directory, bundle, receipt)
            action["summaryAppended"] = True

        published_for_result = entry_attachment_ids(entry)
        attachment_receipts = entry.setdefault("attachments", [])
        if not isinstance(attachment_receipts, list):
            raise RecordError(f"lark-publish.json 中结果 {result_id} 的附件回执格式无效。")
        for attachment_id in result_attachment_ids(result, attachments):
            if attachment_id in published_for_result:
                continue
            attachment = attachments[attachment_id]
            if attachment_id in published_attachment_sources:
                attachment_receipts.append({
                    "attachmentId": attachment_id,
                    "storedName": attachment.get("storedName"),
                    "status": "already-published",
                    "source": published_attachment_sources[attachment_id],
                    "recordedAt": now_iso(),
                })
            else:
                response = run_json(media_command(cli, document_id, directory, attachment))
                attachment_receipts.append({
                    "attachmentId": attachment_id,
                    "storedName": attachment.get("storedName"),
                    "publishedAt": now_iso(),
                    "response": response,
                })
                published_attachment_sources[attachment_id] = "current-result-sync"
            persist_result_sync(directory, bundle, receipt)
            action["media"].append(attachment_id)

        entry["completedAt"] = now_iso()
        persist_result_sync(directory, bundle, receipt)
        actions.append(action)

    state["lastSyncedAt"] = now_iso()
    state["lastSyncedRevision"] = bundle["record"]["revision"]
    persist_result_sync(directory, bundle, receipt)
    append_audit(
        directory,
        "SYNC_LARK_RESULTS",
        bundle,
        "user",
        "将新增实验结果同步至既有飞书记录",
        {"documentId": document_id, "resultIds": [item["resultId"] for item in actions], "actions": actions},
    )
    return {"document": document, "resultSync": state, "actions": actions}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", required=True, help="record-bundle directory")
    parser.add_argument("--parent-token", default="", help="approved Drive folder or Wiki parent token")
    parser.add_argument("--cli", default="lark-cli", help="lark-cli executable")
    parser.add_argument(
        "--sync-results",
        action="store_true",
        help="append unsynchronised results and their attachments to the document in lark-publish.json",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    try:
        directory = Path(args.record).expanduser().resolve()
        bundle = load_bundle(directory)
        if args.sync_results and args.parent_token:
            raise RecordError("--sync-results 不接受 --parent-token；目标文档由现有 lark-publish.json 唯一确定。")
        receipt = load_publish_receipt(directory, bundle) if args.sync_results else None
        plan = result_sync_plan(directory, bundle, receipt, args.cli) if receipt else command_plan(directory, bundle, args.cli, args.parent_token)
        if args.dry_run:
            if receipt:
                print(json.dumps({"mode": "sync-results", **plan}, ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"mode": "publish", "recordId": bundle["record"]["id"], "revision": bundle["record"]["revision"], "parentTokenProvided": bool(args.parent_token), "attachmentCount": len(bundle.get("attachments", [])), "commands": plan}, ensure_ascii=False, indent=2))
            return
        if shutil.which(args.cli) is None:
            raise RecordError("找不到 lark-cli。请按 references/feishu-delivery.md 安装并完成授权。")
        if receipt:
            result = execute_result_sync(directory, bundle, receipt, args.cli)
            print(json.dumps({"mode": "sync-results", "recordId": bundle["record"]["id"], "revision": bundle["record"]["revision"], "result": result}, ensure_ascii=False, indent=2))
            return
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
