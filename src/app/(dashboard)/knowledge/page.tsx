"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, CheckIcon, KnowledgeIcon, SearchIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";
import { reagentCategoryLabel } from "@/lib/reagent-category";

type Lab = { role: "PI" | "ADMIN" | "MEMBER"; lab: { id: string; name: string } };

type KnowledgeLog = {
  id: string;
  labId: string;
  userId: string;
  flowType: string;
  domain: string;
  entityKey: string;
  status: string;
  beforeData?: unknown;
  afterData?: unknown;
  evidenceSummary?: string[];
  modelName?: string | null;
  rolledBackAt?: string | null;
  createdAt: string;
};

type FilterValue = "ALL" | "APPLIED" | "ROLLED_BACK";
type DomainFilter = "ALL" | "REAGENT" | "EXPERIMENT";
type Notice = { kind: "success" | "error"; text: string };

function formatTime(value?: string | null) {
  if (!value) return "未记录";
  try {
    return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function prettyJson(value: unknown) {
  if (value === undefined || value === null) return "无";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeKnowledge(log: KnowledgeLog, value: unknown) {
  if (!value || typeof value !== "object") return "无";
  const data = value as Record<string, unknown>;

  if (log.domain === "REAGENT") {
    return [
      typeof data.canonicalName === "string" ? `名称：${data.canonicalName}` : null,
      typeof data.category === "string" ? `类别：${reagentCategoryLabel(data.category)}` : null,
      typeof data.subCategory === "string" ? `子类：${data.subCategory}` : null,
      Array.isArray(data.experimentTags) ? `标签：${data.experimentTags.slice(0, 4).join("、") || "无"}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    typeof data.canonicalName === "string" ? `名称：${data.canonicalName}` : null,
    typeof data.normalizedCode === "string" ? `代码：${data.normalizedCode}` : null,
    Array.isArray(data.workflowStages) ? `流程阶段：${data.workflowStages.length}` : null,
    Array.isArray(data.requiredReagentTemplates) ? `最低必需：${data.requiredReagentTemplates.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function statusStyle(status: string) {
  if (status === "APPLIED") {
    return { label: "已生效", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  }
  if (status === "ROLLED_BACK") {
    return { label: "已回滚", className: "border-slate-200 bg-slate-100 text-slate-600", dot: "bg-slate-400" };
  }
  return { label: status, className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
}

function domainStyle(domain: string) {
  return domain === "REAGENT"
    ? "border-cyan-200 bg-cyan-50 text-cyan-700"
    : "border-violet-200 bg-violet-50 text-violet-700";
}

function domainLabel(domain: string) {
  if (domain === "REAGENT") return "试剂知识";
  if (domain === "EXPERIMENT") return "实验知识";
  return "其他知识";
}

function flowLabel(flowType: string) {
  if (flowType === "reagent-parse") return "试剂解析";
  if (flowType === "experiment-resolve") return "实验解析";
  return "知识写入";
}

function roleLabel(role: Lab["role"]) {
  if (role === "PI") return "负责人";
  if (role === "ADMIN") return "管理员";
  return "成员";
}

function SummaryPanel({ title, value, tone }: { title: string; value: string; tone: "before" | "after" }) {
  const after = tone === "after";
  return (
    <div className={`rounded-xl border p-4 ${after ? "border-emerald-100 bg-emerald-50/35" : "border-slate-200 bg-slate-50/70"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${after ? "bg-emerald-500" : "bg-slate-400"}`} />
        <p className="text-xs font-semibold tracking-[0.11em] text-slate-500 uppercase">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-700">{value || "无"}</p>
    </div>
  );
}

export default function KnowledgePage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [items, setItems] = useState<KnowledgeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterValue>("ALL");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("ALL");
  const logRequestIdRef = useRef(0);
  const activeLabIdRef = useRef(labId);
  activeLabIdRef.current = labId;

  const loadLogs = useCallback(async (nextLabId: string, preserveNotice = false) => {
    if (!nextLabId) return;
    const requestId = ++logRequestIdRef.current;
    setLoading(true);
    if (!preserveNotice) setNotice(null);
    try {
      const { response, data } = await requestJson<{ items?: KnowledgeLog[]; error?: string }>(
        `/api/knowledge/logs?labId=${encodeURIComponent(nextLabId)}`,
      );
      if (response.status === 401) {
        if (requestId === logRequestIdRef.current) window.location.href = "/login";
        return;
      }
      if (requestId !== logRequestIdRef.current) return;
      if (!response.ok) {
        setItems([]);
        setNotice({ kind: "error", text: data?.error ?? "读取变更记录失败，请稍后重试。" });
        return;
      }
      setItems(data?.items ?? []);
      setLastSyncedAt(new Date());
    } catch {
      if (requestId === logRequestIdRef.current) setNotice({ kind: "error", text: "网络异常，暂时无法读取变更记录。" });
    } finally {
      if (requestId === logRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadLabs() {
      setLoading(true);
      try {
        const { response, data } = await requestJson<{ items?: Lab[]; error?: string }>("/api/labs/my");
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          if (isCurrent) {
            setNotice({ kind: "error", text: data?.error ?? "无法读取实验室列表。" });
            setLoading(false);
          }
          return;
        }
        if (!isCurrent) return;
        const nextLabs = data?.items ?? [];
        setLabs(nextLabs);
        setLabId(nextLabs[0]?.lab.id ?? "");
        if (!nextLabs.length) setLoading(false);
      } catch {
        if (isCurrent) {
          setNotice({ kind: "error", text: "网络异常，暂时无法读取实验室列表。" });
          setLoading(false);
        }
      }
    }

    void loadLabs();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (labId) void loadLogs(labId);
  }, [labId, loadLogs]);

  async function onRollback(log: KnowledgeLog) {
    const sourceLabId = labId;
    const membership = labs.find((lab) => lab.lab.id === sourceLabId);
    if (!membership || !["PI", "ADMIN"].includes(membership.role)) {
      setNotice({ kind: "error", text: "只有该实验室的负责人或管理员可以恢复知识的旧版本。" });
      return;
    }
    const confirmed = window.confirm(`确定回滚“${log.entityKey}”这条知识变更吗？回滚会恢复该条记录对应的旧数据。`);
    if (!confirmed) return;

    setRollingBackId(log.id);
    setNotice(null);
    try {
      const { response, data } = await requestJson<{ error?: string; rolledBackAt?: string }>("/api/knowledge/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      });
      if (activeLabIdRef.current !== sourceLabId) return;
      if (!response.ok) {
        setNotice({ kind: "error", text: data?.error ?? "回滚失败，请稍后重试。" });
        return;
      }
      setNotice({ kind: "success", text: "已恢复旧版本，变更记录已同步更新。" });
      await loadLogs(sourceLabId, true);
    } catch {
      if (activeLabIdRef.current === sourceLabId) setNotice({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setRollingBackId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchesDomain = domainFilter === "ALL" || item.domain === domainFilter;
      const searchable = [item.entityKey, item.domain, item.flowType, item.modelName, item.userId].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesDomain && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [domainFilter, items, query, statusFilter]);

  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== "ALL" || domainFilter !== "ALL";
  const currentMembership = labs.find((lab) => lab.lab.id === labId);
  const canRollback = Boolean(currentMembership && ["PI", "ADMIN"].includes(currentMembership.role));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-6 py-6 text-white shadow-[0_16px_42px_rgba(15,23,42,0.13)] md:px-8 md:py-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-violet-300/15 bg-violet-300/10 blur-2xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-[23%] h-40 w-40 rounded-full border border-cyan-300/10 bg-cyan-400/10 blur-xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200/20 bg-violet-200/10 text-violet-100">
              <KnowledgeIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">变更记录</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">查看知识变更，并在需要时恢复旧版本。</p>
            </div>
          </div>
          <p className="text-sm text-violet-100">
            {currentMembership?.lab.name ?? "未选择实验室"}
            {lastSyncedAt ? ` · ${formatTime(lastSyncedAt.toISOString())}` : loading ? " · 正在同步…" : ""}
          </p>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">变更记录</h2>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">可按实验室、状态或领域筛选记录。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-amber-500" : "bg-emerald-500"}`} />
              {loading ? "同步中" : "已同步"}
            </span>
            <button type="button" className="button-secondary" onClick={() => void loadLogs(labId)} disabled={!labId || loading}>
              重新同步
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_12rem] lg:items-end">
          <div>
            <label className="field-label" htmlFor="knowledge-search">
              搜索记录
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="knowledge-search"
                className="input-base pl-9"
                placeholder="名称、流程、模型或用户"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="knowledge-lab">
              实验室
            </label>
            <select id="knowledge-lab" className="input-base" value={labId} onChange={(event) => setLabId(event.target.value)} disabled={!labs.length}>
              {labs.length ? (
                labs.map((lab) => (
                  <option key={lab.lab.id} value={lab.lab.id}>
                    {lab.lab.name} / {roleLabel(lab.role)}
                  </option>
                ))
              ) : (
                <option value="">暂无实验室</option>
              )}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="knowledge-status">
              变更状态
            </label>
            <select id="knowledge-status" className="input-base" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue)}>
              <option value="ALL">全部状态</option>
              <option value="APPLIED">已生效</option>
              <option value="ROLLED_BACK">已回滚</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="knowledge-domain">
              记录类型
            </label>
            <select id="knowledge-domain" className="input-base" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}>
              <option value="ALL">全部领域</option>
              <option value="REAGENT">试剂</option>
              <option value="EXPERIMENT">实验</option>
            </select>
          </div>
        </div>

        {notice ? (
          <div
            className={`mx-5 mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-6 ${
              notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.kind === "error" ? <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />}
            {notice.text}
          </div>
        ) : null}

        <div className="px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {loading ? "正在读取变更记录…" : `显示 ${filteredItems.length} / ${items.length} 条记录`}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("ALL");
                  setDomainFilter("ALL");
                }}
              >
                清除筛选
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="正在加载知识变更记录">
              {[0, 1].map((item) => (
                <div key={item} className="h-56 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filteredItems.length ? (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const status = statusStyle(item.status);
                const rollbackDisabled = item.status !== "APPLIED" || Boolean(item.rolledBackAt);
                return (
                  <article key={item.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <span className={`absolute inset-y-0 left-0 w-1 ${status.dot}`} aria-hidden="true" />
                    <div className="px-5 py-5 pl-6">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${domainStyle(item.domain)}`}>{domainLabel(item.domain)}</span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{flowLabel(item.flowType)}</span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <h3 className="mt-3 truncate text-lg font-semibold tracking-tight text-slate-950">{item.entityKey}</h3>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span>写入于 {formatTime(item.createdAt)}</span>
                            <span>模型：{item.modelName || "未记录"}</span>
                            <span className="font-mono text-xs">用户：{item.userId}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="button-secondary shrink-0"
                          disabled={rollbackDisabled || !canRollback || rollingBackId === item.id}
                          onClick={() => void onRollback(item)}
                          title={rollbackDisabled ? "只有当前已生效的变更可以恢复旧版本" : !canRollback ? "只有负责人或管理员可以恢复旧版本" : undefined}
                        >
                          {rollingBackId === item.id ? "正在恢复…" : !canRollback ? "无回滚权限" : rollbackDisabled ? "不可回滚" : "恢复旧版本"}
                        </button>
                      </div>

                      {item.evidenceSummary?.length ? (
                        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900">
                          <span className="font-semibold">变更依据：</span>
                          {item.evidenceSummary.join("；")}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <SummaryPanel title="变更前" value={summarizeKnowledge(item, item.beforeData)} tone="before" />
                        <SummaryPanel title="变更后" value={summarizeKnowledge(item, item.afterData)} tone="after" />
                      </div>

                      <details className="group mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-600 marker:hidden">
                          <span className="flex items-center justify-between gap-3">
                            查看原始数据
                            <span className="text-xs font-medium text-slate-400 transition group-open:rotate-180">⌄</span>
                          </span>
                        </summary>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{prettyJson(item.beforeData)}</pre>
                          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{prettyJson(item.afterData)}</pre>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                <KnowledgeIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-950">{hasActiveFilters ? "没有匹配的变更记录" : "当前还没有变更记录"}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {hasActiveFilters ? "调整关键词或筛选条件后再试。" : "试剂或实验信息发生更新后，这里会保留前后版本。"}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
