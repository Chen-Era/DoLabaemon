"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditIcon, LabsIcon, MinusIcon, PlusIcon, SearchIcon, SortIcon, TrashIcon } from "@/components/common/app-icons";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopySelectedButton } from "@/components/common/copy-selected-button";
import { ReagentEditor } from "@/components/reagent/reagent-editor";
import { requestJson } from "@/lib/http";
import { reagentCategoryLabel } from "@/lib/reagent-category";

type Lab = { role: string; lab: { id: string; name: string } };
type Reagent = {
  id: string;
  name: string;
  catalogNo: string;
  category: string;
  subCategory?: string | null;
  vendor?: string | null;
  storageCondition?: string | null;
  expiryDate?: string | null;
  quantity?: number | null;
  unit?: string | null;
  arrivalDate?: string | null;
  note?: string | null;
  createdAt?: string | null;
  uploadedByName?: string | null;
  uploadedAt?: string | null;
  experimentTags?: string[];
  antibodyMeta?: {
    role?: string | null;
    targetName?: string | null;
    hostSpecies?: string | null;
    targetSpecies?: string | null;
  } | null;
  primerMeta?: { targetName?: string | null; isReferenceGene?: boolean | null } | null;
};
type SortKey = "name" | "catalogNo" | "category" | "vendor" | "uploadedAt";
type SortDirection = "asc" | "desc";
type EditorState = { mode: "create" } | { mode: "edit"; reagent: Reagent } | null;

const checkboxClass = "h-4 w-4 accent-blue-600";
const stepperButtonClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line-strong)] bg-white text-slate-500 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40";

function formatUploadTime(value?: string | null) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toUserMessage(error?: string, code?: string) {
  if (code === "PRISMA_CLIENT_OUTDATED") return "当前开发服务器仍在使用旧的 Prisma Client，请重启 dev server 后再打开试剂页。";
  if (code === "NO_LAB_ACCESS") return "当前账号没有该实验室的访问权限。";
  return error ?? "加载试剂失败";
}

