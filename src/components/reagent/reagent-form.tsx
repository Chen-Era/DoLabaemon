"use client";

import { useState } from "react";
import { requestJson } from "@/lib/http";

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

  async function onParse(e: { preventDefault(): void }) {
    e.preventDefault();
    setMsg(null);
    setParseSource(null);
    setVerificationStatus(null);
    setVerificationReason(null);
    try {
      const { response, data } = await requestJson<{
        draftId?: string;
        parseSource?: "llm" | "fallback";
        verificationStatus?: "verified" | "unverified";
        verificationReason?: VerificationReason;
        parsed?: ParsedReagent;
        error?: string;
      }>("/api/reagents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, name, catalogNo, note, lang: "zh" }),
      });
      if (response.status === 401) {
        setMsg("登录状态已失效，正在跳转到登录页");
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "解析失败");
        return;
      }
      setDraftId(data?.draftId ?? null);
      setParsed(data?.parsed ?? null);
      setParseSource(data?.parseSource ?? null);
      setVerificationStatus(data?.verificationStatus ?? data?.parsed?.verification?.status ?? null);
      setVerificationReason(data?.verificationReason ?? data?.parsed?.verification?.reason ?? null);
      if (data?.parseSource === "fallback") {
        setMsg("模型解析失败，已使用规则兜底分类。");
      } else {
        setMsg(null);
      }
    } catch {
      setMsg("网络异常，请稍后重试");
    }
  }

  async function onConfirm() {
    if (!draftId || !parsed) return;
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
    }
  }

  return (
    <div className="data-grid cols-2">
      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Step 1</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">输入原始试剂信息</h2>
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
          <button className="button-primary w-full" type="submit">
            调用模型解析
          </button>
        </form>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Step 2 / 3</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">结构化结果与确认入库</h2>
          <p className="section-copy mt-2 text-sm">优先展示人可读摘要，原始 JSON 保留为调试信息。</p>
        </div>

        {parsed ? (
          <div className="space-y-4">
            <div className="data-grid">
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">类别</p>
                <p className="mt-2 font-medium text-white">{parsed.category}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">子类</p>
                <p className="mt-2 font-medium text-white">{parsed.subCategory || "未识别"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">厂商</p>
                <p className="mt-2 font-medium text-white">{parsed.vendor || "未识别"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">实验标签</p>
                {parsed.experimentTags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsed.experimentTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-300">未识别，可后续补充多个标签</p>
                )}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">抗体信息</p>
                <p className="mt-2 text-sm text-white">
                  {parsed.antibodyMeta
                    ? [parsed.antibodyMeta.role, parsed.antibodyMeta.targetName, parsed.antibodyMeta.hostSpecies].filter(Boolean).join(" / ")
                    : "无"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <p className="text-sm text-zinc-400">引物信息</p>
                <p className="mt-2 text-sm text-white">
                  {parsed.primerMeta
                    ? [parsed.primerMeta.targetName, parsed.primerMeta.isReferenceGene ? "内参" : null].filter(Boolean).join(" / ")
                    : "无"}
                </p>
              </div>
            </div>

            {parseSource ? (
              <p className={parseSource === "llm" ? "status-pill" : "warning-panel text-sm"}>
                解析来源：{parseSource === "llm" ? "LLM" : "Fallback"}
              </p>
            ) : null}
            {verificationStatus ? (
              <p className={verificationStatus === "verified" ? "success-panel text-sm" : "glass-badge"}>
                联网核验：{verificationStatus === "verified" ? "已核验" : "未核验"}
              </p>
            ) : null}
            {verificationReasonLabel(verificationReason) ? (
              <p className={verificationStatus === "verified" ? "text-sm text-emerald-200" : "warning-panel text-sm"}>
                {verificationReasonLabel(verificationReason)}
              </p>
            ) : null}

            <details className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-zinc-200">查看原始 JSON</summary>
              <pre className="mt-4 overflow-auto text-xs text-zinc-300">{JSON.stringify(parsed, null, 2)}</pre>
            </details>

            <button type="button" onClick={onConfirm} className="button-primary w-full">
              确认入库
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 px-5 py-8 text-sm text-zinc-400">
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
