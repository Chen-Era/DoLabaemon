"use client";

import { useState } from "react";

type TabKey = "reagents" | "checks" | "labs";

const dashboardTabs: Record<
  TabKey,
  {
    label: string;
    title: string;
    status: string;
    statusTone?: "success" | "warning";
    metrics: Array<{ label: string; value: string; trend: string }>;
    bars: string[];
    footnotes: string[];
    cards: Array<{ title: string; copy: string; tag: string; tagTone?: "success" | "warning" }>;
  }
> = {
  reagents: {
    label: "Reagents",
    title: "试剂库存概览",
    status: "库存稳定",
    statusTone: "success",
    metrics: [
      { label: "在库试剂", value: "1,284", trend: "+12.4%" },
      { label: "新增入库", value: "86", trend: "本周" },
    ],
    bars: ["h-20", "h-28", "h-24", "h-32", "h-[7.5rem]", "h-24"],
    footnotes: ["补货稳定", "分类清晰", "库存同步"],
    cards: [
      { title: "统一试剂上下文", copy: "标签、靶点、类别与实验用途沉淀为共享资产。", tag: "已整理" },
      { title: "重复货号识别", copy: "同货号试剂自动汇总，减少重复录入。", tag: "已启用", tagTone: "success" },
    ],
  },
  checks: {
    label: "Checks",
    title: "实验判定工作台",
    status: "判定清晰",
    statusTone: "success",
    metrics: [
      { label: "判定通过", value: "92%", trend: "稳定" },
      { label: "待补项目", value: "14", trend: "今日" },
    ],
    bars: ["h-16", "h-24", "h-22", "h-30", "h-28", "h-20"].map((value) => (value === "h-30" ? "h-[7.5rem]" : value)),
    footnotes: ["补货稳定", "判定清晰", "协作同步"],
    cards: [
      { title: "显式缺失与风险", copy: "最低必需项、推荐补充项与兼容性问题分层输出。", tag: "待核查", tagTone: "warning" },
      { title: "规则优先", copy: "判定结果优先依赖结构化规则，而不是黑盒建议。", tag: "已启用", tagTone: "success" },
    ],
  },
  labs: {
    label: "Labs",
    title: "实验室协作视图",
    status: "协作同步",
    statusTone: "success",
    metrics: [
      { label: "实验室数量", value: "12", trend: "活跃" },
      { label: "成员邀请", value: "38", trend: "本月" },
    ],
    bars: ["h-18", "h-22", "h-26", "h-24", "h-28", "h-32"].map((value) =>
      value === "h-18" ? "h-[4.5rem]" : value === "h-22" ? "h-[5.5rem]" : value === "h-26" ? "h-[6.5rem]" : value,
    ),
    footnotes: ["成员清晰", "边界明确", "共享同步"],
    cards: [
      { title: "实验室数据隔离", copy: "不同实验室共享机制清晰，避免库存语境混淆。", tag: "已启用", tagTone: "success" },
      { title: "成员协作", copy: "围绕统一库存视图和同一判定语言协同工作。", tag: "进行中" },
    ],
  },
};

const tabOrder: TabKey[] = ["reagents", "checks", "labs"];

export function MockDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("checks");
  const active = dashboardTabs[activeTab];

  return (
    <aside className="mock-dashboard p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[90px_minmax(0,1fr)]">
        <div className="mock-sidebar rounded-2xl px-3 py-4 text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
            Lab OS
          </div>
          <div className="mt-4 space-y-2">
            {tabOrder.map((key) => {
              const selected = activeTab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`w-full rounded-xl border px-2 py-2 text-left text-[11px] shadow-sm transition ${
                    selected
                      ? "border-blue-200 bg-blue-600 text-white"
                      : "border-transparent bg-white/80 text-slate-600 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  {dashboardTabs[key].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Preview</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{active.title}</p>
            </div>
            <span className={`status-pill w-fit shrink-0 whitespace-nowrap ${active.statusTone ?? ""}`.trim()}>{active.status}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {active.metrics.map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="kpi-label">{metric.label}</p>
                <div className="mt-3 flex flex-col items-start gap-3">
                  <p className="metric-value break-words">{metric.value}</p>
                  <span className="kpi-trend shrink-0 whitespace-nowrap">{metric.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-900">趋势预览</p>
              <span className="glass-badge w-fit">近 30 天</span>
            </div>
            <div className="mt-5 flex h-36 items-end gap-2 sm:gap-3">
              {active.bars.map((height, index) => (
                <div key={`${activeTab}-${index}`} className={`mock-chart-bar w-full ${height}`}></div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
              {active.footnotes.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {active.cards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{card.title}</p>
                    <p className="section-copy mt-1 text-sm">{card.copy}</p>
                  </div>
                  <span className={`status-pill w-fit shrink-0 whitespace-nowrap ${card.tagTone ?? ""}`.trim()}>{card.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
