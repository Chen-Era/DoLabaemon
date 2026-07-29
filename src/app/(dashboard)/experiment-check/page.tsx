"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ExperimentIcon, LabsIcon, SearchIcon } from "@/components/common/app-icons";
import { toPlainLanguageTechniqueScope } from "@/lib/experiment-techniques/presentation";
import { requestJson } from "@/lib/http";

type Lab = { role: string; lab: { id: string; name: string } };

type Requirement = {
  id: string;
  kind: "REAGENT" | "CONSUMABLE" | "INSTRUMENT" | "SAMPLE" | "CONTROL" | "SOFTWARE";
  level: "REQUIRED" | "RECOMMENDED" | "CONDITIONAL";
  verificationMode: "AUTO_INVENTORY" | "MANUAL_CONFIRMATION";
  label: { zh: string; en: string };
};

type DirectionOption = {
  code: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  specializedReagents: { zh: string; en: string };
  targetRequirements: { zh: string; en: string };
  targetPanel: {
    mechanistic: string[];
    readout: string[];
    controls: string[];
  };
  ruleCount: number;
};

type DirectionGroup = {
  code: string;
  name: string;
};

const immuneDirectionCodes = new Set([
  "INFLAMMASOME",
  "T_CELL_ACTIVATION_EXHAUSTION",
  "B_CELL_HUMORAL_IMMUNITY",
  "NK_CELL_CYTOTOXICITY",
  "MYELOID_INNATE_IMMUNITY",
  "CHECKPOINT_IMMUNITY",
  "IMMUNE_METABOLISM",
  "ANTIGEN_PRESENTATION",
  "COMPLEMENT_FC_EFFECTOR",
  "IMMUNE_TRAFFICKING",
]);

const directionGroups: DirectionGroup[] = [
  { code: "IMMUNE", name: "免疫研究" },
  { code: "CELL_FATE", name: "细胞过程与命运" },
  { code: "METABOLISM", name: "代谢、细胞器与胞外囊泡" },
  { code: "MICROENVIRONMENT", name: "微环境、组织与细胞行为" },
  { code: "SIGNALING", name: "信号转导" },
  { code: "EPIGENETICS", name: "表观遗传与染色质" },
  { code: "OTHER", name: "其他常见研究专题" },
];

function directionGroupCode(directionCode: string) {
  if (immuneDirectionCodes.has(directionCode)) return "IMMUNE";
  if (
    [
      "AUTOPHAGY",
      "OXIDATIVE_STRESS",
      "APOPTOSIS_CELL_DEATH",
      "CELL_CYCLE_PROLIFERATION",
      "CELLULAR_SENESCENCE",
      "DNA_DAMAGE_RESPONSE",
      "ER_STRESS_PROTEOSTASIS",
      "FERROPTOSIS",
      "NECROPTOSIS",
      "LYSOSOMAL_FUNCTION",
      "CALCIUM_SIGNALING",
      "CIRCADIAN_RHYTHM",
    ].includes(directionCode)
  ) return "CELL_FATE";
  if (
    [
      "EXOSOME",
      "MITOCHONDRIAL_METABOLISM",
      "GLUCOSE_METABOLISM",
      "LIPID_METABOLISM",
    ].includes(directionCode)
  ) return "METABOLISM";
  if (
    [
      "EMT_MIGRATION_INVASION",
      "ECM_REMODELING",
      "HYPOXIA_ANGIOGENESIS",
      "EPITHELIAL_BARRIER",
      "STEMNESS_DIFFERENTIATION",
      "TUMOR_MICROENVIRONMENT",
      "CELL_ADHESION_CYTOSKELETON",
    ].includes(directionCode)
  ) return "MICROENVIRONMENT";
  if (
    [
      "TGF_BETA_SMAD_SIGNALING",
      "WNT_BETA_CATENIN_SIGNALING",
      "PI3K_AKT_MTOR_SIGNALING",
      "MAPK_ERK_SIGNALING",
      "NF_KAPPA_B_INFLAMMATION",
      "PROTEIN_PHOSPHORYLATION_KINASE_SIGNALING",
      "NOTCH_HEDGEHOG_SIGNALING",
    ].includes(directionCode)
  ) return "SIGNALING";
  if (
    [
      "EPIGENETIC_REPROGRAMMING",
      "DNA_METHYLATION_HYDROXYMETHYLATION",
      "HISTONE_ACETYLATION",
      "HISTONE_METHYLATION",
      "HISTONE_LACTYLATION",
      "CHROMATIN_ACCESSIBILITY_ARCHITECTURE",
    ].includes(directionCode)
  ) return "EPIGENETICS";
  return "OTHER";
}

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
  directionOptions?: DirectionOption[];
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

