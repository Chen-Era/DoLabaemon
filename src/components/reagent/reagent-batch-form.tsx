"use client";

import { ClipboardEvent, useMemo, useState } from "react";
import { UploadIcon } from "@/components/common/app-icons";
import { isRequestTimeoutError, requestJson } from "@/lib/http";
import { reagentCategoryLabel } from "@/lib/reagent-category";

type ParsedReagent = {
  category: "ANTIBODY" | "BUFFER" | "KIT" | "PRIMER" | "BIOLOGICAL" | "CHEMICAL" | "CONSUMABLE" | "OTHER";
  subCategory?: string | null;
  vendor?: string | null;
  confidence?: number;
  warnings?: string[];
  experimentTags?: string[];
  verification?: {
    status?: "verified" | "unverified";
    method?: "native_web_search" | "external_search" | "knowledge_base" | "none";
    reason?:
      | "verified"
      | "knowledge_base_hit"
      | "native_tool_unavailable"
      | "native_search_no_sources"
      | "external_search_unconfigured"
      | "external_search_failed"
      | "external_search_no_results"
      | "verification_model_failed"
      | "fallback_used";
    warnings?: string[];
  };
  antibodyMeta?: {
    role?: "PRIMARY" | "SECONDARY" | null;
    hostSpecies?: string | null;
    targetSpecies?: string | null;
    targetName?: string | null;
  } | null;
  primerMeta?: {
    targetName?: string | null;
    isReferenceGene?: boolean | null;
  } | null;
};

type RawBatchInput = {
  name: string;
  vendor?: string | null;
  catalogNo?: string | null;
  note?: string | null;
  antibodyCompatibilityText?: string | null;
  sourceText?: string | null;
};

type BatchParseItem = {
  rowId: string;
  draftId?: string;
  rawInput: RawBatchInput;
  parsed?: ParsedReagent;
  parseSource?: "llm" | "fallback";
  verificationStatus?: "verified" | "unverified";
  verificationMethod?: "native_web_search" | "external_search" | "knowledge_base" | "none";
  verificationReason?: ParsedReagent["verification"] extends infer V ? V extends { reason?: infer R } ? R : never : never;
  error?: string;
};

type ConfirmResult =
  | {
      action: "created";
      reagentId: string;
    }
  | {
      action: "incremented";
      reagentId: string;
      beforeQuantity: number;
      afterQuantity: number;
    };

type BatchConfirmResult =
  | {
      ok: true;
      draftId: string;
      result: ConfirmResult;
    }
  | {
      ok: false;
      draftId?: string;
      error: string;
    };

type BatchRow = BatchParseItem & {
  selected: boolean;
  status: "ready" | "confirmed" | "failed";
  confirmResult?: ConfirmResult;
};

