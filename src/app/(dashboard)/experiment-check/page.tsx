"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckResult } from "@/components/experiment/check-result";
import { requestJson } from "@/lib/http";
import { experimentTypeCatalog } from "@/lib/rules/catalog";

type Lab = { role: string; lab: { id: string; name: string } };

type ExperimentCheckResponse = {
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

  useEffect(() => {
    requestJson<{ items?: Lab[] }>("/api/labs/my").then(({ response, data }) => {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const nextLabs = data?.items ?? [];
      setLabs(nextLabs);
      if (nextLabs.length) {
        setLabId(nextLabs[0].lab.id);
      }
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      }
    } catch {
      setResult(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Experiment Readiness</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">实验可行性判定</h1>
        <p className="section-copy mt-3 max-w-2xl text-sm md:text-base">
          系统会优先检查最低必需项，再给出推荐补充和风险提示，让实验准备结论更可解释。
        </p>
      </section>

      <div className="data-grid cols-2">
        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Input</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">输入实验参数</h2>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
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
            <div>
              <label className="field-label">输入方式</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    inputMode === "STANDARD"
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/5 text-zinc-300"
                  }`}
                  onClick={() => {
                    setInputMode("STANDARD");
                    setResult(null);
                  }}
                >
                  标准实验类型
                </button>
                <button
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    inputMode === "MANUAL"
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/5 text-zinc-300"
                  }`}
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
                {inputMode === "STANDARD" ? "实验类型" : "手动输入实验名称"}
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
                  placeholder="例如：western blot、ELISA、conditioned medium cytokine secretion assay"
                  value={customExperimentName}
                  onChange={(e) => setCustomExperimentName(e.target.value)}
                />
              )}
            </div>
            {inputMode === "MANUAL" ? (
              <div>
                <label className="field-label" htmlFor="check-context">
                  实验流程/上下文（可选）
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
            <div>
              <label className="field-label" htmlFor="check-direction">
                研究方向
              </label>
              <select id="check-direction" className="input-base" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="AUTOPHAGY">Autophagy</option>
                <option value="SECRETORY_AUTOPHAGY">Secretory autophagy</option>
                <option value="EXOSOME">Exosome</option>
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
            </div>
            <button className="button-primary w-full" type="submit">
              开始判定
            </button>
          </form>
        </section>

        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Result</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">判定结果</h2>
          </div>
          {result?.needsConfirmation && result.suggestion ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[rgba(242,190,87,0.32)] bg-[rgba(242,190,87,0.1)] px-5 py-5 text-[#ffe7a8]">
                <p className="text-sm font-semibold tracking-[0.16em] uppercase">Suggestion</p>
                <p className="mt-3 text-2xl font-semibold">{result.suggestion.proposedExperimentName}</p>
                <p className="mt-3 text-sm leading-7">
                  当前输入未能高置信归一为正式实验类型，系统先给出候选实验模板。请人工确认后再沉淀为正式类型。
                </p>
              </div>
              <div className="data-grid">
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                  <p className="text-zinc-400">建议归一到</p>
                  <p className="mt-3 leading-7 text-white">
                    {result.suggestion.matchedExistingCode || result.suggestion.proposedExperimentCode || "新实验候选"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                  <p className="text-zinc-400">建议置信度</p>
                  <p className="mt-3 leading-7 text-white">{result.suggestion.confidence.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                  <p className="text-zinc-400">流程阶段</p>
                  <p className="mt-3 leading-7 text-white">{result.suggestion.workflowStages.join("；") || "无"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                <p className="text-zinc-400">最低必需试剂</p>
                <p className="mt-3 leading-7 text-white">
                  {result.suggestion.minRequiredItems.map((item) => item.name).join("；") || "无"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                <p className="text-zinc-400">推荐补充试剂</p>
                <p className="mt-3 leading-7 text-white">
                  {result.suggestion.recommendedItems.map((item) => item.name).join("；") || "无"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm">
                <p className="text-zinc-400">说明与警告</p>
                <p className="mt-3 leading-7 text-white">
                  {[result.suggestion.rationale, ...result.suggestion.warnings].filter(Boolean).join("；") || "无"}
                </p>
              </div>
            </div>
          ) : result ? (
            <CheckResult {...result} />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 px-5 py-8 text-sm text-zinc-400">
              选择标准实验类型，或手动输入实验名称后提交，即可查看库存判定结果；若暂未高置信匹配，系统会先给出候选实验模板和试剂配置。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
