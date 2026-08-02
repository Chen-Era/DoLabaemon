#!/usr/bin/env python3
"""Export the current experimental-record bundle as a table-oriented DOCX."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from record_bundle import RecordError, append_audit, as_list, load_bundle, now_iso, sha256, text as record_text, write_manifest

CJK_FONT = "Arial Unicode MS"


def text(value: Any, missing: str = "Not provided") -> str:
    return record_text(value, missing)

def load_docx() -> Any:
    try:
        from docx import Document
        from docx.enum.section import WD_SECTION_START
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        from docx.shared import Inches, Pt
    except ImportError as error:
        raise RecordError("缺少 python-docx。请使用带 python-docx 的 Python 运行时后重试。") from error
    return Document, WD_SECTION_START, WD_ALIGN_PARAGRAPH, OxmlElement, qn, Inches, Pt


def set_cell(cell: Any, value: Any, bold: bool = False) -> None:
    from docx.shared import Pt

    cell.text = ""
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(text(value))
    run.bold = bold
    run.font.size = Pt(9)


def add_table(document: Any, headers: list[str], rows: list[list[Any]]) -> None:
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.autofit = True
    for cell, header in zip(table.rows[0].cells, headers):
        set_cell(cell, header, bold=True)
    for row in rows:
        cells = table.add_row().cells
        for cell, value in zip(cells, row):
            set_cell(cell, value)
    document.add_paragraph()


def values(items: Any, key: str = "name") -> list[dict[str, Any]]:
    return [item if isinstance(item, dict) else {key: item} for item in as_list(items)]


def is_image(path: Path) -> bool:
    return path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


def set_east_asia_font(document: Any, oxml_element: Any, qn: Any) -> None:
    """Set a macOS/LibreOffice-compatible CJK fallback on every concrete run."""
    paragraphs = list(document.paragraphs)
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                paragraphs.extend(cell.paragraphs)
    for section in document.sections:
        paragraphs.extend(section.header.paragraphs)
        paragraphs.extend(section.footer.paragraphs)
    for paragraph in paragraphs:
        for run in paragraph.runs:
            properties = run._element.get_or_add_rPr()
            fonts = properties.rFonts
            if fonts is None:
                fonts = oxml_element("w:rFonts")
                properties.insert(0, fonts)
            run.font.name = CJK_FONT
            fonts.set(qn("w:ascii"), CJK_FONT)
            fonts.set(qn("w:hAnsi"), CJK_FONT)
            fonts.set(qn("w:eastAsia"), CJK_FONT)
            fonts.set(qn("w:cs"), CJK_FONT)
            fonts.set(qn("w:hint"), "eastAsia")
            language = properties.find(qn("w:lang"))
            if language is None:
                language = oxml_element("w:lang")
                properties.append(language)
            language.set(qn("w:val"), "zh-CN")
            language.set(qn("w:eastAsia"), "zh-CN")


def add_heading(document: Any, title: str, level: int = 1) -> None:
    # Avoid Word's themed Heading styles: LibreOffice can select a non-CJK
    # theme font for them even when a run has an East Asian fallback.
    paragraph = document.add_paragraph()
    run = paragraph.add_run(title)
    run.bold = True
    run.font.name = "Arial"


def export_document(directory: Path, output: Path) -> None:
    Document, _, WD_ALIGN_PARAGRAPH, OxmlElement, qn, Inches, Pt = load_docx()
    bundle = load_bundle(directory)
    record = bundle["record"]
    if output.exists():
        raise RecordError(f"目标 DOCX 已存在，拒绝覆盖: {output}")

    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)
    normal = document.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10)

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run("Experimental record")
    title_run.bold = True
    title_run.font.name = "Arial"
    title_run.font.size = Pt(18)
    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.add_run(text(record.get("title"))).bold = True
    document.add_paragraph()

    add_table(document, ["Field", "Value"], [
        ["Record ID", record.get("id")],
        ["Revision", record.get("revision")],
        ["Status", record.get("status")],
        ["Execution time", record.get("performedAt")],
        ["Performed by", ", ".join(text(item, "") for item in as_list(record.get("performedBy")))],
        ["Project", record.get("project")],
        ["Created at", record.get("createdAt")],
    ])

    add_heading(document, "Objective")
    document.add_paragraph(text(record.get("objective")))

    technique = record.get("technique", {})
    protocol = record.get("protocol", {})
    add_heading(document, "Technique and protocol")
    add_table(document, ["Field", "Value"], [
        ["Technique code", technique.get("code")],
        ["Technique name", technique.get("name")],
        ["Technique revision", technique.get("revision")],
        ["Protocol", protocol.get("title")],
        ["Protocol version", protocol.get("version")],
        ["Protocol URL", protocol.get("url")],
    ])

    add_heading(document, "Samples and inputs")
    samples = values(record.get("samples"), "id")
    if samples:
        add_table(document, ["Sample ID", "Description", "Source"], [[item.get("id"), item.get("description"), item.get("source")] for item in samples])
    else:
        document.add_paragraph("No sample information was provided.")
    add_heading(document, "Reagent-use snapshot", level=2)
    reagents = values(record.get("reagents"))
    if reagents:
        add_table(document, ["Name", "Manufacturer", "Catalog no.", "Lot no.", "Expiry", "Amount", "Concentration"], [[
            item.get("name"), item.get("vendor"), item.get("catalogNo"), item.get("lotNo"), item.get("expiryDate"),
            f"{text(item.get('amount'), '')} {text(item.get('unit'), '')}".strip(), item.get("concentration"),
        ] for item in reagents])
    else:
        document.add_paragraph("No actual reagent-use information was provided.")

    add_heading(document, "Instruments and software", level=2)
    instruments = values(record.get("instruments"))
    if instruments:
        add_table(document, ["Instrument", "ID", "Key configuration", "Calibration/maintenance status"], [[item.get("name"), item.get("id"), item.get("configuration"), item.get("calibrationStatus")] for item in instruments])
    else:
        document.add_paragraph("No instrument information was provided.")
    software = values(record.get("software"))
    if software:
        add_table(document, ["Software", "Version", "Purpose"], [[item.get("name"), item.get("version"), item.get("purpose")] for item in software])

    add_heading(document, "Planned steps")
    planned_steps = as_list(record.get("plannedSteps"))
    if planned_steps:
        for item in planned_steps:
            document.add_paragraph(text(item), style="List Number")
    else:
        document.add_paragraph("No planned steps were provided.")

    add_heading(document, "Actual execution")
    actual_steps = values(record.get("actualSteps"), "action")
    if actual_steps:
        rows = []
        for item in actual_steps:
            parameters = []
            for parameter in as_list(item.get("parameters")):
                if isinstance(parameter, dict):
                    parameters.append(f"{text(parameter.get('name'))}={text(parameter.get('value'))}{text(parameter.get('unit'), '')}")
                else:
                    parameters.append(text(parameter))
            rows.append([item.get("sequence"), item.get("startedAt"), item.get("endedAt"), item.get("action"), "; ".join(parameters), item.get("performedBy")])
        add_table(document, ["No.", "Started", "Ended", "Actual action", "Key parameters", "Performed by"], rows)
    else:
        document.add_paragraph("No actual execution steps were provided.")

    add_heading(document, "Controls and quality control")
    controls = values(record.get("controls"))
    if controls:
        add_table(document, ["Control/QC", "Predefined criterion", "Observed result", "Status"], [[item.get("name"), item.get("expected"), item.get("observed"), item.get("status")] for item in controls])
    else:
        document.add_paragraph("No control or quality-control record was provided.")

    add_heading(document, "Deviations and anomalies")
    deviations = values(record.get("deviations"), "description")
    if deviations:
        add_table(document, ["Occurred at", "Description", "Cause", "Impact", "Action", "Confirmed by"], [[item.get("occurredAt"), item.get("description"), item.get("cause"), item.get("impact"), item.get("action"), item.get("confirmedBy")] for item in deviations])
    else:
        document.add_paragraph("No deviations or anomalies were reported.")

    add_heading(document, "Observations and results")
    observations = as_list(record.get("observations"))
    for observation in observations:
        document.add_paragraph(text(observation), style="List Bullet")
    results = [item for item in as_list(record.get("results")) if isinstance(item, dict)]
    if results:
        add_table(document, ["Result ID", "Observed at", "Summary", "Recorded by"], [[item.get("id"), item.get("observedAt"), item.get("summary"), item.get("addedBy")] for item in results])
    elif not observations:
        document.add_paragraph("No observations or results were provided.")

    attachments = {item.get("id"): item for item in bundle.get("attachments", []) if isinstance(item, dict)}
    if attachments:
        add_heading(document, "Original attachments")
        for attachment in attachments.values():
            source = directory / "attachments" / str(attachment.get("storedName", ""))
            document.add_paragraph(f"{attachment.get('id')}: {attachment.get('originalName')} | SHA-256: {attachment.get('sha256')}")
            if source.is_file() and is_image(source):
                try:
                    document.add_picture(str(source), width=Inches(5.8))
                    caption = document.add_paragraph(f"Figure: {attachment.get('originalName')}")
                    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
                except Exception as error:  # python-docx supports only a subset of image encodings
                    document.add_paragraph(f"Image was not embedded. See the original attachment: {error}")

    add_heading(document, "Conclusion and next steps")
    document.add_paragraph("Conclusion: " + text(record.get("conclusion")))
    document.add_paragraph("Next steps: " + text(record.get("nextSteps")))
    document.add_paragraph("This export is a snapshot of the record ID and revision. Use local revisions/ and audit.jsonl to trace history.")

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run(f"{record.get('id')} | revision {record.get('revision')} | exported {now_iso()}")
    set_east_asia_font(document, OxmlElement, qn)
    output.parent.mkdir(parents=True, exist_ok=True)
    document.save(output)

    export = {"path": str(output.relative_to(directory)), "sha256": sha256(output), "revision": record["revision"], "format": "docx"}
    write_manifest(directory, bundle, [export])
    append_audit(directory, "EXPORT_DOCX", bundle, "未提供", "导出 DOCX 快照", {"path": export["path"], "sha256": export["sha256"]})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", required=True, help="record-bundle directory")
    parser.add_argument("--out", help="optional DOCX output path inside the record directory")
    args = parser.parse_args()
    try:
        directory = Path(args.record).expanduser().resolve()
        bundle = load_bundle(directory)
        revision = int(bundle["record"]["revision"])
        output = Path(args.out).expanduser().resolve() if args.out else directory / "exports" / f"record-r{revision:04d}.docx"
        try:
            output.relative_to(directory)
        except ValueError as error:
            raise RecordError("DOCX 输出必须位于记录目录内") from error
        export_document(directory, output)
        print(output)
    except RecordError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
