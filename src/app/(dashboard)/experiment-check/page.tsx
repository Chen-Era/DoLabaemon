"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckResult, ConfidenceMeter, MarkerList } from "@/components/experiment/check-result";
import { AlertIcon, ExperimentIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";
import { experimentTypeCatalog } from "@/lib/rules/catalog";

type Lab = { role: string; lab: { id: string; name: string } };

type ExperimentCheckResponse = {
  error?: string;
  status: string;
  confidenceLabel: string;
  minMissing: string[];
  recommendedMissing: string[];
  warnings: string[];
  compatibilityIssues: string[];
  resolvedExperimentType?: string | null;
  resolutionSource?: string | null;
  resolutionConfidence?: number | null;
  needsConfirmation?: boolean;
  suggestion?: {
    proposedExperimentName: string;
    proposedExperimentCode?: string | null;
    matchedExistingCode?: string | null;
    workflowStages: string[];
    minRequiredItems: Array<{ name: string; matcherType: string; matcherValues: string[] }>;
    recommendedItems: Array<{ name: string; matcherType: string; matcherValues: string[] }>;
    warnings: string[];
    rationale?: string | null;
    confidence: number;
  } | null;
};

type Suggestion = NonNullable<ExperimentCheckResponse["suggestion"]>;

function ChipList({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="text-sm text-stone-400">无</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="chip">
          {item}
        </span>
      ))}
    </div>
  );
}

function SuggestionView({ suggestion }: { suggestion: Suggestion }) {
  const notes = [suggestion.rationale, ...suggestion.warnings].filter((note): note is string => Boolean(note));
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700">
            <AlertIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-pill warning">待确认</span>
              <span className="text-xs font-medium text-amber-800">可能匹配</span>
            </div>
            <p className="mt-1.5 text-lg font-semibold text-amber-900 [overflow-wrap:anywhere]">
              {suggestion.proposedExperimentName}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              系统还不能确定你输入的是哪种实验，先给出几个可能的模板。确认后再保存为正式类型。
            </p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="text-xs text-stone-400">建议匹配为</dt>
          <dd className="mt-0.5 text-xs font-medium text-stone-700 [overflow-wrap:anywhere]">
            {suggestion.matchedExistingCode || suggestion.proposedExperimentCode || "新实验候选"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-400">匹配可信度</dt>
          <dd className="mt-0.5">
            <ConfidenceMeter value={suggestion.confidence} />
          </dd>
        </div>
      </dl>

      <div className="subtle-divider" />

      <section>
        <BlockHeading title="流程阶段" count={suggestion.workflowStages.length} />
        <ChipList items={suggestion.workflowStages} />
      </section>

      <div className="subtle-divider" />

      <section>
        <BlockHeading title="最低必需试剂" count={suggestion.minRequiredItems.length} />
        <ChipList items={suggestion.minRequiredItems.map((item) => item.name)} />
      </section>

      <div className="subtle-divider" />

      <section>
        <BlockHeading title="推荐补充试剂" count={suggestion.recommendedItems.length} />
        <ChipList items={suggestion.recommendedItems.map((item) => item.name)} />
      </section>

      <div className="subtle-divider" />

      <section>
        <BlockHeading title="说明与警告" count={notes.length} />
        {notes.length ? <MarkerList items={notes} markerClass="bg-amber-600" /> : <p className="text-sm text-stone-400">无</p>}
      </section>
    </div>
  );
}

function BlockHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <span className="glass-badge">{count}</span>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <span className="skeleton inline-block h-4 w-4 shrink-0" aria-hidden="true" />
        正在核对库存和实验条件…
      </p>
      <div className="skeleton h-24" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-12" />
        <div className="skeleton h-12" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
    </div>
  );
}

