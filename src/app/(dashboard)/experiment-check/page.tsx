"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ExperimentIcon, SearchIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";

type Lab = { role: string; lab: { id: string; name: string } };

type Requirement = {
  id: string;
  kind: "REAGENT" | "CONSUMABLE" | "INSTRUMENT" | "SAMPLE" | "CONTROL" | "SOFTWARE";
  level: "REQUIRED" | "RECOMMENDED" | "CONDITIONAL";
  verificationMode: "AUTO_INVENTORY" | "MANUAL_CONFIRMATION";
  label: { zh: string; en: string };
};

type TechniqueDetail = {
  code: string;
  slug: string;
  revision: number;
  status: string;
  name: { zh: string; en: string };
  scope: { zh: string; en: string };
  categoryCode: string;
  requirements: Requirement[];
  profiles: Array<{
    code: string;
    name: { zh: string; en: string };
    description: { zh: string; en: string };
    additionalRequirements: Requirement[];
  }>;
};

type TechniqueSummary = {
  code: string;
  slug: string;
  status: string;
  name: { zh: string; en: string };
  aliases: string[];
  category: { zh: string; en: string };
  riskLevel: string;
};

type SearchResponse = {
  items: TechniqueSummary[];
  total: number;
  page: number;
  pageCount: number;
};

type CheckItem = {
  requirementId: string;
  label: string;
  kind: string;
  level: string;
  verificationMode: string;
  state: "MATCHED" | "MISSING" | "CONFIRMED" | "UNCONFIRMED" | "NOT_APPLICABLE";
  matchedName?: string;
};

type CheckResult = {
  techniqueCode: string;
  profileCode: string | null;
  status: "BLOCKED" | "NEEDS_CONFIRMATION" | "READY" | "UNSUPPORTED";
  items: CheckItem[];
  reasons: string[];
  checkRunId?: string | null;
  error?: string;
};

const kindLabels: Record<string, string> = {
  REAGENT: "试剂",
  CONSUMABLE: "耗材",
  INSTRUMENT: "仪器",
  SAMPLE: "样本",
  CONTROL: "对照",
  SOFTWARE: "软件",
};

const resultStyles: Record<CheckResult["status"], { title: string; className: string; copy: string }> = {
  BLOCKED: {
    title: "BLOCKED · 缺少必需试剂",
    className: "border-rose-200 bg-rose-50 text-rose-900",
    copy: "至少一项可由库存自动验证的必需试剂未匹配，当前不可开展。",
  },
  NEEDS_CONFIRMATION: {
    title: "NEEDS_CONFIRMATION · 等待人工确认",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    copy: "试剂检查未阻断，但仍有必需仪器、耗材、样本、对照或软件需要确认。",
  },
  READY: {
    title: "READY · 资源已就绪",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    copy: "全部必需资源已由库存验证或人工确认。",
  },
  UNSUPPORTED: {
    title: "UNSUPPORTED · 暂不支持",
    className: "border-slate-300 bg-slate-100 text-slate-800",
    copy: "技术未发布、结构无效或资源要求不完整；零规则绝不会返回通过。",
  },
};

