"use client";

import { useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, ChevronDownIcon } from "@/components/common/app-icons";
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

type VerificationReason = NonNullable<ParsedReagent["verification"]>["reason"];
type ParseStage = "idle" | "queued" | "processing" | "slow" | "done" | "error";
type ParseDiagnostics = {
  parse?: {
    path: "native_verified" | "knowledge_verified" | "initial_draft_only" | "external_verified" | "fallback";
    timingsMs?: Partial<Record<"retrieval" | "prepareFlow" | "initialDraft" | "nativeVerify" | "externalSearch" | "externalVerify" | "finalize", number>>;
    degradedStages?: string[];
  } | null;
  route?: {
    stage?: "auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "request";
    failedStage?: "auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "request";
    timingsMs?: Partial<Record<"auth" | "labAccess" | "loadConfig" | "parse" | "saveDraft" | "total", number>>;
  } | null;
};

const parseProgressSteps: Array<{ stage: ParseStage; label: string }> = [
  { stage: "queued", label: "已提交" },
  { stage: "processing", label: "解析中" },
  { stage: "slow", label: "耗时较长" },
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
    case "knowledge_base_hit":
      return "本地知识库高置信命中，已跳过联网验证";
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

function verificationPillClass(status: "verified" | "unverified" | null, reason: VerificationReason | null) {
  if (status === "verified") return "status-pill success";
  if (reason === "fallback_used" || reason === "verification_model_failed") return "status-pill warning";
  return "glass-badge";
}

function antibodyRoleLabel(role: "PRIMARY" | "SECONDARY" | null | undefined) {
  if (role === "PRIMARY") return "一抗";
  if (role === "SECONDARY") return "二抗";
  return null;
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

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-800" title={value}>
        {value}
      </dd>
    </div>
  );
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
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostics | null>(null);
  const phaseTimersRef = useRef<number[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  function onEdit() {
    clearPhaseTimers();
    setIsParsing(false);
    setParsed(null);
    setDraftId(null);
    setParseSource(null);
    setVerificationStatus(null);
    setVerificationReason(null);
    setDiagnostics(null);
    setMsg(null);
    setParseStage("idle");
    nameInputRef.current?.focus();
  }

  function onReparse() {
    if (!name.trim() || !catalogNo.trim()) {
      setMsg("请先填写试剂名称与货号");
      return;
    }
    void onParse({ preventDefault: () => {} });
  }

  const currentStepIndex = parseProgressSteps.findIndex((step) => step.stage === parseStage);
  const diagnosticSummary = summarizeDiagnostics(diagnostics);
  const reasonLabel = verificationReasonLabel(verificationReason);
  const antibodyMeta = parsed?.antibodyMeta ?? null;
  const primerMeta = parsed?.primerMeta ?? null;

  return (
    <div className="data-grid cols-2">
      <section className="app-panel px-5 py-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">填写信息</h3>
          <p className="section-copy mt-1 text-sm">系统会根据名称、货号和备注生成结构化建议，确认后再入库。</p>
        </div>
        <form onSubmit={onParse} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="reagent-name">
                试剂名称
              </label>
              <input
                id="reagent-name"
                ref={nameInputRef}
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
                className="input-base font-mono"
                placeholder="例如：2775S"
                value={catalogNo}
                onChange={(e) => setCatalogNo(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="reagent-note">
              备注
            </label>
            <textarea
              id="reagent-note"
              className="input-base min-h-28 resize-y"
              placeholder="可补充厂商、用途、宿主、适用实验等信息"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className="button-primary w-full" type="submit" disabled={isParsing}>
            {isParsing ? `正在识别（${elapsedSeconds} 秒）` : "识别试剂信息"}
          </button>
          <p className="field-hint">开始后会显示处理进度；如果需要联网核对，等待时间会稍长。</p>
        </form>
      </section>

      <section className="app-panel px-5 py-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">识别结果</h3>
          <p className="section-copy mt-1 text-sm">请核对关键信息后确认入库。</p>
        </div>

        {isParsing ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--line)] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{parseStageLabel(parseStage)}</p>
                <span className="status-pill">已等待 {elapsedSeconds} 秒</span>
              </div>
              <ol className="mt-4 flex items-center gap-2">
                {parseProgressSteps.map((step, index) => {
                  const isDone = currentStepIndex > index;
                  const isActive = currentStepIndex === index;
                  return (
                    <li key={step.stage} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                          isDone
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : isActive
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                              : "border-[var(--line-strong)] text-slate-400"
                        }`}
                      >
                        {isDone ? <CheckIcon className="h-3 w-3" /> : index + 1}
                      </span>
                      <span
                        className={`whitespace-nowrap text-xs ${
                          isActive ? "font-medium text-slate-900" : isDone ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      {index < parseProgressSteps.length - 1 ? <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-[var(--line)]" /> : null}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs leading-5 text-slate-500">{parseStageDescription(parseStage)}</p>
            </div>
            <div className="space-y-2" aria-hidden="true">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/5" />
            </div>
          </div>
        ) : parsed ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {parseSource ? (
                <span className={parseSource === "llm" ? "status-pill" : "status-pill warning"}>
                  识别方式：{parseSource === "llm" ? "模型解析" : "规则补全"}
                </span>
              ) : null}
              {verificationStatus ? (
                <span className={verificationPillClass(verificationStatus, verificationReason)}>
                  联网核验：{verificationStatus === "verified" ? "已核验" : "未核验"}
                </span>
              ) : null}
              {parseStage === "done" ? <span className="glass-badge">本次解析耗时 {elapsedSeconds} 秒</span> : null}
            </div>
            {reasonLabel ? <p className="text-xs leading-5 text-slate-500">{reasonLabel}</p> : null}
            {parseSource === "llm" ? (
              <p className="text-xs leading-5 text-slate-500">本次已完成模型解析；如果启用了联网核验，结果中已包含搜索/纠偏后的最终状态。</p>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-4 py-3">
              <div>
                <dt className="text-xs text-slate-500">类别</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">{reagentCategoryLabel(parsed.category)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">子类</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">{parsed.subCategory || "未识别"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">厂商</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">{parsed.vendor || "未识别"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">置信度</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {typeof parsed.confidence === "number" ? `${Math.round(parsed.confidence * 100)}%` : "未返回"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-xs text-slate-500">实验标签</p>
              {parsed.experimentTags?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {parsed.experimentTags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">未识别，可后续补充多个标签</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--line)] px-3.5 py-3">
                <p className="text-xs font-semibold text-slate-700">抗体信息</p>
                {antibodyMeta ? (
                  <dl className="mt-2 space-y-1 text-xs">
                    <MetaRow label="角色" value={antibodyRoleLabel(antibodyMeta.role)} />
                    <MetaRow label="靶点" value={antibodyMeta.targetName} />
                    <MetaRow label="宿主" value={antibodyMeta.hostSpecies} />
                    <MetaRow label="目标种属" value={antibodyMeta.targetSpecies} />
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">无</p>
                )}
              </div>
              <div className="rounded-lg border border-[var(--line)] px-3.5 py-3">
                <p className="text-xs font-semibold text-slate-700">引物信息</p>
                {primerMeta ? (
                  <dl className="mt-2 space-y-1 text-xs">
                    <MetaRow label="靶点" value={primerMeta.targetName} />
                    <MetaRow label="内参" value={primerMeta.isReferenceGene ? "是" : null} />
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">无</p>
                )}
              </div>
            </div>

            {parsed.warnings?.length ? <p className="warning-panel text-xs">{parsed.warnings.join("；")}</p> : null}

            {diagnosticSummary ? (
              <details className="rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                  <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                  诊断信息
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{diagnosticSummary}</p>
              </details>
            ) : null}

            <details className="rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-3.5 py-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                查看原始数据
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto text-xs leading-5 text-slate-600">{JSON.stringify(parsed, null, 2)}</pre>
            </details>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
              <button type="button" onClick={onConfirm} className="button-primary" disabled={isConfirming || !draftId || !parsed}>
                {isConfirming ? "确认入库中..." : "确认入库"}
              </button>
              <button type="button" onClick={onEdit} className="button-secondary" disabled={isConfirming}>
                修改
              </button>
              <button type="button" onClick={onReparse} className="button-ghost" disabled={isParsing || isConfirming}>
                重新解析
              </button>
            </div>
            {!draftId ? <p className="field-hint">草稿未保存，暂不能入库；可点击“重新解析”重试。</p> : null}
          </div>
        ) : parseStage === "error" ? (
          <div className="space-y-3">
            <div className="danger-panel text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertIcon className="h-4 w-4" />
                {parseStageLabel("error")}
              </p>
              <p className="mt-1 text-xs leading-5">{parseStageDescription("error")}</p>
            </div>
            {diagnosticSummary ? (
              <details className="rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                  <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                  诊断信息
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{diagnosticSummary}</p>
              </details>
            ) : null}
            <div>
              <button type="button" onClick={onReparse} className="button-ghost" disabled={isParsing}>
                重新解析
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--line-strong)]">
            <p className="empty-state">提交原始信息后，这里会显示结构化分类、实验标签、抗体 / 引物摘要与确认入库入口。</p>
          </div>
        )}

        {msg ? (
          <p
            className={`mt-4 text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {msg}
          </p>
        ) : null}
      </section>
    </div>
  );
}
