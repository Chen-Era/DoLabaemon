"use client";

import { ClipboardEvent, useMemo, useState } from "react";
import { isRequestTimeoutError, requestJson } from "@/lib/http";

type ParsedReagent = {
  category: "ANTIBODY" | "BUFFER" | "KIT" | "PRIMER" | "BIOLOGICAL" | "CHEMICAL" | "CONSUMABLE" | "OTHER";
  subCategory?: string | null;
  vendor?: string | null;
  confidence?: number;
  warnings?: string[];
  experimentTags?: string[];
  verification?: {
    status?: "verified" | "unverified";
    method?: "native_web_search" | "external_search" | "none";
    reason?:
      | "verified"
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
  verificationMethod?: "native_web_search" | "external_search" | "none";
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

export function ReagentBatchForm({ labId }: { labId: string }) {
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [extractingImage, setExtractingImage] = useState(false);

  const readyRows = useMemo(() => rows.filter((row) => row.status === "ready" && row.draftId && row.parsed), [rows]);
  const selectedReadyRows = useMemo(() => readyRows.filter((row) => row.selected), [readyRows]);

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
    <section className="app-panel px-6 py-6">
      <div className="mb-5">
        <p className="section-kicker">Batch Ingestion</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">批量新增试剂</h2>
        <p className="section-copy mt-2 text-sm">
          支持直接粘贴多行文本或表格文本；若在输入框中粘贴图片，系统会先自动提取文字，再进入批量识别流程。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="reagent-batch-input">
            批量原始信息
          </label>
          <textarea
            id="reagent-batch-input"
            className="input-base min-h-48 resize-y"
            placeholder={"示例：\nRabbit anti-LC3B\tCST\t2775S\tWB 1:1000, IF 1:200\nGoat anti-rabbit IgG Alexa 488\tInvitrogen\tA-11008\tIF secondary"}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onPaste={onPaste}
          />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="glass-badge">支持 Excel / 制表符文本</span>
            <span className="glass-badge">支持输入框粘贴图片自动转文字</span>
            {extractingImage ? <span className="status-pill">图片转文字中...</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onParseBatch} className="button-primary" disabled={parsing || extractingImage}>
            {parsing ? "批量识别中..." : "批量识别"}
          </button>
          <button
            type="button"
            onClick={() => setRows((prev) => prev.map((row) => (row.status === "ready" ? { ...row, selected: true } : row)))}
            className="button-secondary"
            disabled={!readyRows.length}
          >
            全选可入库项
          </button>
          <button
            type="button"
            onClick={() => setRows((prev) => prev.map((row) => ({ ...row, selected: false })))}
            className="button-secondary"
            disabled={!rows.some((row) => row.selected)}
          >
            取消全选
          </button>
          <button type="button" onClick={() => onConfirm("selected")} className="button-secondary" disabled={confirming || !selectedReadyRows.length}>
            {confirming ? "确认中..." : `确认已选 (${selectedReadyRows.length})`}
          </button>
          <button type="button" onClick={() => onConfirm("all")} className="button-secondary" disabled={confirming || !readyRows.length}>
            {confirming ? "确认中..." : `全部确认入库 (${readyRows.length})`}
          </button>
        </div>

        {rows.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="status-pill">可入库 {readyRows.length}</span>
              <span className="glass-badge">已选择 {selectedReadyRows.length}</span>
              <span className="glass-badge">总候选 {rows.length}</span>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <article key={row.rowId} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="glass-badge">{row.rowId}</span>
                        <span className={row.status === "confirmed" ? "success-panel text-sm" : row.status === "failed" ? "danger-panel text-sm" : "status-pill"}>
                          {row.status === "confirmed" ? "已入库" : row.status === "failed" ? "需处理" : "待确认"}
                        </span>
                        {row.parseSource ? (
                          <span className={row.parseSource === "llm" ? "status-pill" : "warning-panel text-sm"}>
                            解析来源：{row.parseSource === "llm" ? "LLM" : "Fallback"}
                          </span>
                        ) : null}
                        {row.verificationStatus ? (
                          <span className={row.verificationStatus === "verified" ? "success-panel text-sm" : "glass-badge"}>
                            联网核验：{row.verificationStatus === "verified" ? "已核验" : "未核验"}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-medium text-slate-900">{row.rawInput.name}</h3>
                      <p className="text-sm text-slate-600">
                        厂家：{row.rawInput.vendor || "未提供"} | 货号：{row.rawInput.catalogNo || "未提供"}
                      </p>
                      {row.rawInput.antibodyCompatibilityText ? (
                        <p className="text-sm text-slate-600">兼容性：{row.rawInput.antibodyCompatibilityText}</p>
                      ) : null}
                      {row.rawInput.note ? <p className="text-sm text-slate-600">备注：{row.rawInput.note}</p> : null}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.status !== "ready"}
                        onChange={(e) =>
                          setRows((prev) => prev.map((item) => (item.rowId === row.rowId ? { ...item, selected: e.target.checked } : item)))
                        }
                      />
                      选择入库
                    </label>
                  </div>

                  {row.parsed ? (
                    <div className="mt-4 data-grid">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">类别</p>
                        <p className="mt-2 font-medium text-slate-900">{row.parsed.category}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">子类</p>
                        <p className="mt-2 font-medium text-slate-900">{row.parsed.subCategory || "未识别"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">厂商</p>
                        <p className="mt-2 font-medium text-slate-900">{row.parsed.vendor || row.rawInput.vendor || "未识别"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">实验标签</p>
                        <p className="mt-2 text-sm text-slate-900">{row.parsed.experimentTags?.length ? row.parsed.experimentTags.join(" / ") : "无"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">抗体信息</p>
                        <p className="mt-2 text-sm text-slate-900">
                          {row.parsed.antibodyMeta
                            ? [row.parsed.antibodyMeta.role, row.parsed.antibodyMeta.targetName, row.parsed.antibodyMeta.hostSpecies]
                                .filter(Boolean)
                                .join(" / ")
                            : "无"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">引物信息</p>
                        <p className="mt-2 text-sm text-slate-900">
                          {row.parsed.primerMeta
                            ? [row.parsed.primerMeta.targetName, row.parsed.primerMeta.isReferenceGene ? "内参" : null].filter(Boolean).join(" / ")
                            : "无"}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {verificationReasonLabel(row.verificationReason) ? (
                    <p className={row.verificationStatus === "verified" ? "mt-4 text-sm text-emerald-700" : "warning-panel mt-4 text-sm"}>
                      {verificationReasonLabel(row.verificationReason)}
                    </p>
                  ) : null}
                  {row.parsed?.warnings?.length ? <p className="warning-panel mt-4 text-sm">{row.parsed.warnings.join("；")}</p> : null}
                  {row.error ? <p className="danger-panel mt-4 text-sm">{row.error}</p> : null}
                  {row.confirmResult?.action === "incremented" ? (
                    <p className="success-panel mt-4 text-sm">
                      已按补货处理：库存 {row.confirmResult.beforeQuantity} -&gt; {row.confirmResult.afterQuantity}
                    </p>
                  ) : null}
                  {row.confirmResult?.action === "created" ? <p className="success-panel mt-4 text-sm">已新增入库</p> : null}

                  <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">查看原始信息</summary>
                    <pre className="mt-4 overflow-auto text-xs text-slate-600">{JSON.stringify(row.rawInput, null, 2)}</pre>
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
            粘贴文本或图片并完成批量识别后，这里会显示逐条候选结果与批量确认入口。
          </div>
        )}

        {msg ? <p className={`text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}>{msg}</p> : null}
      </div>
    </section>
  );
}