export default function ExperimentCheckPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<TechniqueSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TechniqueDetail | null>(null);
  const [profileCode, setProfileCode] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void requestJson<{ items?: Lab[] }>("/api/labs/my").then(
      ({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        const items = data?.items ?? [];
        setLabs(items);
        setLabId(items[0]?.lab.id ?? "");
      },
    );
  }, []);

  const search = useCallback(async (value: string) => {
    setSearching(true);
    const params = new URLSearchParams({
      q: value.trim(),
      page: "1",
      pageSize: "20",
      status: "PUBLISHED",
    });
    const { response, data } = await requestJson<SearchResponse>(
      `/api/experiment-techniques?${params.toString()}`,
    );
    if (response.ok) setCandidates(data?.items ?? []);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), 180);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  async function chooseTechnique(code: string) {
    setError(null);
    const { response, data } = await requestJson<{
      technique?: TechniqueDetail;
      error?: string;
    }>(`/api/experiment-techniques/${encodeURIComponent(code)}`);
    if (!response.ok || !data?.technique) {
      setError(data?.error ?? "读取技术详情失败。");
      return;
    }
    setSelected(data.technique);
    setProfileCode("");
    setConfirmedIds(new Set());
    setResult(null);
  }

  async function resolveInput() {
    if (!query.trim()) return;
    setSearching(true);
    const { response, data } = await requestJson<{
      autoSelectedCode?: string | null;
      candidates?: TechniqueSummary[];
      error?: string;
    }>("/api/experiment-techniques/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), limit: 8 }),
    });
    setSearching(false);
    if (!response.ok) {
      setError(data?.error ?? "名称解析失败。");
      return;
    }
    if (data?.autoSelectedCode) {
      await chooseTechnique(data.autoSelectedCode);
      return;
    }
    setError("未得到唯一精确命中，请从排序候选中人工选择。");
  }

  const activeProfile = selected?.profiles.find(
    (profile) => profile.code === profileCode,
  );
  const requirements = useMemo(
    () => [
      ...(selected?.requirements ?? []),
      ...(activeProfile?.additionalRequirements ?? []),
    ],
    [activeProfile, selected],
  );

  const groupedRequirements = useMemo(() => {
    const groups = new Map<string, Requirement[]>();
    for (const requirement of requirements) {
      const group = groups.get(requirement.kind) ?? [];
      group.push(requirement);
      groups.set(requirement.kind, group);
    }
    return [...groups.entries()];
  }, [requirements]);

  function toggleConfirmation(id: string) {
    setConfirmedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!labId || !selected) {
      setError("请先选择实验室和具体技术。");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { response, data } = await requestJson<CheckResult>(
      "/api/experiment-checks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          techniqueCode: selected.code,
          profileCode: profileCode || null,
          confirmedRequirementIds: [...confirmedIds],
        }),
      },
    );
    setSubmitting(false);
    if (!response.ok || !data) {
      setError(data?.error ?? "检查失败。");
      return;
    }
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          实验资源检查
        </h1>
        <p className="section-copy mt-1.5 max-w-3xl text-sm">
          从服务端技术目录选择叶子技术，自动匹配库存试剂，并人工确认非库存资源。
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)_24rem] xl:items-start"
      >
        <section className="app-panel overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">1. 选择技术</h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="field-label" htmlFor="check-lab">实验室</label>
              <select
                id="check-lab"
                className="input-base"
                value={labId}
                onChange={(event) => setLabId(event.target.value)}
              >
                {labs.map((item) => (
                  <option key={item.lab.id} value={item.lab.id}>
                    {item.lab.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="technique-search">
                中英文名称、code 或别名
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="technique-search"
                  className="input-base pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="如 RT-qPCR、FACS、夹心 ELISA"
                />
              </div>
              <button
                type="button"
                className="button-secondary mt-2 w-full"
                disabled={!query.trim() || searching}
                onClick={() => void resolveInput()}
              >
                {searching ? "解析中…" : "按严格规则解析"}
              </button>
            </div>

            <div className="max-h-[33rem] space-y-2 overflow-y-auto pr-1">
              {candidates.map((candidate) => (
                <button
                  key={candidate.code}
                  type="button"
                  onClick={() => void chooseTechnique(candidate.code)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected?.code === candidate.code
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 hover:border-teal-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold text-teal-700">
                      {candidate.code}
                    </span>
                    <span className="text-[10px] text-slate-400">{candidate.riskLevel}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {candidate.name.zh}
                  </p>
                  <p className="text-xs text-slate-500">{candidate.name.en}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="app-panel overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">2. 核对具体要求</h2>
          </div>
          {!selected ? (
            <div className="p-10 text-center text-sm text-slate-500">
              从左侧候选中选择边界清晰的叶子技术。
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <p className="font-mono text-xs text-teal-200">
                  {selected.code} · r{selected.revision}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{selected.name.zh}</h3>
                <p className="text-sm text-slate-300">{selected.name.en}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{selected.scope.zh}</p>
                <Link
                  href={`/knowledge/techniques/${encodeURIComponent(selected.code)}`}
                  className="mt-3 inline-block text-xs font-semibold text-teal-200 hover:text-white"
                >
                  查看完整知识条目 →
                </Link>
              </div>

              {selected.profiles.length ? (
                <div>
                  <label className="field-label" htmlFor="profile">应用 Profile（可选）</label>
                  <select
                    id="profile"
                    className="input-base"
                    value={profileCode}
                    onChange={(event) => {
                      setProfileCode(event.target.value);
                      setConfirmedIds(new Set());
                      setResult(null);
                    }}
                  >
                    <option value="">通用要求</option>
                    {selected.profiles.map((profile) => (
                      <option key={profile.code} value={profile.code}>
                        {profile.name.zh}
                      </option>
                    ))}
                  </select>
                  {activeProfile ? (
                    <p className="field-hint">{activeProfile.description.zh}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-5">
                {groupedRequirements.map(([kind, items]) => (
                  <section key={kind}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {kindLabels[kind] ?? kind}
                      </h3>
                      <span className="text-xs text-slate-400">{items.length} 项</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((requirement) => {
                        const automatic =
                          requirement.verificationMode === "AUTO_INVENTORY";
                        return (
                          <label
                            key={requirement.id}
                            className={`flex gap-3 rounded-lg border p-3 ${
                              automatic
                                ? "border-cyan-200 bg-cyan-50/60"
                                : confirmedIds.has(requirement.id)
                                  ? "border-emerald-300 bg-emerald-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-teal-700"
                              checked={
                                automatic || confirmedIds.has(requirement.id)
                              }
                              disabled={automatic}
                              onChange={() => toggleConfirmation(requirement.id)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800">
                                {requirement.label.zh}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {requirement.level} ·{" "}
                                {automatic ? "库存自动验证" : "人工确认"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <button
                type="submit"
                className="button-primary w-full"
                disabled={!labId || submitting}
              >
                <ExperimentIcon className="h-4 w-4" />
                {submitting ? "检查中…" : "运行资源检查"}
              </button>
            </div>
          )}
        </section>

        <section className="app-panel overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">3. 检查结果</h2>
          </div>
          <div className="p-4">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                {error}
              </div>
            ) : null}
            {!result && !error ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                结果固定为 BLOCKED、NEEDS_CONFIRMATION、READY 或 UNSUPPORTED。
              </div>
            ) : null}
            {result ? <ResultPanel result={result} /> : null}
          </div>
        </section>
      </form>
    </div>
  );
}

function ResultPanel({ result }: { result: CheckResult }) {
  const style = resultStyles[result.status];
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${style.className}`}>
        <p className="font-semibold">{style.title}</p>
        <p className="mt-2 text-sm leading-6">{style.copy}</p>
      </div>
      {result.reasons.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
          {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}
      <div className="space-y-2">
        {result.items.map((item) => (
          <div key={item.requirementId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                item.state === "MATCHED" || item.state === "CONFIRMED"
                  ? "bg-emerald-50 text-emerald-700"
                  : item.state === "MISSING"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {item.state}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {kindLabels[item.kind] ?? item.kind} · {item.level}
              {item.matchedName ? ` · ${item.matchedName}` : ""}
            </p>
          </div>
        ))}
      </div>
      {result.checkRunId ? (
        <p className="break-all font-mono text-[10px] text-slate-400">
          audit: {result.checkRunId}
        </p>
      ) : null}
    </div>
  );
}
