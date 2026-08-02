#!/usr/bin/env python3
"""Create revisioned, file-based experimental record bundles.

This utility intentionally preserves original attachments and writes an audit
event for every supported mutation. It is not an electronic-record compliance
system and does not replace an institution's ELN, LIMS, or SOP controls.
"""

from __future__ import annotations

import argparse
from difflib import SequenceMatcher
import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "1.0"
TERMINAL_STATUSES = {"ATTESTED", "REVIEWED"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
PLACEHOLDER_MARKERS = ("user-to-confirm", "must replace", "to be confirmed", "todo", "tbd")
PLATFORM_ATTRIBUTION_PATTERN = re.compile(
    r"(?:dorlabaemon(?:\.era\.ac\.cn)?|dorlabaemon\s+inventory\s+mcp)", re.IGNORECASE
)
PLATFORM_NAME_COMPACT = "dorlabaemon"
TEXT_ATTACHMENT_SUFFIXES = {".txt", ".csv", ".tsv", ".json", ".md", ".log", ".xml", ".html", ".htm"}
MAX_SCANNABLE_TEXT_BYTES = 8 * 1024 * 1024


class RecordError(ValueError):
    """An actionable error caused by a record or command input."""


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def text(value: Any, missing: str = "未提供") -> str:
    if value is None:
        return missing
    value = str(value).strip()
    return value if value else missing


def contains_platform_attribution(value: str) -> bool:
    """Recognize the service name, including a small OCR spelling error."""
    if PLATFORM_ATTRIBUTION_PATTERN.search(value):
        return True
    normalized = "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if not unicodedata.combining(character)
    )
    for token in re.findall(r"[a-z]{6,}", normalized):
        if SequenceMatcher(None, token, PLATFORM_NAME_COMPACT).ratio() >= 0.84:
            return True
    return False


def assert_no_platform_attribution(value: Any, location: str = "record") -> None:
    """Keep service names out of every file that constitutes a record bundle.

    Inventory-service provenance is retained by the service's access logs.  A
    scientific record identifies a reagent by manufacturer and catalogue
    number, rather than by the system used to look it up.
    """
    if isinstance(value, dict):
        for key, item in value.items():
            assert_no_platform_attribution(item, f"{location}.{key}")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            assert_no_platform_attribution(item, f"{location}[{index}]")
        return
    if isinstance(value, str) and contains_platform_attribution(value):
        raise RecordError(
            f"实验记录不能包含库存平台名称（位置：{location}）。"
            "请仅保留试剂厂家、货号和实际实验事实。"
        )


def assert_safe_attachment_content(source: Path) -> None:
    """Reject platform attribution embedded in an image or text attachment.

    Attachments are part of the record bundle.  Their content is retained
    unchanged when it is accepted, so rejecting a forbidden attribution before
    copying is the only way to preserve both the user's file and the record
    boundary.
    """
    suffix = source.suffix.lower()
    if suffix in TEXT_ATTACHMENT_SUFFIXES:
        if source.stat().st_size > MAX_SCANNABLE_TEXT_BYTES:
            raise RecordError(f"文本附件超过 {MAX_SCANNABLE_TEXT_BYTES // (1024 * 1024)} MiB，不能完成平台名称检查: {source.name}")
        try:
            contents = source.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise RecordError(f"文本附件必须是 UTF-8，不能完成平台名称检查: {source.name}") from error
        assert_no_platform_attribution(contents, f"attachment content: {source.name}")
        return
    if suffix in IMAGE_SUFFIXES:
        tesseract = shutil.which("tesseract")
        if not tesseract:
            raise RecordError("添加图片附件前需要安装可用的 tesseract OCR，以检查图片中是否包含库存平台名称。")
        try:
            result = subprocess.run(
                [tesseract, str(source), "stdout", "-l", "eng"],
                text=True,
                capture_output=True,
                check=False,
                timeout=30,
            )
        except subprocess.TimeoutExpired as error:
            raise RecordError(f"图片 OCR 检查超时，未加入记录: {source.name}") from error
        if result.returncode != 0:
            detail = result.stderr.strip() or "unknown OCR error"
            raise RecordError(f"图片 OCR 检查失败，未加入记录: {source.name} ({detail})")
        assert_no_platform_attribution(result.stdout, f"image OCR: {source.name}")
        return
    raise RecordError("结果附件仅支持图片或 UTF-8 文本文件，以便完成实验记录的平台名称检查。")