export default function ExperimentCheckPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [inputMode, setInputMode] = useState<"STANDARD" | "MANUAL">("STANDARD");
  const [experimentType, setExperimentType] = useState("WB");
  const [customExperimentName, setCustomExperimentName] = useState("");
  const [experimentContext, setExperimentContext] = useState("");
  const [direction, setDirection] = useState("AUTOPHAGY");
  const [prerequisite, setPrerequisite] = useState("");
  const [result, setResult] = useState<ExperimentCheckResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<{ items?: Lab[]; error?: string }>("/api/labs/my")
      .then(({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          setCheckError(data?.error ?? "读取实验室失败，请稍后再试。");
          return;
        }
        const nextLabs = data?.items ?? [];
        setLabs(nextLabs);
        if (nextLabs.length) {
          setLabId(nextLabs[0].lab.id);
        }
      })
      .catch(() => setCheckError("网络异常，暂时无法读取实验室。"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!labId) {
      setCheckError("请先选择实验室。");
      return;
    }
    setCheckError(null);
    setSubmitting(true);
    try {
      const payload =
        inputMode === "STANDARD"
          ? { labId, inputMode, experimentType, direction, prerequisite, lang: "zh" }
          : { labId, inputMode, customExperimentName, experimentContext, direction, prerequisite, lang: "zh" };
      const { response, data } = await requestJson<ExperimentCheckResponse>("/api/experiment/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.ok && data) {
        setResult(data);
      } else {
        setResult(null);
        setCheckError(data?.error ?? "检查失败，请稍后再试。");
      }
    } catch {
      setResult(null);
      setCheckError("网络异常，暂时无法检查实验准备。");
    } finally {
      setSubmitting(false);
    }
  }

  function segmentedClass(active: boolean) {
    return `rounded-md border px-3 py-1.5 text-sm transition ${
      active
        ? "border-stone-200 bg-white font-semibold text-stone-900"
        : "border-transparent font-medium text-stone-500 hover:text-stone-900"
    }`;
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">检查实验准备</h1>
        <p className="section-copy mt-1.5 max-w-2xl text-sm">核对库存和必要条件，快速判断实验是否可开展。</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <section className="app-panel px-5 py-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-stone-900">实验信息</h2>
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="field-label" htmlFor="check-lab">
                实验室
              </label>
              <select id="check-lab" className="input-base" value={labId} onChange={(e) => setLabId(e.target.value)}>
                {labs.map((x) => (
                  <option key={x.lab.id} value={x.lab.id}>
                    {x.lab.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="subtle-divider" />

            <div className="space-y-3">
              <div>
                <label className="field-label">输入方式</label>
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg border border-stone-300 bg-stone-100 p-1"
                  role="group"
                  aria-label="输入方式"
                >
                  <button
                    type="button"
                    className={segmentedClass(inputMode === "STANDARD")}
                    aria-pressed={inputMode === "STANDARD"}
                    onClick={() => {
                      setInputMode("STANDARD");
                      setResult(null);
                    }}
                  >
                    标准实验类型
                  </button>
                  <button
                    type="button"
                    className={segmentedClass(inputMode === "MANUAL")}
                    aria-pressed={inputMode === "MANUAL"}
                    onClick={() => {
                      setInputMode("MANUAL");
                      setResult(null);
                    }}
                  >
                    手动输入实验名
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="check-experiment">
                  {inputMode === "STANDARD" ? "实验类型" : "实验名称"}
                </label>
                {inputMode === "STANDARD" ? (
                  <select
                    id="check-experiment"
                    className="input-base"
                    value={experimentType}
                    onChange={(e) => setExperimentType(e.target.value)}
                  >
                    {experimentTypeCatalog.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.nameZh}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="check-experiment"
                    className="input-base"
                    placeholder="例如：蛋白免疫印迹、ELISA、细胞因子分泌检测"
                    value={customExperimentName}
                    onChange={(e) => setCustomExperimentName(e.target.value)}
                  />
                )}
              </div>
              {inputMode === "MANUAL" ? (
                <div>
                  <label className="field-label" htmlFor="check-context">
                    实验备注（选填）
                  </label>
                  <textarea
                    id="check-context"
                    className="input-base min-h-28"
                    placeholder="例如：检测细胞上清中 IL-6 分泌；样本来自成骨诱导后的条件培养基"
                    value={experimentContext}
                    onChange={(e) => setExperimentContext(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="subtle-divider" />

            <div className="space-y-3">
              <div>
                <label className="field-label" htmlFor="check-direction">
                  研究方向
                </label>
                <select
                  id="check-direction"
                  className="input-base"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="AUTOPHAGY">自噬</option>
                  <option value="SECRETORY_AUTOPHAGY">分泌性自噬</option>
                  <option value="EXOSOME">外泌体</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="check-prerequisite">
                  前置实验（可选）
                </label>
                <input
                  id="check-prerequisite"
                  className="input-base"
                  placeholder="例如：已经完成细胞处理或样本提取"
                  value={prerequisite}
                  onChange={(e) => setPrerequisite(e.target.value)}
                />
                <p className="field-hint">没有前置实验可留空。</p>
              </div>
            </div>

            <button className="button-primary w-full" type="submit" disabled={submitting || !labId}>
              {submitting ? (
                "检查中…"
              ) : (
                <>
                  <ExperimentIcon className="h-4 w-4" />
                  开始检查
                </>
              )}
            </button>
          </form>
        </section>

        <section className="app-panel px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-stone-900">检查结果</h2>
            </div>
            {submitting ? (
              <span className="status-pill warning">检查中</span>
            ) : result ? (
              <span className="status-pill success">已完成</span>
            ) : (
              <span className="glass-badge">待提交</span>
            )}
          </div>

          {submitting ? (
            <ResultSkeleton />
          ) : checkError ? (
            <div className="danger-panel text-sm" role="alert">
              {checkError}
            </div>
          ) : result?.needsConfirmation && result.suggestion ? (
            <SuggestionView suggestion={result.suggestion} />
          ) : result ? (
            <CheckResult {...result} />
          ) : (
            <div className="rounded-lg border border-dashed border-stone-300">
              <div className="empty-state">
                <ExperimentIcon className="mx-auto mb-3 h-7 w-7 text-stone-300" />
                <p>
                  选择实验类型，或手动输入实验名称，即可检查库存和必要条件。
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
