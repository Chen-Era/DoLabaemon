"use client";

import { useEffect, useMemo, useState } from "react";
import { CopySelectedButton } from "@/components/common/copy-selected-button";
import { requestJson } from "@/lib/http";

type Lab = { role: string; lab: { id: string; name: string } };
type Reagent = {
  id: string;
  name: string;
  catalogNo: string;
  category: string;
  experimentTags?: string[];
  antibodyMeta?: { role?: string | null; targetName?: string | null } | null;
  primerMeta?: { targetName?: string | null; isReferenceGene?: boolean | null } | null;
};

export default function ReagentsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [items, setItems] = useState<Reagent[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);

  function toUserMessage(error?: string, code?: string) {
    if (code === "PRISMA_CLIENT_OUTDATED") return "当前开发服务器仍在使用旧的 Prisma Client，请重启 dev server 后再打开试剂页。";
    if (code === "NO_LAB_ACCESS") return "当前账号没有该实验室的访问权限。";
    return error ?? "加载试剂失败";
  }

  useEffect(() => {
    requestJson<{ items?: Lab[]; error?: string; code?: string }>("/api/labs/my").then(({ response, data }) => {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(toUserMessage(data?.error, data?.code));
        return;
      }
      const nextLabs = data?.items ?? [];
      setError(null);
      setLabs(nextLabs);
      if (nextLabs.length) {
        setLabId(nextLabs[0].lab.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!labId) return;
    requestJson<{ items?: Reagent[]; error?: string; code?: string }>(`/api/reagents/list?labId=${encodeURIComponent(labId)}`).then(({ response, data }) => {
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
    });
  }, [labId]);

  function buildSummary(reagent: Reagent) {
    const parts = [
      reagent.experimentTags?.length ? reagent.experimentTags.join("、") : null,
      reagent.antibodyMeta?.targetName ? `抗体:${reagent.antibodyMeta.targetName}` : null,
      reagent.primerMeta?.targetName
        ? `引物:${reagent.primerMeta.targetName}${reagent.primerMeta.isReferenceGene ? "(内参)" : ""}`
        : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : "无";
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
      const haystack = [item.name, item.catalogNo, item.category, ...(item.experimentTags ?? []), item.antibodyMeta?.targetName, item.primerMeta?.targetName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(loweredSearch);
    });
  }, [items, search, tagFilter]);

  const selectedRows = useMemo(() => filteredItems.filter((it) => selected[it.id]), [filteredItems, selected]);

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Reagent Index</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">试剂清单</h1>
            <p className="section-copy mt-3 max-w-2xl text-sm md:text-base">
              围绕实验标签、靶点、货号和类别快速筛选库存，帮助你在真正开做实验前完成准备审查。
            </p>
          </div>
          <div className="w-full max-w-sm">
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
        </div>
      </section>

      <section className="data-grid cols-3">
        <div className="app-panel px-5 py-5">
          <p className="section-copy text-sm">库存总量</p>
          <p className="metric-value mt-3">{items.length}</p>
        </div>
        <div className="app-panel px-5 py-5">
          <p className="section-copy text-sm">筛选结果</p>
          <p className="metric-value mt-3">{filteredItems.length}</p>
        </div>
        <div className="app-panel px-5 py-5">
          <p className="section-copy text-sm">可用标签</p>
          <p className="metric-value mt-3">{availableTags.length}</p>
        </div>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker">Filters</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">筛选与批量操作</h2>
          </div>
          <CopySelectedButton rows={selectedRows} />
        </div>
        <div className="data-grid cols-3">
          <div>
            <label className="field-label" htmlFor="reagent-search">
              搜索
            </label>
            <input
              id="reagent-search"
              className="input-base"
              placeholder="搜索名称、货号、标签、靶点"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="tag-filter">
              标签过滤
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
          <div className="flex items-end">
            <div className="flex flex-wrap gap-2">
              <span className="status-pill">当前显示 {filteredItems.length}</span>
              <span className="glass-badge">已选 {selectedRows.length}</span>
            </div>
          </div>
        </div>
        {error ? <p className="danger-panel mt-4 text-sm">{error}</p> : null}
      </section>

      <section className="app-panel px-4 py-4 md:px-5">
        <div className="table-shell">
          <table className="text-sm">
            <thead>
              <tr>
                <th>选择</th>
                <th>名称</th>
                <th>货号</th>
                <th>类别</th>
                <th>实验标签 / 靶点</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={(e) => setSelected((p) => ({ ...p, [it.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="font-medium text-white">{it.name}</td>
                  <td className="text-zinc-300">{it.catalogNo}</td>
                  <td>
                    <span className="glass-badge">{it.category}</span>
                  </td>
                  <td className="text-zinc-300">{buildSummary(it)}</td>
                </tr>
              ))}
              {!filteredItems.length ? (
                <tr>
                  <td className="py-8 text-center text-zinc-500" colSpan={5}>
                    没有匹配的试剂
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