def markdown(value: Any) -> str:
    return text(value).replace("|", "\\|").replace("\n", "<br>")


def json_read(path: Path) -> dict[str, Any]:
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise RecordError(f"无法读取 {path}: {error}") from error
    except json.JSONDecodeError as error:
        raise RecordError(f"{path} 不是有效 JSON: {error}") from error
    if not isinstance(result, dict):
        raise RecordError(f"{path} 的顶层必须是 JSON 对象")
    return result


def json_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_filename(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return name or "attachment"


def record_path(directory: Path) -> Path:
    path = directory / "record.json"
    if not path.is_file():
        raise RecordError(f"未找到记录文件: {path}")
    return path


def load_bundle(directory: Path) -> dict[str, Any]:
    bundle = json_read(record_path(directory))
    if bundle.get("schemaVersion") != SCHEMA_VERSION or not isinstance(bundle.get("record"), dict):
        raise RecordError("记录格式不受此版本脚本支持")
    bundle.setdefault("attachments", [])
    bundle["attachments"] = as_list(bundle["attachments"])
    assert_no_platform_attribution(bundle, "record bundle")
    return bundle


def normalized_record(source: dict[str, Any], layout: str, source_path: Path) -> dict[str, Any]:
    assert_no_platform_attribution(source, "input")
    title = str(source.get("title", "")).strip()
    if not title:
        raise RecordError("输入 JSON 必须提供 title")

    day = datetime.now().astimezone().strftime("%Y%m%d")
    identifier = str(source.get("recordId", "")).strip() or f"ER-{day}-{uuid.uuid4().hex[:8].upper()}"
    return {
        "id": identifier,
        "revision": 1,
        "status": "DRAFT",
        "layout": layout,
        "title": title,
        "performedAt": source.get("performedAt", ""),
        "performedBy": as_list(source.get("performedBy")),
        "project": source.get("project", ""),
        "objective": source.get("objective", ""),
        "technique": source.get("technique") if isinstance(source.get("technique"), dict) else {},
        "protocol": source.get("protocol") if isinstance(source.get("protocol"), dict) else {},
        "samples": as_list(source.get("samples")),
        "reagents": as_list(source.get("reagents")),
        "instruments": as_list(source.get("instruments")),
        "software": as_list(source.get("software")),
        "plannedSteps": as_list(source.get("plannedSteps")),
        "actualSteps": as_list(source.get("actualSteps")),
        "controls": as_list(source.get("controls")),
        "deviations": as_list(source.get("deviations")),
        "observations": as_list(source.get("observations")),
        "results": [],
        "conclusion": source.get("conclusion", ""),
        "nextSteps": source.get("nextSteps", ""),
        "ethicsReference": source.get("ethicsReference", ""),
        "sourceNotes": source.get("sourceNotes", ""),
        "createdAt": now_iso(),
        "inputSnapshot": {
            "sha256": sha256(source_path),
            "capturedAt": now_iso(),
        },
    }


def sparse_template_path() -> Path:
    return Path(__file__).resolve().parent.parent / "assets" / "standard-draft-templates.json"


def load_sparse_template(experiment: str) -> dict[str, Any]:
    templates = as_list(json_read(sparse_template_path()).get("templates"))
    requested = experiment.strip().casefold()
    for template in templates:
        if not isinstance(template, dict):
            continue
        names = [template.get("code"), template.get("name"), *as_list(template.get("aliases"))]
        if requested in {str(name).strip().casefold() for name in names if name}:
            return template
    raise RecordError(f"未找到实验类型 {experiment!r} 的标准草稿模板。请使用精确代码或在 assets/standard-draft-templates.json 中扩展模板。")


def sparse_draft_input(template: dict[str, Any], scenario: str, targets: list[str], reported_as: str) -> dict[str, Any]:
    technique_name = text(template.get("name"), "未提供")
    clean_targets = [target.strip() for target in targets if target.strip()]
    target_reagents = [
        {
            "name": f"{target} 对应一抗（厂家、货号待补充）" if reported_as == "reported" else f"{target} 检测目标（对应一抗待确认）",
            "vendor": "",
            "catalogNo": "",
            "lotNo": "",
            "expiryDate": "",
            "amount": "",
            "concentration": "",
        }
        for target in clean_targets
    ]
    actual_steps: list[dict[str, Any]] = []
    if reported_as == "reported":
        for sequence, action in enumerate(as_list(template.get("reportedSteps")), start=1):
            action_text = text(action)
            if sequence == 3 and clean_targets:
                action_text = f"使用 {'、'.join(clean_targets)} 对应一抗孵育膜，洗膜后加入匹配二抗。"
            actual_steps.append({
                "sequence": sequence,
                "startedAt": "",
                "endedAt": "",
                "action": action_text,
                "parameters": [],
                "performedBy": "",
                "draftedFromStandardWorkflow": True,
            })
    checklist = [text(item) for item in as_list(template.get("requiredChecklist"))]
    planned_steps = [text(item) for item in as_list(template.get("plannedSteps"))] if reported_as == "planned" else []
    if checklist and reported_as == "planned":
        planned_steps.append("开始前核对所需资源：" + "；".join(checklist) + "。")
    return {
        "title": f"{technique_name}：{scenario}",
        "performedAt": "",
        "performedBy": [],
        "project": "",
        "objective": scenario,
        "technique": {
            "code": template.get("code", ""),
            "name": technique_name,
            "revision": template.get("revision", ""),
        },
        "protocol": {
            "title": template.get("protocolTitle", f"{technique_name} standard draft checklist"),
            "version": template.get("revision", ""),
            "url": "",
        },
        "samples": [],
        "reagents": target_reagents,
        "instruments": [],
        "software": [],
        "plannedSteps": planned_steps,
        "actualSteps": actual_steps,
        "controls": [],
        "deviations": [],
        "observations": [],
        "conclusion": "",
        "nextSteps": "补充实际执行人、时间、关键参数、试剂实际使用信息和结果后再进行证明。",
        "ethicsReference": "",
        "sourceNotes": (
            "研究者报告实验已完成；本记录的常规实际步骤由标准工作流起草，提交证明前需由研究者核对并按实际情况修改。"
            if reported_as == "reported"
            else "本草稿的标准流程仅作待确认的计划和记录清单，不代表这些步骤已实际完成。"
        ),
    }


def markdown_table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    output = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        output.append("| " + " | ".join(markdown(cell) for cell in row) + " |")
    return output


def parameters(step: dict[str, Any]) -> str:
    values: list[str] = []
    for parameter in as_list(step.get("parameters")):
        if isinstance(parameter, dict):
            values.append(f"{text(parameter.get('name'))}={text(parameter.get('value'))}{text(parameter.get('unit'), '')}")
        else:
            values.append(text(parameter))
    return "; ".join(values) if values else "未提供"


def attachment_link(attachment: dict[str, Any]) -> str:
    filename = str(attachment.get("storedName", ""))
    relative = f"attachments/{filename}"
    if Path(filename).suffix.lower() in IMAGE_SUFFIXES:
        return f"![{filename}]({relative})"
    return f"[{filename}]({relative})"


def render_narrative_markdown(bundle: dict[str, Any]) -> str:
    """Render a compact factual note while retaining the fields that identify evidence."""
    record = bundle["record"]
    lines = [f"# 实验记录：{record['title']}", ""]
    performers = ", ".join(text(item, "") for item in as_list(record.get("performedBy"))) or "未提供"
    lines.extend([
        f"记录 ID：{record.get('id')}；修订：{record.get('revision')}；状态：{record.get('status')}。",
        f"实际执行时间：{text(record.get('performedAt'))}；执行者：{performers}。",
        "",
        f"目的：{text(record.get('objective'))}",
        "",
        "## 实际执行",
        "",
    ])
    actual = [item if isinstance(item, dict) else {"action": item} for item in as_list(record.get("actualSteps"))]
    for item in actual:
        lines.append(f"{text(item.get('sequence'))}. {text(item.get('action'))}（开始：{text(item.get('startedAt'))}；结束：{text(item.get('endedAt'))}；参数：{parameters(item)}）")
    if not actual:
        lines.append("未提供实际执行步骤。")
    results = [item for item in as_list(record.get("results")) if isinstance(item, dict)]
    lines.extend(["", "## 观察与结果", ""])
    for observation in as_list(record.get("observations")):
        lines.append(f"- {text(observation)}")
    for result in results:
        lines.append(f"- {text(result.get('observedAt'))}：{text(result.get('summary'))}")
    if not results and not as_list(record.get("observations")):
        lines.append("未提供观察或结果。")
    reagents = [item if isinstance(item, dict) else {"name": item} for item in as_list(record.get("reagents"))]
    if reagents:
        lines.extend(["", "## 关键试剂实际使用快照", ""])
        lines.extend(markdown_table(["名称", "货号", "批号", "用量"], [[item.get("name"), item.get("catalogNo"), item.get("lotNo"), f"{text(item.get('amount'), '')} {text(item.get('unit'), '')}".strip()] for item in reagents]))
    attachments = [item for item in bundle.get("attachments", []) if isinstance(item, dict)]
    if attachments:
        lines.extend(["", "## 原始附件", ""])
        lines.extend(markdown_table(["附件", "SHA-256", "加入时间"], [[attachment_link(item), item.get("sha256"), item.get("addedAt")] for item in attachments]))
    lines.extend(["", f"结论：{text(record.get('conclusion'))}", "", f"下一步：{text(record.get('nextSteps'))}", "", "本记录只陈述已提供或已确认的信息。"])
    return "\n".join(lines) + "\n"


def render_markdown(bundle: dict[str, Any]) -> str:
    record = bundle["record"]
    if record.get("layout") == "narrative":
        return render_narrative_markdown(bundle)
    attachments = {item.get("id"): item for item in bundle.get("attachments", []) if isinstance(item, dict)}
    lines = [f"# 实验记录：{record['title']}", ""]
    lines.extend(markdown_table(
        ["字段", "值"],
        [
            ["记录 ID", record.get("id")],
            ["修订", record.get("revision")],
            ["状态", record.get("status")],
            ["实际执行时间", record.get("performedAt")],
            ["执行者", ", ".join(text(item, "") for item in as_list(record.get("performedBy")))],
            ["项目", record.get("project")],
            ["创建时间", record.get("createdAt")],
        ],
    ))
    lines.extend(["", "## 目的", "", text(record.get("objective")), ""])

    technique = record.get("technique", {})
    protocol = record.get("protocol", {})
    lines.extend(["## 技术与方案", ""])
    lines.extend(markdown_table(
        ["字段", "值"],
        [
            ["技术代码", technique.get("code")],
            ["技术名称", technique.get("name")],
            ["技术修订", technique.get("revision")],
            ["方案", protocol.get("title")],
            ["方案版本", protocol.get("version")],
            ["方案链接", protocol.get("url")],
        ],
    ))

    samples = [item if isinstance(item, dict) else {"id": item} for item in as_list(record.get("samples"))]
    lines.extend(["", "## 样本与输入", ""])
    if samples:
        lines.extend(markdown_table(
            ["样本 ID", "描述", "来源"],
            [[item.get("id"), item.get("description"), item.get("source")] for item in samples],
        ))
    else:
        lines.append("未提供样本信息。")

    reagents = [item if isinstance(item, dict) else {"name": item} for item in as_list(record.get("reagents"))]
    lines.extend(["", "### 试剂实际使用快照", ""])
    if reagents:
        lines.extend(markdown_table(
            ["名称", "厂家", "货号", "批号", "有效期", "用量", "浓度"],
            [[
                item.get("name"), item.get("vendor"), item.get("catalogNo"), item.get("lotNo"),
                item.get("expiryDate"), f"{text(item.get('amount'), '')} {text(item.get('unit'), '')}".strip(),
                item.get("concentration"),
            ] for item in reagents],
        ))
    else:
        lines.append("未提供试剂实际使用信息。")

    instruments = [item if isinstance(item, dict) else {"name": item} for item in as_list(record.get("instruments"))]
    lines.extend(["", "### 仪器与软件", ""])
    rows = [[item.get("name"), item.get("id"), item.get("configuration"), item.get("calibrationStatus")] for item in instruments]
    if rows:
        lines.extend(markdown_table(["仪器", "ID", "关键配置", "校准/维护状态"], rows))
    else:
        lines.append("未提供仪器信息。")
    software = [item if isinstance(item, dict) else {"name": item} for item in as_list(record.get("software"))]
    if software:
        lines.extend([""] + markdown_table(["软件", "版本", "用途"], [[item.get("name"), item.get("version"), item.get("purpose")] for item in software]))

    planned = as_list(record.get("plannedSteps"))
    lines.extend(["", "## 计划步骤", ""])
    lines.extend([f"{index}. {text(step)}" for index, step in enumerate(planned, start=1)] or ["未提供计划步骤。"])

    actual = [item if isinstance(item, dict) else {"action": item} for item in as_list(record.get("actualSteps"))]
    lines.extend(["", "## 实际执行", ""])
    if actual:
        lines.extend(markdown_table(
            ["序号", "开始", "结束", "实际操作", "关键参数", "执行者"],
            [[item.get("sequence"), item.get("startedAt"), item.get("endedAt"), item.get("action"), parameters(item), item.get("performedBy")] for item in actual],
        ))
    else:
        lines.append("未提供实际执行步骤。")

    controls = [item if isinstance(item, dict) else {"name": item} for item in as_list(record.get("controls"))]
    lines.extend(["", "## 对照与质量控制", ""])
    if controls:
        lines.extend(markdown_table(["对照/质控", "预设判据", "实际结果", "状态"], [[item.get("name"), item.get("expected"), item.get("observed"), item.get("status")] for item in controls]))
    else:
        lines.append("未提供对照或质量控制记录。")

    deviations = [item if isinstance(item, dict) else {"description": item} for item in as_list(record.get("deviations"))]
    lines.extend(["", "## 偏差与异常", ""])
    if deviations:
        lines.extend(markdown_table(["发生时间", "描述", "原因", "影响", "处置", "确认人"], [[item.get("occurredAt"), item.get("description"), item.get("cause"), item.get("impact"), item.get("action"), item.get("confirmedBy")] for item in deviations]))
    else:
        lines.append("未报告偏差或异常。")

    observations = as_list(record.get("observations"))
    lines.extend(["", "## 观察", ""])
    lines.extend([f"- {text(item)}" for item in observations] or ["未提供观察。"])

    results = [item for item in as_list(record.get("results")) if isinstance(item, dict)]
    lines.extend(["", "## 结果与原始附件", ""])
    if results:
        lines.extend(markdown_table(["结果 ID", "观察时间", "摘要", "记录人"], [[item.get("id"), item.get("observedAt"), item.get("summary"), item.get("addedBy")] for item in results]))
        for result in results:
            links = [attachment_link(attachments[attachment_id]) for attachment_id in as_list(result.get("attachmentIds")) if attachment_id in attachments]
            if links:
                lines.extend(["", f"附件（{result.get('id')}）：", "", *links])
    else:
        lines.append("未提供结果。")

    all_attachments = [item for item in bundle.get("attachments", []) if isinstance(item, dict)]
    if all_attachments:
        lines.extend(["", "### 附件清单", ""])
        lines.extend(markdown_table(["附件 ID", "原始文件名", "类型", "SHA-256", "加入时间"], [[item.get("id"), item.get("originalName"), item.get("kind"), item.get("sha256"), item.get("addedAt")] for item in all_attachments]))

    lines.extend(["", "## 结论与后续", "", f"结论：{text(record.get('conclusion'))}", "", f"下一步：{text(record.get('nextSteps'))}"])
    if text(record.get("ethicsReference")) != "未提供":
        lines.extend(["", f"伦理/审批引用：{text(record.get('ethicsReference'))}"])
    if text(record.get("sourceNotes")) != "未提供":
        lines.extend(["", f"来源备注：{text(record.get('sourceNotes'))}"])
    lines.extend(["", "## 完整性说明", "", "本记录只陈述已提供或已确认的信息。`未提供` 字段需要在后续修订中补充，不应由模型或模板推断。"])
    return "\n".join(lines) + "\n"


def write_markdown_exports(directory: Path, bundle: dict[str, Any]) -> list[dict[str, Any]]:
    revision = int(bundle["record"]["revision"])
    markdown_content = render_markdown(bundle)
    revision_path = directory / "exports" / f"record-r{revision:04d}.md"
    revision_path.parent.mkdir(parents=True, exist_ok=True)
    revision_path.write_text(markdown_content, encoding="utf-8")
    (directory / "record.md").write_text(markdown_content, encoding="utf-8")
    return [{"path": str(revision_path.relative_to(directory)), "sha256": sha256(revision_path), "revision": revision, "format": "md"}]


def write_manifest(directory: Path, bundle: dict[str, Any], exports: list[dict[str, Any]] | None = None) -> None:
    path = directory / "manifest.json"
    previous = json_read(path) if path.exists() else {}
    known_exports = [item for item in as_list(previous.get("exports")) if isinstance(item, dict)]
    if exports:
        known_paths = {item.get("path") for item in known_exports}
        known_exports.extend(item for item in exports if item.get("path") not in known_paths)
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "recordId": bundle["record"]["id"],
        "currentRevision": bundle["record"]["revision"],
        "updatedAt": now_iso(),
        "attachments": bundle.get("attachments", []),
        "exports": known_exports,
    }
    json_write(path, manifest)