function joinText(parts: Array<string | null | undefined>) {
  const cleaned = parts.map((part) => part?.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(" | ") : undefined;
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = out.split(",", 2);
      if (!base64) {
        reject(new Error("EMPTY_IMAGE"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function buildEditedPayload(row: BatchRow, labId: string) {
  if (!row.parsed || !row.draftId) return null;
  return {
    draftId: row.draftId,
    editedPayload: {
      labId,
      name: row.rawInput.name,
      catalogNo: row.rawInput.catalogNo ?? "",
      note: joinText([row.rawInput.note, row.rawInput.antibodyCompatibilityText]),
      category: row.parsed.category,
      subCategory: row.parsed.subCategory,
      vendor: row.parsed.vendor ?? row.rawInput.vendor ?? null,
      experimentTags: row.parsed.experimentTags ?? [],
      antibodyMeta: row.parsed.antibodyMeta,
      primerMeta: row.parsed.primerMeta,
    },
  };
}

function buildSuccessMessage(createdCount: number, incrementedCount: number, failedCount: number) {
  const parts = [`新增 ${createdCount} 条`, `补货 ${incrementedCount} 条`, `失败 ${failedCount} 条`];
  return parts.join("，");
}

function verificationReasonLabel(reason: BatchParseItem["verificationReason"]) {
  switch (reason) {
    case "verified":
      return "联网检索与纠错已生效";
    case "knowledge_base_hit":
      return "知识库高置信命中，已跳过联网验证";
    case "external_search_unconfigured":
      return "未配置联网搜索";
    case "external_search_failed":
      return "外部搜索请求失败";
    case "external_search_no_results":
      return "未找到可用外部证据";
    case "native_search_no_sources":
      return "原生联网未返回来源";
    case "verification_model_failed":
      return "纠错模型输出失败，保留初稿";
    case "fallback_used":
      return "已退回规则兜底";
    case "native_tool_unavailable":
      return "当前模型不支持原生联网";
    default:
      return null;
  }
}

function rowStatusPill(row: BatchRow) {
  if (row.status === "confirmed") return <span className="status-pill success">已入库</span>;
  if (row.status === "failed") return <span className="status-pill danger">失败</span>;
  return <span className="status-pill">待确认</span>;
}

export function ReagentBatchForm({ labId }: { labId: string }) {
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [extractingImage, setExtractingImage] = useState(false);

  const readyRows = useMemo(() => rows.filter((row) => row.status === "ready" && row.draftId && row.parsed), [rows]);
  const selectedReadyRows = useMemo(() => readyRows.filter((row) => row.selected), [readyRows]);
  const allReadySelected = readyRows.length > 0 && selectedReadyRows.length === readyRows.length;
  const someReadySelected = selectedReadyRows.length > 0 && !allReadySelected;

  function toggleSelectAllReady() {
    setRows((prev) => prev.map((row) => (row.status === "ready" ? { ...row, selected: !allReadySelected } : row)));
  }

  async function onParseBatch() {
    if (!rawText.trim()) {
      setMsg("请先粘贴批量试剂文本");
      return;
    }
    setParsing(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<{ items?: BatchParseItem[]; error?: string }>("/api/reagents/batch-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, rawText, lang: "zh" }),
        timeoutMs: 120000,
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "批量识别失败");
        return;
      }
      const nextRows =
        data?.items?.map((item) => ({
          ...item,
          selected: !!item.draftId && !!item.parsed && !item.error,
          status: item.error ? ("failed" as const) : ("ready" as const),
        })) ?? [];
      setRows(nextRows);
      const failedCount = nextRows.filter((row) => row.status === "failed").length;
      setMsg(`已生成 ${nextRows.length} 条候选结果${failedCount ? `，其中 ${failedCount} 条需要手工检查` : ""}`);
    } catch (error) {
      setMsg(isRequestTimeoutError(error) ? "批量识别超时，请缩小批次或检查模型/搜索配置后重试" : "网络异常，请稍后重试");
    } finally {
      setParsing(false);
    }
  }

  async function extractImage(file: File) {
    setExtractingImage(true);
    setMsg(null);
    try {
      const imageBase64 = await toBase64(file);
      const { response, data } = await requestJson<{ text?: string; error?: string }>("/api/reagents/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          imageBase64,
          mimeType: file.type || "image/png",
          lang: "zh",
        }),
        timeoutMs: 90000,
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "图片转文字失败");
        return;
      }
      const extractedText = data?.text?.trim();
      if (!extractedText) {
        setMsg("图片中未提取到可用文字");
        return;
      }
      setRawText((prev) => (prev.trim() ? `${prev.trim()}\n\n${extractedText}` : extractedText));
      setMsg("图片内容已转成文本并追加到批量输入框");
    } catch (error) {
      setMsg(isRequestTimeoutError(error) ? "图片转文字超时，请稍后重试" : "图片读取或上传失败");
    } finally {
      setExtractingImage(false);
    }
  }

  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) {
      setMsg("未能读取剪贴板图片");
      return;
    }
    await extractImage(file);
  }

  async function onConfirm(scope: "selected" | "all") {
    const candidates = (scope === "selected" ? selectedReadyRows : readyRows)
      .map((row) => buildEditedPayload(row, labId))
      .filter((item): item is NonNullable<typeof item> => !!item);

    if (!candidates.length) {
      setMsg(scope === "selected" ? "请先选择要入库的试剂" : "当前没有可确认入库的试剂");
      return;
    }

    setConfirming(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<{
        createdCount?: number;
        incrementedCount?: number;
        failedCount?: number;
        results?: BatchConfirmResult[];
        error?: string;
      }>("/api/reagents/batch-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: candidates }),
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "批量确认失败");
        return;
      }

      const resultMap = new Map<string, BatchConfirmResult>();
      for (const item of data?.results ?? []) {
        if (item.draftId) {
          resultMap.set(item.draftId, item);
        }
      }

      setRows((prev) =>
        prev.map((row) => {
          if (!row.draftId) return row;
          const matched = resultMap.get(row.draftId);
          if (!matched) return row;
          if (!matched.ok) {
            return { ...row, status: "failed", error: matched.error, selected: false };
          }
          return {
            ...row,
            status: "confirmed",
            selected: false,
            confirmResult: matched.result,
          };
        }),
      );

      setMsg(buildSuccessMessage(data?.createdCount ?? 0, data?.incrementedCount ?? 0, data?.failedCount ?? 0));
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className="app-panel px-5 py-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">批量识别</h3>
        <p className="section-copy mt-1 text-sm">粘贴表格文本或上传图片，识别后统一核对。</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="reagent-batch-input">
            批量原始信息
          </label>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
            <textarea
              id="reagent-batch-input"
              className="input-base min-h-48 resize-y"
              placeholder={"示例：\nRabbit anti-LC3B\tCST\t2775S\tWB 1:1000, IF 1:200\nGoat anti-rabbit IgG Alexa 488\tInvitrogen\tA-11008\tIF secondary"}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onPaste={onPaste}
            />
            <label
              htmlFor="reagent-batch-image"
              className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                extractingImage
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line-strong)] bg-[var(--bg-muted)] hover:border-[var(--text-faint)]"
              }`}
            >
              <UploadIcon className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{extractingImage ? "图片转文字中..." : "点击选择图片"}</span>
              <span className="text-xs leading-5 text-slate-400">支持截图、照片；也可以直接在文本框中粘贴图片</span>
              <input
                id="reagent-batch-image"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={extractingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void extractImage(file);
                }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="glass-badge">支持表格文本</span>
            <span className="glass-badge">支持图片转文字</span>
            {extractingImage ? <span className="status-pill">图片转文字中...</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onParseBatch} className="button-primary" disabled={parsing || extractingImage}>
            {parsing ? "批量识别中..." : "批量识别"}
          </button>
          <p className="field-hint">识别完成后可在下方逐条核对，再统一确认入库。</p>
        </div>

        {rows.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={allReadySelected}
                  disabled={!readyRows.length}
                  onChange={toggleSelectAllReady}
                  ref={(el) => {
                    if (el) el.indeterminate = someReadySelected;
                  }}
                />
                全选可入库项
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  共 {rows.length} 条候选 · 可入库 {readyRows.length} · 已选 {selectedReadyRows.length}
                </span>
                <button
                  type="button"
                  onClick={() => onConfirm("selected")}
                  disabled={confirming || !selectedReadyRows.length}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? "确认中..." : `确认入库${selectedReadyRows.length ? ` (${selectedReadyRows.length})` : ""}`}
                </button>
              </div>
            </div>

            <div className="table-shell">
              <table className="min-w-[780px] text-sm">
                <thead>
                  <tr>
                    <th className="w-12">选择</th>
                    <th>试剂</th>
                    <th>货号</th>
                    <th>类别</th>
                    <th>厂商</th>
                    <th>实验标签</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const tags = row.parsed?.experimentTags ?? [];
                    const vendor = row.parsed?.vendor ?? row.rawInput.vendor ?? "";
                    const reasonLabel = verificationReasonLabel(row.verificationReason);
                    const antibodySummary = row.parsed?.antibodyMeta
                      ? [
                          row.parsed.antibodyMeta.role === "PRIMARY" ? "一抗" : row.parsed.antibodyMeta.role === "SECONDARY" ? "二抗" : null,
                          row.parsed.antibodyMeta.targetName,
                          row.parsed.antibodyMeta.hostSpecies,
                        ]
                          .filter(Boolean)
                          .join(" / ")
                      : null;
                    const primerSummary = row.parsed?.primerMeta
                      ? [row.parsed.primerMeta.targetName, row.parsed.primerMeta.isReferenceGene ? "内参" : null].filter(Boolean).join(" / ")
                      : null;
                    return (
                      <tr key={row.rowId}>
                        <td>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--accent)]"
                            checked={row.selected}
                            disabled={row.status !== "ready"}
                            onChange={(e) =>
                              setRows((prev) => prev.map((item) => (item.rowId === row.rowId ? { ...item, selected: e.target.checked } : item)))
                            }
                          />
                        </td>
                        <td className="max-w-52">
                          <p className="truncate font-medium text-slate-900" title={row.rawInput.name}>
                            {row.rawInput.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">{row.rowId}</p>
                          <details className="mt-1">
                            <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
                              详情
                            </summary>
                            <div className="mt-1 space-y-1 text-xs leading-5 text-slate-500">
                              {antibodySummary ? <p className="[overflow-wrap:anywhere]">抗体：{antibodySummary}</p> : null}
                              {primerSummary ? <p className="[overflow-wrap:anywhere]">引物：{primerSummary}</p> : null}
                              {row.rawInput.antibodyCompatibilityText ? (
                                <p className="[overflow-wrap:anywhere]">兼容性：{row.rawInput.antibodyCompatibilityText}</p>
                              ) : null}
                              {row.rawInput.note ? <p className="[overflow-wrap:anywhere]">备注：{row.rawInput.note}</p> : null}
                              <pre className="max-h-40 overflow-auto rounded-md bg-[var(--bg-muted)] p-2 text-[11px] leading-4 text-slate-500">
                                {JSON.stringify(row.rawInput, null, 2)}
                              </pre>
                            </div>
                          </details>
                        </td>
                        <td className="max-w-32">
                          <span className="block truncate font-mono text-xs text-slate-600" title={row.rawInput.catalogNo ?? ""}>
                            {row.rawInput.catalogNo || <span className="font-sans text-slate-400">未提供</span>}
                          </span>
                        </td>
                        <td className="max-w-28">
                          {row.parsed ? (
                            <>
                              <span className="glass-badge">{reagentCategoryLabel(row.parsed.category)}</span>
                              {row.parsed.subCategory ? (
                                <p className="mt-1 truncate text-xs text-slate-400" title={row.parsed.subCategory}>
                                  {row.parsed.subCategory}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="max-w-32">
                          <span className="block truncate text-xs text-slate-600" title={vendor}>
                            {vendor || <span className="text-slate-400">未识别</span>}
                          </span>
                        </td>
                        <td className="max-w-40" title={tags.join("、")}>
                          {tags.length ? (
                            <div className="flex flex-nowrap gap-1 overflow-hidden">
                              {tags.map((tag) => (
                                <span key={tag} className="chip">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">无</span>
                          )}
                        </td>
                        <td className="max-w-44">
                          {rowStatusPill(row)}
                          {row.confirmResult?.action === "created" ? <p className="mt-1 text-xs text-[var(--success)]">已新增入库</p> : null}
                          {row.confirmResult?.action === "incremented" ? (
                            <p className="mt-1 text-xs text-[var(--success)]">
                              已按补货处理：库存 {row.confirmResult.beforeQuantity} -&gt; {row.confirmResult.afterQuantity}
                            </p>
                          ) : null}
                          {row.error ? <p className="mt-1 text-xs text-[var(--danger)] [overflow-wrap:anywhere]">{row.error}</p> : null}
                          {row.parsed?.warnings?.length ? (
                            <p className="mt-1 text-xs text-[var(--warning)] [overflow-wrap:anywhere]">{row.parsed.warnings.join("；")}</p>
                          ) : null}
                          {row.verificationStatus === "verified" || row.parseSource === "fallback" ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.verificationStatus === "verified" ? <span className="chip">联网补齐</span> : null}
                              {row.parseSource === "fallback" ? <span className="status-pill warning">规则兜底</span> : null}
                            </div>
                          ) : null}
                          {reasonLabel ? <p className="mt-1 text-xs leading-4 text-slate-400">{reasonLabel}</p> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--line-strong)]">
            <p className="empty-state">粘贴文本或图片并完成批量识别后，这里会显示逐条候选结果与批量确认入口。</p>
          </div>
        )}

        {msg ? (
          <p
            className={`text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
