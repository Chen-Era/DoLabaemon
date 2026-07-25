"use client";

import { useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/http";

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

function formatTime(value?: string | null) {
  if (!value) return "未记录";
  try {
    return new Date(value).toLocaleString("zh-CN");
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
      typeof data.canonicalName === "string" ? `名称: ${data.canonicalName}` : null,
      typeof data.category === "string" ? `类别: ${data.category}` : null,
      typeof data.subCategory === "string" ? `子类: ${data.subCategory}` : null,
      Array.isArray(data.experimentTags) ? `标签: ${data.experimentTags.slice(0, 4).join("、") || "无"}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return [
    typeof data.canonicalName === "string" ? `名称: ${data.canonicalName}` : null,
    typeof data.normalizedCode === "string" ? `代码: ${data.normalizedCode}` : null,
    Array.isArray(data.workflowStages) ? `流程阶段: ${data.workflowStages.length}` : null,
    Array.isArray(data.requiredReagentTemplates) ? `最低必需: ${data.requiredReagentTemplates.length}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function KnowledgePage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [items, setItems] = useState<KnowledgeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadLogs(nextLabId: string) {
    if (!nextLabId) return;
    setLoading(true);
    try {
      const { response, data } = await requestJson<{ items?: KnowledgeLog[]; error?: string }>(
        `/api/knowledge/logs?labId=${encodeURIComponent(nextLabId)}`,
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setItems([]);
        setMsg(data?.error ?? "加载知识审计失败");
        return;
      }
      setItems(data?.items ?? []);
      setMsg(null);
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    requestJson<{ items?: Lab[] }>("/api/labs/my").then(({ response, data }) => {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const nextLabs = data?.items ?? [];
      setLabs(nextLabs);
      const nextLabId = nextLabs[0]?.lab.id ?? "";
      setLabId(nextLabId);
      if (nextLabId) {
        loadLogs(nextLabId);
      }
    });
  }, []);

  useEffect(() => {
    if (labId) {
      loadLogs(labId);
    }
  }, [labId]);

  async function onRollback(logId: string) {
    setRollingBackId(logId);
    setMsg(null);
    try {
      const { response, data } = await requestJson<{ error?: string; rolledBackAt?: string }>("/api/knowledge/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      if (!response.ok) {
        setMsg(data?.error ?? "回滚失败");
        return;
      }
      setMsg("已执行回滚。");
      await loadLogs(labId);
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setRollingBackId(null);
    }
  }

  const stats = useMemo(() => {
    const total = items.length;
    const applied = items.filter((item) => item.status === "APPLIED").length;
    const rolledBack = items.filter((item) => item.status === "ROLLED_BACK").length;
    return { total, applied, rolledBack };
  }, [items]);

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Knowledge Audit</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">知识管理与审计</h1>
            <p className="section-copy mt-3 max-w-3xl text-sm md:text-base">
              查看模型学习写回记录、比对变更前后内容，并在需要时执行回滚，保证共享知识资产可追踪、可恢复。
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label className="field-label" htmlFor="knowledge-lab">
              当前实验室
            </label>
            <select id="knowledge-lab" className="input-base" value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.map((item) => (
                <option key={item.lab.id} value={item.lab.id}>
                  {item.lab.name} / {item.role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="data-grid cols-3">
        <div className="kpi-card px-5 py-5">
          <p className="kpi-label">Total Logs</p>
          <p className="metric-value mt-3">{stats.total}</p>
          <p className="section-copy mt-2 text-sm">当前实验室的知识变更日志总数。</p>
        </div>
        <div className="kpi-card px-5 py-5">
          <p className="kpi-label">Applied</p>
          <p className="metric-value mt-3">{stats.applied}</p>
          <p className="section-copy mt-2 text-sm">已真正写入知识表的变更。</p>
        </div>
        <div className="kpi-card px-5 py-5">
          <p className="kpi-label">Rolled Back</p>
          <p className="metric-value mt-3">{stats.rolledBack}</p>
          <p className="section-copy mt-2 text-sm">已经恢复到旧状态的变更。</p>
        </div>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker">Mutation Logs</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">知识变更记录</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-pill">当前条目 {items.length}</span>
            <span className="glass-badge">{loading ? "加载中" : "已同步"}</span>
          </div>
        </div>
        {msg ? <p className={`mb-4 text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}>{msg}</p> : null}
        <div className="space-y-4">
          {items.map((item) => {
            const rollbackDisabled = item.status !== "APPLIED" || Boolean(item.rolledBackAt);
            return (
              <article key={item.id} className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-pill">{item.domain}</span>
                      <span className="glass-badge">{item.flowType}</span>
                      <span className={`glass-badge ${item.status === "ROLLED_BACK" ? "danger-panel" : ""}`.trim()}>{item.status}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.entityKey}</h3>
                    <p className="text-sm text-slate-500">
                      创建时间 {formatTime(item.createdAt)}{item.rolledBackAt ? ` | 已回滚 ${formatTime(item.rolledBackAt)}` : ""}
                    </p>
                    <p className="text-sm text-slate-600">
                      模型 {item.modelName || "未记录"} | 用户 {item.userId}
                    </p>
                    {item.evidenceSummary?.length ? (
                      <p className="text-sm text-slate-600">证据摘要：{item.evidenceSummary.join("；")}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={rollbackDisabled || rollingBackId === item.id}
                    onClick={() => onRollback(item.id)}
                  >
                    {rollingBackId === item.id ? "回滚中..." : "回滚此变更"}
                  </button>
                </div>

                <div className="mt-5 data-grid cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-slate-500">变更前摘要</p>
                    <p className="mt-2 text-sm leading-7 text-slate-900">{summarizeKnowledge(item, item.beforeData) || "无"}</p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-slate-500">查看原始 JSON</summary>
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950/95 p-4 text-xs leading-6 text-slate-100">
                        {prettyJson(item.beforeData)}
                      </pre>
                    </details>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-slate-500">变更后摘要</p>
                    <p className="mt-2 text-sm leading-7 text-slate-900">{summarizeKnowledge(item, item.afterData) || "无"}</p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-slate-500">查看原始 JSON</summary>
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950/95 p-4 text-xs leading-6 text-slate-100">
                        {prettyJson(item.afterData)}
                      </pre>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}

          {!items.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">
              当前实验室还没有知识变更记录。后续当试剂解析或实验解析触发学习写回时，这里会展示审计日志。
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