def append_audit(directory: Path, event: str, bundle: dict[str, Any], actor: str, reason: str, details: dict[str, Any] | None = None, previous_revision: int | None = None) -> None:
    assert_no_platform_attribution(
        {"event": event, "actor": actor, "reason": reason, "details": details or {}}, "audit event"
    )
    row = {
        "eventId": uuid.uuid4().hex,
        "event": event,
        "recordId": bundle["record"]["id"],
        "revision": bundle["record"]["revision"],
        "previousRevision": previous_revision,
        "actor": actor or "未提供",
        "reason": reason or "未提供",
        "occurredAt": now_iso(),
        "details": details or {},
    }
    with (directory / "audit.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def commit_revision(directory: Path, bundle: dict[str, Any], event: str, actor: str, reason: str, details: dict[str, Any] | None, previous_revision: int | None) -> None:
    revision = int(bundle["record"]["revision"])
    json_write(directory / "record.json", bundle)
    snapshot = directory / "revisions" / f"record-r{revision:04d}.json"
    if snapshot.exists():
        raise RecordError(f"修订快照已存在: {snapshot}")
    json_write(snapshot, bundle)
    exports = write_markdown_exports(directory, bundle)
    write_manifest(directory, bundle, exports)
    append_audit(directory, event, bundle, actor, reason, details, previous_revision)


def require_timezone(timestamp: Any) -> bool:
    if not isinstance(timestamp, str) or not timestamp.strip():
        return False
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).tzinfo is not None
    except ValueError:
        return False