type AiCandidate = {
  code: string;
  slug: string;
  name: { zh: string; en: string };
  aliases: string[];
  categoryCode: string;
  riskLevel: string;
  confidence: number;
  rationale: string;
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
  directionCode?: string | null;
  direction?: DirectionOption | null;
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
    copy: "至少一项必需试剂未在库存中匹配，暂时不能开始实验。",
  },
  NEEDS_CONFIRMATION: {
    title: "NEEDS_CONFIRMATION · 等待人工确认",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    copy: "试剂检查没有阻断，但必需的仪器、耗材、样本、对照或软件仍需确认。",
  },
  READY: {
    title: "READY · 资源已就绪",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    copy: "所有必需资源都已在库存中匹配，或由人工确认。",
  },
  UNSUPPORTED: {
    title: "UNSUPPORTED · 暂不支持",
    className: "border-slate-300 bg-slate-100 text-slate-800",
    copy: "技术尚未发布、内容无效或资源要求不完整。没有可用规则时，系统不会给出通过结论。",
  },
};

export default function ExperimentCheckPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<TechniqueSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<AiCandidate[]>([]);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [selected, setSelected] = useState<TechniqueDetail | null>(null);
  const [profileCode, setProfileCode] = useState("");
  const [directionGroup, setDirectionGroup] = useState("");
  const [directionCode, setDirectionCode] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labsLoading, setLabsLoading] = useState(true);

  useEffect(() => {
    void requestJson<{ items?: Lab[] }>("/api/labs/my")
      .then(({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        const items = data?.items ?? [];
        setLabs(items);
        setLabId(items[0]?.lab.id ?? "");
        setLabsLoading(false);
      })
      .catch(() => setLabsLoading(false));
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
    setDirectionGroup("");
    setDirectionCode("");
    setConfirmedIds(new Set());
    setResult(null);
  }

  async function resolveInput() {
    if (!query.trim() || !labId) return;
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

  async function aiMatch() {
    if (!query.trim()) return;
    setAiMatching(true);
    setError(null);
    let response: Response;
    let data: {
      candidates?: AiCandidate[];
      notes?: string | null;
      error?: string;
    } | null;
    try {
      ({ response, data } = await requestJson<{
        candidates?: AiCandidate[];
        notes?: string | null;
        error?: string;
      }>("/api/experiment-techniques/ai-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, query: query.trim(), limit: 5 }),
        timeoutMs: 100000,
      }));
    } catch {
      setAiMatching(false);
      setError("AI 匹配请求超时或网络异常，请稍后重试或改用严格规则解析。");
      return;
    }
    setAiMatching(false);
    if (!response.ok) {
      setAiCandidates([]);
      setAiNotes(null);
      setError(data?.error ?? "AI 模糊匹配失败。");
      return;
    }
    const items = data?.candidates ?? [];
    setAiCandidates(items);
    setAiNotes(data?.notes ?? null);
    if (!items.length) {
      setError("AI 未在目录中找到合理匹配，可补充更具体的描述后重试。");
    }
  }

  const activeProfile = selected?.profiles.find(
    (profile) => profile.code === profileCode,
  );
  const activeDirection = selected?.directionOptions?.find(
    (domain) => domain.code === directionCode,
  );
  const groupedDirectionOptions = useMemo(() => {
    const groups = new Map<string, DirectionOption[]>();
    for (const option of selected?.directionOptions ?? []) {
      const groupCode = directionGroupCode(option.code);
      const options = groups.get(groupCode) ?? [];
      options.push(option);
      groups.set(groupCode, options);
    }
    return directionGroups
      .map((group) => ({ ...group, options: groups.get(group.code) ?? [] }))
      .filter((group) => group.options.length);
  }, [selected?.directionOptions]);
  const currentDirectionOptions = useMemo(
    () => groupedDirectionOptions.find((group) => group.code === directionGroup)?.options ?? [],
    [directionGroup, groupedDirectionOptions],
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
          directionCode: directionCode || null,
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

  const showNoLabs = !labsLoading && labs.length === 0;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          实验资源检查
        </h1>
        <p className="section-copy mt-1.5 max-w-3xl text-sm">
          选择具体技术后，可附加适用的表型／通路专题；系统会将方法要求与专题试剂规则一起核对库存。
        </p>
      </header>

      {showNoLabs ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <LabsIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-slate-950">你还没有加入任何实验室</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            可以先创建自己的实验室，或使用邀请码申请加入同事的实验室；加入后即可基于实验室库存运行资源检查。
          </p>
          <Link href="/labs" className="button-primary mt-5">
            前往实验室
          </Link>
        </section>
      ) : (
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
                  className="input-base input-with-leading-icon"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setAiCandidates([]);
                    setAiNotes(null);
                  }}
                  placeholder="如 RT-qPCR、FACS、夹心 ELISA"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!query.trim() || searching || aiMatching}
                  onClick={() => void resolveInput()}
                >
                  {searching ? "解析中…" : "严格规则解析"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!query.trim() || searching || aiMatching}
                  onClick={() => void aiMatch()}
                >
                  {aiMatching ? "AI 匹配中…" : "AI 模糊匹配"}
                </button>
              </div>
            </div>

            <div className="max-h-[33rem] space-y-2 overflow-y-auto pr-1">
              {aiCandidates.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-violet-700">
                      AI 候选（{aiCandidates.length}）
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        setAiCandidates([]);
                        setAiNotes(null);
                      }}
                    >
                      清除
                    </button>
                  </div>
                  {aiCandidates.map((candidate) => (
                    <button
                      key={candidate.code}
                      type="button"
                      onClick={() => void chooseTechnique(candidate.code)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected?.code === candidate.code
                          ? "border-violet-500 bg-violet-50"
                          : "border-violet-200 bg-violet-50/40 hover:border-violet-400 hover:bg-violet-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-violet-700">
                          {candidate.code}
                        </span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          AI {Math.round(candidate.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {candidate.name.zh}
                      </p>
                      <p className="text-xs text-slate-500">{candidate.name.en}</p>
                      {candidate.rationale ? (
                        <p className="mt-1 text-xs leading-5 text-violet-600">
                          {candidate.rationale}
                        </p>
                      ) : null}
                    </button>
                  ))}
                  {aiNotes ? (
                    <p className="rounded-lg bg-violet-50 px-3 py-2 text-[11px] leading-5 text-violet-600">
                      {aiNotes}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
                <p className="mt-3 text-sm leading-6 text-slate-400">{toPlainLanguageTechniqueScope(selected.scope.zh)}</p>
              </div>

              {selected.profiles.length ? (
                <div>
                  <label className="field-label" htmlFor="profile">方法应用 Profile（可选）</label>
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

              {selected.directionOptions?.length ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                  <p className="field-label text-violet-950">研究专题／通路（可选）</p>
                  <p className="mb-2 text-xs leading-5 text-violet-800">
                    先选择一级研究领域，再选择与所选技术匹配的二级专题；可与上方方法 Profile 同时使用。
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label text-xs text-violet-900" htmlFor="direction-group">
                        1. 一级研究领域
                      </label>
                      <select
                        id="direction-group"
                        className="input-base border-violet-200 bg-white"
                        value={directionGroup}
                        onChange={(event) => {
                          setDirectionGroup(event.target.value);
                          setDirectionCode("");
                          setConfirmedIds(new Set());
                          setResult(null);
                        }}
                      >
                        <option value="">请选择研究领域</option>
                        {groupedDirectionOptions.map((group) => (
                          <option key={group.code} value={group.code}>
                            {group.name}（{group.options.length}）
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label text-xs text-violet-900" htmlFor="direction">
                        2. 二级专题／通路
                      </label>
                      <select
                        id="direction"
                        className="input-base border-violet-200 bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                        value={directionCode}
                        disabled={!directionGroup}
                        onChange={(event) => {
                          setDirectionCode(event.target.value);
                          setConfirmedIds(new Set());
                          setResult(null);
                        }}
                      >
                        <option value="">
                          {directionGroup ? "请选择专题／通路" : "请先选择一级研究领域"}
                        </option>
                        {currentDirectionOptions.map((domain) => (
                          <option key={domain.code} value={domain.code}>
                            {domain.name.zh}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeDirection ? (
                <PathwayTopicPanel domain={activeDirection} />
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
                检查结果会显示为 BLOCKED、NEEDS_CONFIRMATION、READY 或 UNSUPPORTED。
              </div>
            ) : null}
            {result ? <ResultPanel result={result} /> : null}
          </div>
        </section>
      </form>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: CheckResult }) {
  const style = resultStyles[result.status];
  const directionItems = result.items.filter((item) =>
    item.requirementId.startsWith("direction:"),
  );
  const techniqueItems = result.items.filter(
    (item) => !item.requirementId.startsWith("direction:"),
  );
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${style.className}`}>
        <p className="font-semibold">{style.title}</p>
        <p className="mt-2 text-sm leading-6">{style.copy}</p>
      </div>
      {result.direction ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
          已附加专题：<span className="font-semibold">{result.direction.name.zh}</span>
          {result.direction.ruleCount ? `（${result.direction.ruleCount} 项专题库存规则）` : ""}
        </div>
      ) : null}
      {result.reasons.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
          {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}
      {directionItems.length ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
            专题／通路试剂检查
          </p>
          <ResultItems items={directionItems} tone="pathway" />
        </section>
      ) : null}
      <section>
        {directionItems.length ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            方法基础要求
          </p>
        ) : null}
        <ResultItems items={techniqueItems} />
      </section>
      {result.checkRunId ? (
        <p className="break-all font-mono text-[10px] text-slate-400">
          audit: {result.checkRunId}
        </p>
      ) : null}
    </div>
  );
}

function ResultItems({
  items,
  tone = "default",
}: {
  items: CheckItem[];
  tone?: "default" | "pathway";
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.requirementId}
          className={`rounded-lg border p-3 ${
            tone === "pathway" ? "border-violet-200 bg-violet-50/40" : "border-slate-200"
          }`}
        >
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
  );
}

function PathwayTopicPanel({ domain }: { domain: DirectionOption }) {
  const panels = [
    { label: "机制靶点", items: domain.targetPanel.mechanistic },
    { label: "核心读出", items: domain.targetPanel.readout },
    { label: "必要对照", items: domain.targetPanel.controls },
  ].filter((panel) => panel.items.length);

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4" aria-label={`${domain.name.zh}专题要求`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">专题检查要求</p>
          <h3 className="mt-1 text-base font-semibold text-violet-950">{domain.name.zh}</h3>
        </div>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
          {domain.ruleCount} 项库存规则
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-violet-950/85">{domain.description.zh}</p>

      <div className="mt-3 rounded-lg border border-violet-100 bg-white/80 p-3">
        <p className="text-xs font-semibold text-violet-900">建议专用试剂</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{domain.specializedReagents.zh}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.label} className="rounded-lg border border-violet-100 bg-white/80 p-3">
            <p className="text-xs font-semibold text-violet-900">{panel.label}</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
              {panel.items.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-violet-900/90">
        {domain.targetRequirements.zh} 运行检查后会将该专题的自动库存匹配结果一并列出。
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        所需试剂、靶点与对照仅供研究设计参考；请结合具体实验内容、研究对象的物种/来源、样本类型、模型特征及预期读出确认和调整。
      </p>
    </section>
  );
}
