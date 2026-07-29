"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CheckIcon,
  KnowledgeIcon,
  LabsIcon,
  SearchIcon,
} from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";

type Lab = {
  role: "PI" | "ADMIN" | "MEMBER";
  lab: { id: string; name: string };
};

type Category = { code: string; zh: string; en: string };

type TechniqueSummary = {
  code: string;
  slug: string;
  revision: number;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "DEPRECATED";
  source: string;
  name: { zh: string; en: string };
  aliases: string[];
  categoryCode: string;
  category: { zh: string; en: string };
  subcategoryCode: string;
  sampleTypes: string[];
  readoutModes: string[];
  throughput: string;
  destructive: boolean;
  riskLevel: string;
  evidenceTiers: string[];
  profileCodes: string[];
};

type TechniquePage = {
  items: TechniqueSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  categories: Category[];
};

type TechniqueDraft = {
  id: string;
  labId: string;
  createdById: string;
  baseCode: string | null;
  baseRevision: number | null;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  source: "CURATED" | "AI_DRAFT";
  payload: Record<string, unknown>;
  reviewerId: string | null;
  reviewNote: string;
  updatedAt: string;
};

type KnowledgeLog = {
  id: string;
  flowType: string;
  domain: string;
  entityKey: string;
  status: string;
  evidenceSummary?: string[];
  createdAt: string;
  rolledBackAt?: string | null;
};