def contains_template_placeholder(value: Any) -> bool:
    if isinstance(value, dict):
        return any(contains_template_placeholder(item) for item in value.values())
    if isinstance(value, list):
        return any(contains_template_placeholder(item) for item in value)
    return isinstance(value, str) and any(marker in value.casefold() for marker in PLACEHOLDER_MARKERS)


def validate_bundle(
    directory: Path, bundle: dict[str, Any], *, for_terminal_status: bool = False
) -> tuple[list[str], list[str]]:
    record = bundle["record"]
    errors: list[str] = []
    warnings: list[str] = []
    for field in ("id", "title", "status", "revision"):
        if not record.get(field):
            errors.append(f"缺少记录字段: {field}")
    if record.get("status") not in {"DRAFT", "ATTESTED", "REVIEWED", "AMENDED"}:
        errors.append(f"未知记录状态: {record.get('status')}")
    if not (directory / "audit.jsonl").is_file():
        errors.append("缺少 audit.jsonl")
    for attachment in bundle.get("attachments", []):
        if not isinstance(attachment, dict):
            errors.append("附件元数据不是对象")
            continue
        path = directory / "attachments" / str(attachment.get("storedName", ""))
        if not path.is_file():
            errors.append(f"附件缺失: {attachment.get('id')}")
        elif sha256(path) != attachment.get("sha256"):
            errors.append(f"附件 SHA-256 不匹配: {attachment.get('id')}")
    if for_terminal_status or record.get("status") in TERMINAL_STATUSES:
        if not as_list(record.get("performedBy")):
            errors.append("证明/复核前必须填写执行者")
        if not require_timezone(record.get("performedAt")):
            errors.append("证明/复核前必须填写带时区的实际执行时间")
        if not str(record.get("objective", "")).strip():
            errors.append("证明/复核前必须填写实验目的")
        actual = [step for step in as_list(record.get("actualSteps")) if isinstance(step, dict) and str(step.get("action", "")).strip()]
        if not actual:
            errors.append("证明/复核前必须填写至少一个实际执行步骤")
        elif contains_template_placeholder(actual):
            errors.append("实际执行步骤仍包含模板占位语，请替换为事实记录后再证明")
    if not as_list(record.get("samples")):
        warnings.append("未记录样本；确认该技术确实不需要样本信息")
    if not as_list(record.get("reagents")):
        warnings.append("未记录试剂；确认该技术确实不需要试剂实际使用快照")
    if not as_list(record.get("instruments")):
        warnings.append("未记录仪器；确认该技术确实不需要仪器或配置")
    if not as_list(record.get("controls")):
        warnings.append("未记录对照或质量控制；确认其不适用或补充原因")
    return errors, warnings


