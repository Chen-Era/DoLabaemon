"use client";

import { useEffect, useRef, useState } from "react";
import { isRequestTimeoutError, requestJson } from "@/lib/http";

type ParsedReagent = {
  category: "ANTIBODY" | "BUFFER" | "KIT" | "PRIMER" | "BIOLOGICAL" | "CHEMICAL" | "CONSUMABLE" | "OTHER";
  subCategory?: string | null;
  vendor?: string | null;
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

type VerificationReason = NonNullable<ParsedReagent["verification"]>["reason"];
type ParseStage = "idle" | "queued" | "processing" | "slow" | "done" | "error";
type ParseDiagnostics = {
  parse?: {
    path: "native_verified" | "initial_draft_only" | "external_verified" | "fallback";
    timingsMs?: Partial<Record<"retrieval" | "prepareFlow" | "initialDraft" | "nativeVerify" | "externalSearch" | "externalVerify" | "finalize", number>>;
    degradedStages?: string[];
  } | null;
  route?: {
    stage?: "auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "request";
    failedStage?: "auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "request";
    timingsMs?: Partial<Record<"auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "total", number>>;
  } | null;
};

const parseStageOrder: ParseStage[] = ["queued", "processing", "slow"];
const encouragementMessages = [
  "保持耐心，结果正在靠近。",
  "每一步都算数。",
  "稳一点，会更好。",
  "继续，马上就好。",
  "你已经在推进了。",
  "好结果值得等待。",
  "别急，答案在路上。",
  "慢一点，也是在前进。",
];

function parseStageLabel(stage: ParseStage) {
  switch (stage) {
    case "queued":
      return "请求已发送";
    case "processing":
      return "服务端正在解析";
    case "slow":
      return "仍在等待服务端返回";
    case "done":
      return "解析完成";
    case "error":
      return "解析失败";
    default:
      return "等待开始";
  }
}

function parseStageDescription(stage: ParseStage) {
  switch (stage) {
    case "queued":
      return "已收到点击，正在提交名称、货号和备注。";
    case "processing":
      return "后端可能正在执行模型解析、联网核验、网页抓取或结果草稿保存。";
    case "slow":
      return "这表示请求还没返回，不代表前端真的卡在某个固定步骤。";
    case "done":
      return "可以查看结果并决定是否确认入库。";
    case "error":
      return "请检查输入内容、模型配置或网络状态后重试。";
    default:
      return "提交后这里会展示处理过程。";
  }
}

function verificationReasonLabel(reason: VerificationReason | null | undefined) {
  switch (reason) {
    case "verified":
      return "联网检索与纠错已生效";
    case "external_search_unconfigured":
      return "未配置联网搜索，请补充 REAGENT_SEARCH_PROVIDER 和 REAGENT_SEARCH_API_KEY";
    case "external_search_failed":
      return "外部搜索请求失败，请检查搜索服务或网络";
    case "external_search_no_results":
      return "已尝试联网搜索，但没有拿到可用证据";
    case "native_search_no_sources":
      return "模型已尝试原生联网，但未返回可用来源";
    case "verification_model_failed":
      return "联网证据已拿到，但纠错模型输出失败，已保留初稿";
    case "fallback_used":
      return "模型与联网纠错都失败，已使用规则兜底";
    case "native_tool_unavailable":
      return "当前模型提供方不支持原生联网搜索";
    default:
      return null;
  }
}

function formatMs(value: number | undefined) {
  if (typeof value !== "number") return null;
  return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s`;
}

function routeStageLabel(stage: ParseDiagnostics["route"] extends infer T ? T extends { stage?: infer S } ? S : never : never) {
  switch (stage) {
    case "auth":
      return "登录鉴权";
    case "labAccess":
      return "实验室权限";
    case "loadConfig":
      return "加载模型配置";
    case "parse":
      return "模型解析";
    case "saveDraft":
      return "保存草稿";
    default:
      return "请求处理";
  }
}

function summarizeDiagnostics(diagnostics: ParseDiagnostics | null) {
  if (!diagnostics) return null;
  const parts = [
    diagnostics.route?.timingsMs?.total ? `总耗时 ${formatMs(diagnostics.route.timingsMs.total)}` : null,
    diagnostics.route?.failedStage
      ? `失败阶段 ${routeStageLabel(diagnostics.route.failedStage)}`
      : diagnostics.route?.stage
        ? `最后阶段 ${routeStageLabel(diagnostics.route.stage)}`
        : null,
    diagnostics.parse?.timingsMs?.initialDraft ? `初稿 ${formatMs(diagnostics.parse.timingsMs.initialDraft)}` : null,
    diagnostics.parse?.timingsMs?.externalSearch ? `搜索 ${formatMs(diagnostics.parse.timingsMs.externalSearch)}` : null,
    diagnostics.parse?.timingsMs?.externalVerify ? `验证 ${formatMs(diagnostics.parse.timingsMs.externalVerify)}` : null,
    diagnostics.route?.timingsMs?.saveDraft ? `存草稿 ${formatMs(diagnostics.route.timingsMs.saveDraft)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

export function ReagentForm({ labId }: { labId: string }) {
  const [name, setName] = useState("");
  const [catalogNo, setCatalogNo] = useState("");
  const [note, setNote] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReagent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [parseSource, setParseSource] = useState<"llm" | "fallback" | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"verified" | "unverified" | null>(null);
  const [verificationReason, setVerificationReason] = useState<VerificationReason | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parseStage, setParseStage] = useState<ParseStage>("idle");
  const [parseStartedAt, setParseStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [encouragementIndex, setEncouragementIndex] = useState(0);
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostics | null>(null);
  const phaseTimersRef = useRef<number[]>([]);

  function clearPhaseTimers() {
    phaseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    phaseTimersRef.current = [];
  }

  function startParseProgress() {
    clearPhaseTimers();
    setIsParsing(true);
    setParseStage("queued");
    setParseStartedAt(Date.now());
    setElapsedSeconds(0);
    setEncouragementIndex(0);
    phaseTimersRef.current = [
      window.setTimeout(() => setParseStage("processing"), 300),
      window.setTimeout(() => setParseStage("slow"), 12000),
    ];
  }

  function finishParseProgress(stage: "done" | "error") {
    clearPhaseTimers();
    setIsParsing(false);
    setParseStage(stage);
  }

  useEffect(() => {
    if (!isParsing || !parseStartedAt) return;
    const timerId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - parseStartedAt) / 1000)));
    }, 250);
    return () => window.clearInterval(timerId);
  }, [isParsing, parseStartedAt]);

  useEffect(() => {
    if (!isParsing) return;
    const timerId = window.setInterval(() => {
      setEncouragementIndex((prev) => (prev + 1) % encouragementMessages.length);
    }, 2600);
    return () => window.clearInterval(timerId);
  }, [isParsing]);

  useEffect(() => () => clearPhaseTimers(), []);

  async function onParse(e: { preventDefault(): void }) {
    e.preventDefault();
    setMsg(null);
    setDraftId(null);
    setParsed(null);
    setParseSource(null);
    setVerificationStatus(null);
    setVerificationReason(null);
    setDiagnostics(null);
    startParseProgress();
    try {
      const { response, data } = await requestJson<{
        draftId?: string | null;
        draftSaveFailed?: boolean;
        warning?: string;
        parseSource?: "llm" | "fallback";
        verificationStatus?: "verified" | "unverified";
        verificationReason?: VerificationReason;
        parsed?: ParsedReagent;
        error?: string;
        code?: string;
        detail?: string;
        stage?: ParseDiagnostics["route"] extends infer T ? T extends { stage?: infer S } ? S : never : never;
        diagnostics?: ParseDiagnostics;
      }>("/api/reagents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, name, catalogNo, note, lang: "zh" }),
        timeoutMs: 90000,
      });
      if (response.status === 401) {
        finishParseProgress("error");
        setMsg("登录状态已失效，正在跳转到登录页");
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        finishParseProgress("error");
        setDiagnostics(data?.diagnostics ?? null);
        const diagnosticSummary = summarizeDiagnostics(data?.diagnostics ?? null);
        setMsg([data?.error ?? "解析失败", data?.detail, diagnosticSummary].filter(Boolean).join(" | "));
        return;
      }
      setDraftId(data?.draftId ?? null);
      setParsed(data?.parsed ?? null);
      setParseSource(data?.parseSource ?? null);
      setVerificationStatus(data?.verificationStatus ?? data?.parsed?.verification?.status ?? null);
      setVerificationReason(data?.verificationReason ?? data?.parsed?.verification?.reason ?? null);
      setDiagnostics(data?.diagnostics ?? null);
      finishParseProgress("done");
      if (data?.draftSaveFailed) {
        const diagnosticSummary = summarizeDiagnostics(data?.diagnostics ?? null);
        setMsg([data?.warning ?? "解析成功，但保存草稿失败，当前结果暂不能确认入库。", data?.detail, diagnosticSummary].filter(Boolean).join(" | "));
      } else if (data?.parseSource === "fallback") {
        setMsg("模型解析失败，已使用规则兜底分类。");
      } else {
        setMsg(null);
      }
    } catch (error) {
      finishParseProgress("error");
      setMsg(isRequestTimeoutError(error) ? "请求超时，请检查模型配置、搜索配置或网络后重试" : "网络异常，请稍后重试");
    }
  }

  async function onConfirm() {
    if (!draftId || !parsed) return;
    setIsConfirming(true);
    try {
      const { response, data } = await requestJson<{
        reagentId?: string;
        action?: "created" | "incremented";
        beforeQuantity?: number;
        afterQuantity?: number;
        error?: string;
      }>("/api/reagents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          editedPayload: {
            labId,
            name,
            catalogNo,
            note,
            category: parsed.category,
            subCategory: parsed.subCategory,
            vendor: parsed.vendor,
            experimentTags: parsed.experimentTags ?? [],
            antibodyMeta: parsed.antibodyMeta,
            primerMeta: parsed.primerMeta,
          },
        }),
      });
      if (response.status === 401) {
        setMsg("登录状态已失效，正在跳转到登录页");
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "确认失败");
        return;
      }
      if (data?.action === "incremented") {
        setMsg(`货号已存在，已按补货处理：库存 ${data.beforeQuantity ?? "?"} -> ${data.afterQuantity ?? "?"}`);
        return;
      }
      setMsg(`已新增入库: ${data?.reagentId}`);
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="data-grid cols-2">
      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Step 1</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">输入原始试剂信息</h2>
          <p className="section-copy mt-2 text-sm">模型会结合名称、货号和补充备注生成结构化建议，最终仍需人工确认。</p>
        </div>
        <form onSubmit={onParse} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="reagent-name">
              试剂名称
            </label>
            <input
              id="reagent-name"
              className="input-base"
              placeholder="例如：Rabbit anti-LC3B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="reagent-catalog">
              货号
            </label>
            <input
              id="reagent-catalog"
              className="input-base"
              placeholder="输入 catalog number"
              value={catalogNo}
              onChange={(e) => setCatalogNo(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="reagent-note">
              备注
            </label>
            <textarea
              id="reagent-note"
              className="input-base min-h-32 resize-y"
              placeholder="可补充厂商、用途、宿主、适用实验等信息"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className="button-primary w-full" type="submit" disabled={isParsing}>
            {isParsing ? `处理中 (${elapsedSeconds}s)` : "调用模型解析"}
          </button>
          <p className="text-xs text-slate-500">
            点击后会立即显示处理进度；若启用了联网核验，等待时间通常会更长一些。
          </p>
        </form>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Step 2 / 3</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">结构化结果与确认入库</h2>
          <p className="section-copy mt-2 text-sm">优先展示人可读摘要，原始 JSON 保留为调试信息。</p>
        </div>

        {isParsing ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-900">{parseStageLabel(parseStage)}</p>
                  <p className="mt-1 text-sm text-blue-800">{parseStageDescription(parseStage)}</p>
                </div>
                <span className="status-pill">已等待 {elapsedSeconds}s</span>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-all">
                {encouragementMessages[encouragementIndex]}
              </div>
              <div className="mt-4 space-y-2">
                {parseStageOrder.map((stage) => {
                  const currentIndex = parseStageOrder.indexOf(parseStage);
                  const stageIndex = parseStageOrder.indexOf(stage);
                  const isActive = currentIndex === stageIndex;
                  const isDone = currentIndex > stageIndex;
                  return (
                    <div
                      key={stage}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : isActive
                            ? "border-blue-200 bg-white text-blue-900"
                            : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {isDone ? "已完成" : isActive ? "进行中" : "等待中"}：{parseStageLabel(stage)}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
              正在等待模型返回结构化结果，这里稍后会自动切换为可读摘要与确认入库入口。
            </div>
          </div>
        ) : parsed ? (
          <div className="space-y-4">
            <div className="data-grid">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">类别</p>
                <p className="mt-2 font-medium text-slate-900">{parsed.category}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">子类</p>
                <p className="mt-2 font-medium text-slate-900">{parsed.subCategory || "未识别"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">厂商</p>
                <p className="mt-2 font-medium text-slate-900">{parsed.vendor || "未识别"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">实验标签</p>
                {parsed.experimentTags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsed.experimentTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">未识别，可后续补充多个标签</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">抗体信息</p>
                <p className="mt-2 text-sm text-slate-900">
                  {parsed.antibodyMeta
                    ? [parsed.antibodyMeta.role, parsed.antibodyMeta.targetName, parsed.antibodyMeta.hostSpecies].filter(Boolean).join(" / ")
                    : "无"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">引物信息</p>
                <p className="mt-2 text-sm text-slate-900">
                  {parsed.primerMeta
                    ? [parsed.primerMeta.targetName, parsed.primerMeta.isReferenceGene ? "内参" : null].filter(Boolean).join(" / ")
                    : "无"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {parseSource ? (
                <span className={parseSource === "llm" ? "status-pill" : "warning-panel text-sm"}>
                  解析来源：{parseSource === "llm" ? "LLM" : "Fallback"}
                </span>
              ) : null}
              {verificationStatus ? (
                <span className={verificationStatus === "verified" ? "success-panel text-sm" : "glass-badge"}>
                  联网核验：{verificationStatus === "verified" ? "已核验" : "未核验"}
                </span>
              ) : null}
              {parseStage === "done" ? <span className="glass-badge">本次解析耗时 {elapsedSeconds}s</span> : null}
            </div>
            {verificationReasonLabel(verificationReason) ? (
              <p className={verificationStatus === "verified" ? "text-sm text-emerald-700" : "warning-panel text-sm"}>
                {verificationReasonLabel(verificationReason)}
              </p>
            ) : null}
            {parseSource === "llm" ? (
              <p className="text-sm text-slate-500">
                本次已完成模型解析；如果启用了联网核验，结果中已包含搜索/纠偏后的最终状态。
              </p>
            ) : null}
            {summarizeDiagnostics(diagnostics) ? <p className="text-xs text-slate-500">诊断：{summarizeDiagnostics(diagnostics)}</p> : null}

            <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">查看原始 JSON</summary>
              <pre className="mt-4 overflow-auto text-xs text-slate-600">{JSON.stringify(parsed, null, 2)}</pre>
            </details>

            <button type="button" onClick={onConfirm} className="button-primary w-full" disabled={isConfirming || !draftId || !parsed}>
              {isConfirming ? "确认入库中..." : draftId ? "确认入库" : "草稿未保存，暂不能入库"}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
            提交原始信息后，这里会显示结构化分类、实验标签、抗体 / 引物摘要与确认入库入口。
          </div>
        )}

        {msg ? (
          <p className={`mt-4 text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}>{msg}</p>
        ) : null}
      </section>
    </div>
  );
}