export default function ReagentsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [items, setItems] = useState<Reagent[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "uploadedAt", direction: "desc" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reagentRequestIdRef = useRef(0);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reagent | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [adjustingIds, setAdjustingIds] = useState<Record<string, boolean>>({});

  const loadReagents = useCallback(async (nextLabId: string) => {
    const requestId = ++reagentRequestIdRef.current;
    setLoading(true);
    try {
      const { response, data } = await requestJson<{ items?: Reagent[]; error?: string; code?: string }>(
        `/api/reagents/list?labId=${encodeURIComponent(nextLabId)}`,
      );
      if (requestId !== reagentRequestIdRef.current) return;
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(toUserMessage(data?.error, data?.code));
        setItems([]);
        return;
      }
      setError(null);
      setItems(data?.items ?? []);
    } catch {
      if (requestId !== reagentRequestIdRef.current) return;
      setError("网络异常，暂时无法读取试剂清单。");
      setItems([]);
    } finally {
      if (requestId === reagentRequestIdRef.current) setLoading(false);
    }
  }, []);

  async function adjustQuantity(reagent: Reagent, delta: number) {
    if (adjustingIds[reagent.id]) return;
    setAdjustingIds((prev) => ({ ...prev, [reagent.id]: true }));
    try {
      const { response, data } = await requestJson<{ afterQuantity?: number; error?: string }>(
        "/api/reagents/adjust-quantity",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reagentId: reagent.id, delta }),
        },
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? "调整库存失败，请稍后重试。");
        return;
      }
      setError(null);
      setItems((prev) =>
        prev.map((item) => (item.id === reagent.id ? { ...item, quantity: data?.afterQuantity ?? item.quantity } : item)),
      );
    } catch {
      setError("网络异常，暂时无法调整库存。");
    } finally {
      setAdjustingIds((prev) => ({ ...prev, [reagent.id]: false }));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const { response, data } = await requestJson<{ error?: string }>(
        `/api/reagents/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? "删除失败，请稍后重试。");
        setDeleteTarget(null);
        return;
      }
      setError(null);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSelected((prev) => ({ ...prev, [deleteTarget.id]: false }));
      setDeleteTarget(null);
    } catch {
      setError("网络异常，暂时无法删除试剂。");
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function confirmBatchDelete() {
    if (deleteBusy) return;
    const ids = selectedRows.map((item) => item.id);
    if (!ids.length) {
      setBatchDeleteOpen(false);
      return;
    }
    setDeleteBusy(true);
    try {
      const { response, data } = await requestJson<{ deletedCount?: number; error?: string }>(
        "/api/reagents/batch-delete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labId, ids }),
        },
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? "批量删除失败，请稍后重试。");
        setBatchDeleteOpen(false);
        return;
      }
      setError(null);
      setSelected({});
      setBatchDeleteOpen(false);
      void loadReagents(labId);
    } catch {
      setError("网络异常，暂时无法批量删除。");
      setBatchDeleteOpen(false);
    } finally {
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    void requestJson<{ items?: Lab[]; error?: string; code?: string }>("/api/labs/my")
      .then(({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          setError(toUserMessage(data?.error, data?.code));
          setLoading(false);
          return;
        }
        const nextLabs = data?.items ?? [];
        setError(null);
        setLabs(nextLabs);
        if (nextLabs.length) {
          setLabId(nextLabs[0].lab.id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setError("网络异常，暂时无法读取实验室。");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!labId) return;
    setItems([]);
    setSelected({});
    void loadReagents(labId);
  }, [labId, loadReagents]);

  function buildTargetSummary(reagent: Reagent) {
    const parts = [
      reagent.antibodyMeta?.targetName ? `抗体:${reagent.antibodyMeta.targetName}` : null,
      reagent.primerMeta?.targetName
        ? `引物:${reagent.primerMeta.targetName}${reagent.primerMeta.isReferenceGene ? "(内参)" : ""}`
        : null,
    ].filter(Boolean);
    return parts.join(" | ");
  }

  const availableTags = useMemo(
    () => [...new Set(items.flatMap((item) => item.experimentTags ?? []))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTag = tagFilter === "ALL" || item.experimentTags?.includes(tagFilter);
      if (!matchesTag) return false;
      if (!loweredSearch) return true;
      const haystack = [
        item.name,
        item.catalogNo,
        item.category,
        item.uploadedByName,
        ...(item.experimentTags ?? []),
        item.antibodyMeta?.targetName,
        item.primerMeta?.targetName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(loweredSearch);
    });
  }, [items, search, tagFilter]);

  const sortedItems = useMemo(() => {
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...filteredItems].sort((left, right) => {
      const leftValue = String(left[sort.key] ?? "");
      const rightValue = String(right[sort.key] ?? "");
      return leftValue.localeCompare(rightValue, "zh-CN", { numeric: true, sensitivity: "base" }) * multiplier;
    });
  }, [filteredItems, sort]);

  const selectedRows = useMemo(() => sortedItems.filter((item) => selected[item.id]), [selected, sortedItems]);
  const allFilteredSelected = sortedItems.length > 0 && sortedItems.every((item) => selected[item.id]);

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const item of sortedItems) {
        next[item.id] = checked;
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sortDirectionFor(key: SortKey) {
    if (sort.key !== key) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  function stockSummary(reagent: Reagent) {
    return reagent.storageCondition || "";
  }

  const showNoLabs = !loading && !error && labs.length === 0;

  return (
    <div className="space-y-5">
      <section className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker">试剂清单</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">试剂管理</h1>
            <p className="section-copy mt-2 max-w-2xl text-sm">
              按名称、货号、标签或靶点查找库存记录，直接编辑、删除或增减库存。
            </p>
          </div>
          {!showNoLabs ? (
            <button type="button" className="button-primary shrink-0" onClick={() => setEditor({ mode: "create" })}>
              <PlusIcon className="h-4 w-4" />
              新建试剂
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>{loading ? "正在读取库存…" : `共 ${items.length} 条`}</span>
          <span>{loading ? "—" : `当前显示 ${filteredItems.length} 条`}</span>
          <span>{loading ? "—" : `${availableTags.length} 个实验标签`}</span>
        </div>
      </section>

      {showNoLabs ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <LabsIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-slate-950">你还没有加入任何实验室</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            可以先创建自己的实验室，或使用邀请码申请加入同事的实验室；加入后即可录入和查看试剂。
          </p>
          <Link href="/labs" className="button-primary mt-5">
            前往实验室
          </Link>
        </section>
      ) : (
      <>
      <section className="app-panel px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="lab-filter">
                当前实验室
              </label>
              <select id="lab-filter" className="input-base" value={labId} onChange={(e) => setLabId(e.target.value)}>
                {labs.map((x) => (
                  <option key={x.lab.id} value={x.lab.id}>
                    {x.lab.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="reagent-search">
                搜索
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  id="reagent-search"
                  className="input-base input-with-leading-icon"
                  placeholder="搜索名称、货号、标签、靶点"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="tag-filter">
                实验标签
              </label>
              <select id="tag-filter" className="input-base" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="ALL">全部标签</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {selectedRows.length ? (
              <>
                <span className="text-xs text-slate-500">已选 {selectedRows.length} 条</span>
                <CopySelectedButton rows={selectedRows} />
                <button type="button" className="button-danger-ghost" onClick={() => setBatchDeleteOpen(true)}>
                  <TrashIcon className="h-4 w-4" />
                  删除所选
                </button>
              </>
            ) : null}
          </div>
        </div>
        {error ? <p className="danger-panel mt-3 px-3 py-2 text-sm">{error}</p> : null}
      </section>

      <section>
        <div className="table-shell">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={allFilteredSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="全选"
                  />
                </th>
                <th aria-sort={sortDirectionFor("name")}>
                  <button type="button" className="table-header-sort" onClick={() => toggleSort("name")}>
                    名称
                    <SortIcon className={`transition-transform ${sort.key === "name" && sort.direction === "asc" ? "rotate-180" : ""}`} />
                  </button>
                </th>
                <th aria-sort={sortDirectionFor("catalogNo")}>
                  <button type="button" className="table-header-sort" onClick={() => toggleSort("catalogNo")}>
                    货号
                    <SortIcon className={`transition-transform ${sort.key === "catalogNo" && sort.direction === "asc" ? "rotate-180" : ""}`} />
                  </button>
                </th>
                <th aria-sort={sortDirectionFor("category")}>
                  <button type="button" className="table-header-sort" onClick={() => toggleSort("category")}>
                    类别
                    <SortIcon className={`transition-transform ${sort.key === "category" && sort.direction === "asc" ? "rotate-180" : ""}`} />
                  </button>
                </th>
                <th aria-sort={sortDirectionFor("vendor")}>
                  <button type="button" className="table-header-sort" onClick={() => toggleSort("vendor")}>
                    供应商 / 规格
                    <SortIcon className={`transition-transform ${sort.key === "vendor" && sort.direction === "asc" ? "rotate-180" : ""}`} />
                  </button>
                </th>
                <th aria-sort={sortDirectionFor("uploadedAt")}>
                  <button type="button" className="table-header-sort" onClick={() => toggleSort("uploadedAt")}>
                    上传信息
                    <SortIcon className={`transition-transform ${sort.key === "uploadedAt" && sort.direction === "asc" ? "rotate-180" : ""}`} />
                  </button>
                </th>
                <th>实验标签 / 靶点</th>
                <th className="w-28">库存</th>
                <th className="w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={9}>
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))
                : sortedItems.map((it) => {
                    const tags = it.experimentTags ?? [];
                    const visibleTags = tags.slice(0, 3);
                    const hiddenCount = tags.length - visibleTags.length;
                    const targetSummary = buildTargetSummary(it);
                    const quantity = typeof it.quantity === "number" ? it.quantity : null;
                    const adjusting = !!adjustingIds[it.id];
                    return (
                      <tr key={it.id}>
                        <td>
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={!!selected[it.id]}
                            onChange={(e) => setSelected((p) => ({ ...p, [it.id]: e.target.checked }))}
                            aria-label={`选择 ${it.name}`}
                          />
                        </td>
                        <td className="font-medium text-slate-900 [overflow-wrap:anywhere]">{it.name}</td>
                        <td className="font-mono text-xs text-slate-600 [overflow-wrap:anywhere]">{it.catalogNo}</td>
                        <td className="text-xs text-slate-600">{reagentCategoryLabel(it.category)}</td>
                        <td className="max-w-56">
                          <p className="truncate text-sm font-medium text-slate-700">{it.vendor || "未标注供应商"}</p>
                          <p className="mt-1 text-xs text-slate-500">{stockSummary(it) || "暂未填写储存信息"}</p>
                        </td>
                        <td className="min-w-40">
                          <p className="truncate text-sm font-medium text-slate-700">{it.uploadedByName || "上传者未知"}</p>
                          <time className="mt-1 block text-xs text-slate-500" dateTime={it.uploadedAt ?? undefined}>
                            {formatUploadTime(it.uploadedAt)}
                          </time>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            {visibleTags.map((tag) => (
                              <span key={tag} className="chip">
                                {tag}
                              </span>
                            ))}
                            {hiddenCount > 0 ? (
                              <span className="chip" title={tags.join("、")}>
                                +{hiddenCount}
                              </span>
                            ) : null}
                            {targetSummary ? <span className="ml-1 text-xs text-slate-500">{targetSummary}</span> : null}
                            {!tags.length && !targetSummary ? <span className="text-xs text-slate-400">—</span> : null}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className={stepperButtonClass}
                              disabled={adjusting || !quantity}
                              onClick={() => void adjustQuantity(it, -1)}
                              aria-label={`减少 ${it.name} 库存`}
                              title="减少一件"
                            >
                              <MinusIcon className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-10 text-center text-sm font-medium text-slate-800 tabular-nums">
                              {quantity !== null ? `${quantity}${it.unit ? ` ${it.unit}` : ""}` : "—"}
                            </span>
                            <button
                              type="button"
                              className={stepperButtonClass}
                              disabled={adjusting}
                              onClick={() => void adjustQuantity(it, 1)}
                              aria-label={`增加 ${it.name} 库存`}
                              title="增加一件"
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="btn-icon h-8 w-8"
                              onClick={() => setEditor({ mode: "edit", reagent: it })}
                              aria-label={`编辑 ${it.name}`}
                              title="编辑"
                            >
                              <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="btn-icon h-8 w-8 hover:!text-[var(--danger)]"
                              onClick={() => setDeleteTarget(it)}
                              aria-label={`删除 ${it.name}`}
                              title="删除"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              {!loading && !sortedItems.length ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">没有匹配的试剂，调整搜索词或标签过滤试试。</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      </>
      )}

      {editor ? (
        <ReagentEditor
          labId={labId}
          mode={editor.mode}
          initial={editor.mode === "edit" ? editor.reagent : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void loadReagents(labId);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="删除这条试剂记录？"
          description={`将删除「${deleteTarget.name}」（货号 ${deleteTarget.catalogNo}），此操作不可撤销。`}
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {batchDeleteOpen ? (
        <ConfirmDialog
          title={`删除所选 ${selectedRows.length} 条试剂记录？`}
          description="所选记录将从当前实验室库存中移除，此操作不可撤销。"
          busy={deleteBusy}
          onConfirm={() => void confirmBatchDelete()}
          onCancel={() => setBatchDeleteOpen(false)}
        />
      ) : null}
    </div>
  );
}