def create_command(args: argparse.Namespace) -> None:
    source_path = Path(args.input).expanduser().resolve()
    if not source_path.is_file():
        raise RecordError(f"输入文件不存在: {source_path}")
    directory = Path(args.output_dir).expanduser().resolve()
    if directory.exists() and any(directory.iterdir()):
        raise RecordError(f"输出目录已存在且非空: {directory}")
    directory.mkdir(parents=True, exist_ok=True)
    source = json_read(source_path)
    bundle = {"schemaVersion": SCHEMA_VERSION, "record": normalized_record(source, args.layout, source_path), "attachments": []}
    commit_revision(directory, bundle, "CREATE", args.actor, "创建记录草稿", {"inputSha256": sha256(source_path)}, None)
    print(json.dumps({"record": str(directory), "recordId": bundle["record"]["id"], "revision": 1, "status": "DRAFT"}, ensure_ascii=False))


def create_sparse_draft_command(args: argparse.Namespace) -> None:
    directory = Path(args.output_dir).expanduser().resolve()
    if directory.exists() and any(directory.iterdir()):
        raise RecordError(f"输出目录已存在且非空: {directory}")
    scenario = args.scenario.strip()
    if not scenario:
        raise RecordError("稀疏输入草稿必须提供 --scenario")
    template = load_sparse_template(args.experiment)
    source = sparse_draft_input(template, scenario, args.target, args.reported_as)
    directory.mkdir(parents=True, exist_ok=True)
    bundle = {
        "schemaVersion": SCHEMA_VERSION,
        "record": normalized_record(source, args.layout, sparse_template_path()),
        "attachments": [],
    }
    commit_revision(
        directory,
        bundle,
        "CREATE_SPARSE_DRAFT",
        args.actor,
        "根据实验名称和场景创建标准流程草稿",
        {"technique": template.get("code"), "reportedAs": args.reported_as, "targetCount": len(args.target)},
        None,
    )
    print(json.dumps({
        "record": str(directory),
        "recordId": bundle["record"]["id"],
        "revision": 1,
        "status": "DRAFT",
        "template": template.get("code"),
        "reportedAs": args.reported_as,
    }, ensure_ascii=False))