type Tab = "ATLAS" | "DRAFTS" | "AUDIT";
type Notice = { kind: "success" | "error"; text: string };

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "审核中",
  PUBLISHED: "已发布",
  DEPRECATED: "已停用",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "PUBLISHED" || status === "APPROVED" || status === "APPLIED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "IN_REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "REJECTED" || status === "DEPRECATED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("ATLAS");
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
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

  const membership = labs.find((item) => item.lab.id === labId);
  const canReview = Boolean(
    membership && ["PI", "ADMIN"].includes(membership.role),
  );
  const showNoLabs = !labsLoading && labs.length === 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-6 py-7 text-white shadow-[0_16px_42px_rgba(15,23,42,0.13)] md:px-8">
        <div
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200/20 bg-teal-200/10 text-teal-100">
              <KnowledgeIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                实验技术知识库
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                收录 335 项湿实验和仪器技术，包含资源要求、操作流程、质量控制、安全信息、证据和修订记录。
              </p>
            </div>
          </div>
          {showNoLabs ? null : (
            <div className="min-w-56">
              <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="knowledge-lab">
                当前实验室
              </label>
              <select
                id="knowledge-lab"
                className="input-base border-slate-600 bg-slate-900 text-white"
                value={labId}
                onChange={(event) => setLabId(event.target.value)}
              >
                {labs.map((item) => (
                  <option key={item.lab.id} value={item.lab.id}>
                    {item.lab.name} · {item.role}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {showNoLabs ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <LabsIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-slate-950">你还没有加入任何实验室</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            可以先创建自己的实验室，或使用邀请码申请加入同事的实验室；加入后即可浏览技术图谱并管理实验室私有草稿。
          </p>
          <Link href="/labs" className="button-primary mt-5">
            前往实验室
          </Link>
        </section>
      ) : (
      <>
      <nav
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2"
        aria-label="知识库视图"
      >
        {([
          ["ATLAS", "技术图谱"],
          ["DRAFTS", "待审核草稿"],
          ["AUDIT", "变更审计"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setNotice(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === value
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
            aria-pressed={tab === value}
          >
            {label}
          </button>
        ))}
      </nav>

      {notice ? (
        <div
          className={
            notice.kind === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      {tab === "ATLAS" ? (
        <TechniqueAtlas
          labId={labId}
          onNotice={setNotice}
          onDraftCreated={() => setTab("DRAFTS")}
        />
      ) : null}
      {tab === "DRAFTS" ? (
        <DraftQueue
          labId={labId}
          canReview={canReview}
          onNotice={setNotice}
        />
      ) : null}
      {tab === "AUDIT" ? (
        <AuditLog labId={labId} onNotice={setNotice} />
      ) : null}
      </>
      )}
    </div>
  );
}

function TechniqueAtlas({
  labId,
  onNotice,
  onDraftCreated,
}: {
  labId: string;
  onNotice: (notice: Notice) => void;
  onDraftCreated: () => void;
}) {
  const [result, setResult] = useState<TechniquePage | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sample, setSample] = useState("");
  const [readout, setReadout] = useState("");
  const [risk, setRisk] = useState("");
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cloningCode, setCloningCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "24",
    });
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (sample.trim()) params.set("sample", sample.trim());
    if (readout.trim()) params.set("readout", readout.trim());
    if (risk) params.set("risk", risk);
    if (evidence) params.set("evidenceTier", evidence);
    if (status) params.set("status", status);
    try {
      const { response, data } = await requestJson<TechniquePage>(
        `/api/experiment-techniques?${params.toString()}`,
      );
      if (!response.ok || !data) {
        onNotice({ kind: "error", text: "读取技术目录失败。" });
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [category, evidence, onNotice, page, query, readout, risk, sample, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function cloneDraft(code: string) {
    if (!labId) {
      onNotice({ kind: "error", text: "请先选择实验室。" });
      return;
    }
    setCloningCode(code);
    const { response, data } = await requestJson<{
      draft?: TechniqueDraft;
      error?: string;
    }>("/api/experiment-techniques/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId, baseCode: code, source: "CURATED" }),
    });
    setCloningCode(null);
    if (!response.ok) {
      onNotice({ kind: "error", text: data?.error ?? "创建草稿失败。" });
      return;
    }
    onNotice({ kind: "success", text: `已基于 ${code} 创建实验室私有草稿。` });
    onDraftCreated();
  }

  const categories = result?.categories ?? [];

  return (
    <section className="app-panel overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">技术图谱</h2>
            <p className="mt-1 text-sm text-slate-600">
              目录在服务端分页与检索，完整知识包不会进入客户端静态资源。
            </p>
          </div>
          <span className="text-sm font-semibold text-teal-700">
            {result?.total ?? "—"} 项匹配
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            一级分类
          </p>
          <div className="grid gap-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                !category ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => {
                setCategory("");
                setPage(1);
              }}
            >
              全部分类
            </button>
            {categories.map((item) => (
              <button
                key={item.code}
                type="button"
                className={`rounded-lg px-3 py-2 text-left text-sm ${
                  category === item.code
                    ? "bg-teal-50 font-semibold text-teal-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setCategory(item.code);
                  setPage(1);
                }}
              >
                <span className="block">{item.zh}</span>
                <span className="block text-xs text-slate-400">{item.en}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="relative md:col-span-2 xl:col-span-3">
              <span className="sr-only">双语搜索</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="input-base input-with-leading-icon"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索中文、英文、缩写或别名"
              />
            </label>
            <input
              className="input-base"
              value={sample}
              onChange={(event) => {
                setSample(event.target.value);
                setPage(1);
              }}
              placeholder="样本类型"
              aria-label="样本类型"
            />
            <input
              className="input-base"
              value={readout}
              onChange={(event) => {
                setReadout(event.target.value);
                setPage(1);
              }}
              placeholder="读出类型"
              aria-label="读出类型"
            />
            <select
              className="input-base"
              value={risk}
              onChange={(event) => {
                setRisk(event.target.value);
                setPage(1);
              }}
              aria-label="风险等级"
            >
              <option value="">全部风险</option>
              <option value="LOW">低</option>
              <option value="MODERATE">中</option>
              <option value="HIGH">高</option>
              <option value="RESTRICTED">受限</option>
            </select>
            <select
              className="input-base"
              value={evidence}
              onChange={(event) => {
                setEvidence(event.target.value);
                setPage(1);
              }}
              aria-label="证据等级"
            >
              <option value="">全部证据</option>
              {["A1", "A2", "B1", "B2", "C1", "C2", "D"].map((tier) => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
            <select
              className="input-base"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              aria-label="发布状态"
            >
              <option value="">全部状态</option>
              <option value="PUBLISHED">已发布</option>
              <option value="IN_REVIEW">审核中</option>
              <option value="DRAFT">草稿</option>
              <option value="DEPRECATED">已停用</option>
            </select>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton h-48 rounded-xl" />
              ))}
            </div>
          ) : result?.items.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {result.items.map((technique) => (
                <article
                  key={technique.code}
                  className="flex min-h-52 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-teal-700">
                        {technique.code}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">
                        {technique.name.zh}
                      </h3>
                      <p className="text-sm text-slate-500">{technique.name.en}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass(technique.status)}`}>
                      {statusLabels[technique.status]}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                    {technique.aliases.slice(0, 4).join(" · ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {technique.category.zh}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                      风险 {technique.riskLevel}
                    </span>
                    {technique.evidenceTiers.slice(0, 3).map((tier) => (
                      <span key={tier} className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                        {tier}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link
                      href={`/knowledge/techniques/${encodeURIComponent(technique.code)}`}
                      className="button-secondary"
                    >
                      查看详情
                    </Link>
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={cloningCode === technique.code}
                      onClick={() => void cloneDraft(technique.code)}
                    >
                      {cloningCode === technique.code ? "创建中…" : "创建修订草稿"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              没有符合当前条件的技术。
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              上一页
            </button>
            <span className="text-sm text-slate-500">
              第 {result?.page ?? page} / {Math.max(result?.pageCount ?? 1, 1)} 页
            </span>
            <button
              type="button"
              className="button-secondary"
              disabled={page >= (result?.pageCount ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DraftQueue({
  labId,
  canReview,
  onNotice,
}: {
  labId: string;
  canReview: boolean;
  onNotice: (notice: Notice) => void;
}) {
  const [drafts, setDrafts] = useState<TechniqueDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!labId) return;
    setLoading(true);
    const { response, data } = await requestJson<{ items?: TechniqueDraft[] }>(
      `/api/experiment-techniques/drafts?labId=${encodeURIComponent(labId)}`,
    );
    if (response.ok) {
      const items = data?.items ?? [];
      setDrafts(items);
      setEdits(
        Object.fromEntries(
          items.map((draft) => [
            draft.id,
            JSON.stringify(draft.payload, null, 2),
          ]),
        ),
      );
    }
    setLoading(false);
  }, [labId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    draft: TechniqueDraft,
    operation: "submit" | "approve" | "reject" | "publish",
  ) {
    setBusyId(draft.id);
    const url = `/api/experiment-techniques/drafts/${draft.id}/${operation === "approve" || operation === "reject" ? "review" : operation}`;
    let payload: Record<string, unknown> = { labId };
    try {
      if (operation === "submit") {
        payload.payload = JSON.parse(edits[draft.id] ?? "{}");
      }
      if (operation === "approve" || operation === "reject") {
        payload = {
          labId,
          action: operation === "approve" ? "APPROVE" : "REJECT",
          note: operation === "approve" ? "审核通过" : "需补充证据或修订内容",
        };
      }
      const { response, data } = await requestJson<{ error?: string }>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        onNotice({
          kind: "error",
          text: data?.error ?? `${operation} 操作失败。`,
        });
      } else {
        onNotice({ kind: "success", text: "草稿状态已更新。" });
        await load();
      }
    } catch (error) {
      onNotice({
        kind: "error",
        text:
          error instanceof SyntaxError
            ? "草稿 JSON 格式无效。"
            : "草稿操作失败。",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="app-panel overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-semibold text-slate-950">待审核草稿</h2>
        <p className="mt-1 text-sm text-slate-600">
          成员可编辑并提交实验室私有草稿；PI/管理员负责批准、拒绝和全局发布。
        </p>
      </div>
      <div className="space-y-4 p-5">
        {loading ? <div className="skeleton h-48 rounded-xl" /> : null}
        {!loading && !drafts.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            暂无草稿。可从技术图谱中选择一项创建修订。
          </div>
        ) : null}
        {drafts.map((draft) => (
          <article key={draft.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-teal-700">{draft.baseCode ?? "NEW_TECHNIQUE"}</p>
                <h3 className="mt-1 font-semibold text-slate-950">
                  {(draft.payload.name as { zh?: string } | undefined)?.zh ?? draft.id}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {draft.source} · 更新于 {formatDate(draft.updatedAt)}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(draft.status)}`}>
                {statusLabels[draft.status]}
              </span>
            </div>

            {(draft.status === "DRAFT" || draft.status === "REJECTED") ? (
              <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
                  编辑结构化草稿 JSON
                </summary>
                <div className="border-t border-slate-200 p-3">
                  <textarea
                    className="input-base min-h-72 font-mono text-xs"
                    value={edits[draft.id] ?? ""}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [draft.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </details>
            ) : null}

            {draft.reviewNote ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                审核意见：{draft.reviewNote}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {draft.status === "DRAFT" || draft.status === "REJECTED" ? (
                <button
                  type="button"
                  className="button-primary"
                  disabled={busyId === draft.id}
                  onClick={() => void act(draft, "submit")}
                >
                  提交审核
                </button>
              ) : null}
              {canReview && draft.status === "IN_REVIEW" ? (
                <>
                  <button
                    type="button"
                    className="button-primary"
                    disabled={busyId === draft.id}
                    onClick={() => void act(draft, "approve")}
                  >
                    <CheckIcon className="h-4 w-4" />
                    批准
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busyId === draft.id}
                    onClick={() => void act(draft, "reject")}
                  >
                    拒绝
                  </button>
                </>
              ) : null}
              {canReview && draft.status === "APPROVED" ? (
                <button
                  type="button"
                  className="button-primary"
                  disabled={busyId === draft.id}
                  onClick={() => void act(draft, "publish")}
                >
                  发布新修订
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuditLog({
  labId,
  onNotice,
}: {
  labId: string;
  onNotice: (notice: Notice) => void;
}) {
  const [logs, setLogs] = useState<KnowledgeLog[]>([]);
  const [query, setQuery] = useState("");
  const [loadedLabId, setLoadedLabId] = useState<string | null>(null);
  const loading = loadedLabId !== labId;

  useEffect(() => {
    if (!labId) return;
    let ignore = false;
    void requestJson<{ items?: KnowledgeLog[] }>(
      `/api/knowledge/logs?labId=${encodeURIComponent(labId)}`,
    ).then(({ response, data }) => {
      if (ignore) return;
      if (response.ok) setLogs(data?.items ?? []);
      else onNotice({ kind: "error", text: "读取审计日志失败。" });
      setLoadedLabId(labId);
    });
    return () => {
      ignore = true;
    };
  }, [labId, onNotice]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return logs.filter((log) =>
      [log.entityKey, log.domain, log.flowType, log.status]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(normalized),
    );
  }, [logs, query]);

  return (
    <section className="app-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">变更审计</h2>
          <p className="mt-1 text-sm text-slate-600">
            每次发布或回滚都会生成不可修改的修订和实验室审计记录。
          </p>
        </div>
        <input
          className="input-base md:w-72"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="按实体、流程或状态搜索"
        />
      </div>
      <div className="divide-y divide-slate-200">
        {loading ? <div className="m-5 skeleton h-40 rounded-xl" /> : null}
        {!loading && !filtered.length ? (
          <p className="p-10 text-center text-sm text-slate-500">暂无审计记录。</p>
        ) : null}
        {filtered.map((log) => (
          <article key={log.id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-teal-700">
                  {log.entityKey}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(log.status)}`}>
                  {log.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {log.flowType} · {log.domain}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                证据：{log.evidenceSummary?.join("、") || "未记录"}
              </p>
            </div>
            <time className="text-xs text-slate-500">{formatDate(log.createdAt)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