def copy_attachment(directory: Path, path_value: str, kind: str) -> dict[str, Any]:
    source = Path(path_value).expanduser().resolve()
    if not source.is_file():
        raise RecordError(f"附件不存在或不是文件: {source}")
    assert_no_platform_attribution(source.name, "attachment filename")
    assert_safe_attachment_content(source)
    digest = sha256(source)
    stored_name = f"att-{digest[:12]}-{safe_filename(source.name)}"
    destination = directory / "attachments" / stored_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and sha256(destination) != digest:
        raise RecordError(f"附件目标冲突且 SHA-256 不同: {destination}")
    if not destination.exists():
        shutil.copy2(source, destination)
    return {
        "id": f"att-{uuid.uuid4().hex[:12]}",
        "originalName": source.name,
        "storedName": stored_name,
        "mimeType": mimetypes.guess_type(source.name)[0] or "application/octet-stream",
        "sizeBytes": source.stat().st_size,
        "sha256": digest,
        "kind": kind,
        "addedAt": now_iso(),
    }


def add_result_command(args: argparse.Namespace) -> None:
    directory = Path(args.record).expanduser().resolve()
    bundle = load_bundle(directory)
    record = bundle["record"]
    previous = int(record["revision"])
    if record.get("status") in TERMINAL_STATUSES and not args.reason:
        raise RecordError("向已证明或已复核记录添加结果时必须提供 --reason")
    assert_no_platform_attribution(
        {"summary": args.summary, "observedAt": args.observed_at, "actor": args.actor, "reason": args.reason},
        "result",
    )
    attachments = [copy_attachment(directory, item, "derived" if args.derived else "original") for item in args.attachment]
    bundle["attachments"].extend(attachments)
    result = {
        "id": f"result-{uuid.uuid4().hex[:12]}",
        "observedAt": args.observed_at or "未提供",
        "summary": args.summary,
        "addedBy": args.actor or "未提供",
        "addedAt": now_iso(),
        "attachmentIds": [item["id"] for item in attachments],
    }
    record.setdefault("results", []).append(result)
    record["revision"] = previous + 1
    if record.get("status") in TERMINAL_STATUSES:
        record["status"] = "AMENDED"
    commit_revision(directory, bundle, "ADD_RESULT", args.actor, args.reason or "添加实验结果", {"resultId": result["id"], "attachmentIds": result["attachmentIds"]}, previous)
    print(json.dumps({"record": str(directory), "resultId": result["id"], "revision": record["revision"], "status": record["status"]}, ensure_ascii=False))


def validate_command(args: argparse.Namespace) -> None:
    directory = Path(args.record).expanduser().resolve()
    bundle = load_bundle(directory)
    errors, warnings = validate_bundle(directory, bundle)
    print(json.dumps({"valid": not errors, "recordId": bundle["record"]["id"], "revision": bundle["record"]["revision"], "errors": errors, "warnings": warnings}, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


def attest_command(args: argparse.Namespace) -> None:
    directory = Path(args.record).expanduser().resolve()
    bundle = load_bundle(directory)
    record = bundle["record"]
    if record.get("status") not in {"DRAFT", "AMENDED"}:
        raise RecordError("只有 DRAFT 或 AMENDED 记录可以证明")
    errors, _ = validate_bundle(directory, bundle, for_terminal_status=True)
    if errors:
        raise RecordError("无法证明记录: " + "; ".join(errors))
    previous = int(record["revision"])
    record["revision"] = previous + 1
    record["status"] = "ATTESTED"
    record["attestation"] = {"by": args.actor, "at": now_iso(), "reason": args.reason}
    commit_revision(directory, bundle, "ATTEST", args.actor, args.reason, None, previous)
    print(json.dumps({"record": str(directory), "revision": record["revision"], "status": record["status"]}, ensure_ascii=False))


def review_command(args: argparse.Namespace) -> None:
    directory = Path(args.record).expanduser().resolve()
    bundle = load_bundle(directory)
    record = bundle["record"]
    if record.get("status") != "ATTESTED":
        raise RecordError("只有 ATTESTED 记录可以复核")
    errors, _ = validate_bundle(directory, bundle, for_terminal_status=True)
    if errors:
        raise RecordError("无法复核记录: " + "; ".join(errors))
    previous = int(record["revision"])
    record["revision"] = previous + 1
    record["status"] = "REVIEWED"
    record["review"] = {"by": args.actor, "at": now_iso(), "note": args.note}
    commit_revision(directory, bundle, "REVIEW", args.actor, args.note or "完成复核", None, previous)
    print(json.dumps({"record": str(directory), "revision": record["revision"], "status": record["status"]}, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create", help="create a DRAFT record bundle")
    create.add_argument("--input", required=True, help="JSON file with user-confirmed facts")
    create.add_argument("--output-dir", required=True, help="new record-bundle directory")
    create.add_argument("--layout", choices=("table", "narrative"), default="table")
    create.add_argument("--actor", default="", help="person creating the draft")
    create.set_defaults(handler=create_command)

    sparse = commands.add_parser("create-sparse-draft", help="create a DRAFT from an experiment name and a short scenario")
    sparse.add_argument("--experiment", required=True, help="exact technique code, name, or template alias")
    sparse.add_argument("--scenario", required=True, help="short user-supplied experimental context")
    sparse.add_argument("--target", action="append", default=[], help="repeat for each user-reported target or reagent")
    sparse.add_argument("--reported-as", choices=("planned", "reported"), default="reported")
    sparse.add_argument("--output-dir", required=True, help="new record-bundle directory")
    sparse.add_argument("--layout", choices=("table", "narrative"), default="table")
    sparse.add_argument("--actor", default="", help="person creating the draft")
    sparse.set_defaults(handler=create_sparse_draft_command)

    add_result = commands.add_parser("add-result", help="copy result files into an existing record")
    add_result.add_argument("--record", required=True)
    add_result.add_argument("--summary", required=True, help="factual observation or result summary")
    add_result.add_argument("--observed-at", default="")
    add_result.add_argument("--actor", default="")
    add_result.add_argument("--reason", default="")
    add_result.add_argument("--attachment", action="append", default=[], help="repeat for each image or text result")
    add_result.add_argument("--derived", action="store_true", help="mark attachments as derived, not original")
    add_result.set_defaults(handler=add_result_command)

    validate = commands.add_parser("validate", help="verify structure, statuses, and attachment hashes")
    validate.add_argument("--record", required=True)
    validate.set_defaults(handler=validate_command)

    attest = commands.add_parser("attest", help="attest a complete draft or amendment")
    attest.add_argument("--record", required=True)
    attest.add_argument("--actor", required=True)
    attest.add_argument("--reason", required=True)
    attest.set_defaults(handler=attest_command)

    review = commands.add_parser("review", help="review an attested record")
    review.add_argument("--record", required=True)
    review.add_argument("--actor", required=True)
    review.add_argument("--note", default="")
    review.set_defaults(handler=review_command)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.handler(args)
    except RecordError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
